import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptToken, encryptToken } from "../_shared/token-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Attachment {
  filename: string;
  content: string; // base64
  type: string;
}

async function refreshAccessToken(
  refreshTokenEncrypted: string,
  encryptionKey: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const refreshToken = await decryptToken(refreshTokenEncrypted, encryptionKey);

  const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "openid profile email offline_access https://graph.microsoft.com/Mail.Send",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    console.error("Outlook token refresh failed:", data.error || "unknown");
    return null;
  }

  return { access_token: data.access_token, expires_in: data.expires_in };
}

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function buildGraphMailPayload(params: {
  subject: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  bodyHtml?: string;
  bodyText?: string;
  attachments?: Attachment[];
}): Record<string, unknown> {
  const toRecipients = (addrs: string[]) =>
    addrs.map((a) => ({ emailAddress: { address: a } }));

  const message: Record<string, unknown> = {
    subject: params.subject,
    body: {
      contentType: params.bodyHtml ? "HTML" : "Text",
      content: params.bodyHtml || params.bodyText || "",
    },
    toRecipients: toRecipients(params.to),
  };

  if (params.cc?.length) message.ccRecipients = toRecipients(params.cc);
  if (params.bcc?.length) message.bccRecipients = toRecipients(params.bcc);

  // Graph API attachments
  if (params.attachments?.length) {
    message.attachments = params.attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.filename,
      contentType: att.type,
      contentBytes: att.content, // Graph expects base64
    }));
  }

  return { message, saveToSentItems: true };
}

interface SendOutlookRequest {
  account_id: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  contact_id?: string;
  deal_id?: string;
  attachments?: Attachment[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MS_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
    const MS_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const ENCRYPTION_KEY = Deno.env.get("EMAIL_TOKEN_ENCRYPTION_KEY");

    if (!MS_CLIENT_ID || !MS_CLIENT_SECRET || !ENCRYPTION_KEY) {
      return jsonError("Outlook-Versand ist noch nicht konfiguriert.", 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Nicht autorisiert.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) return jsonError("Nicht autorisiert.", 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: publicUserId, error: mapError } = await supabaseAdmin
      .rpc("get_public_user_id", { _auth_user_id: authUser.id });

    if (mapError || !publicUserId) return jsonError("Benutzer konnte nicht zugeordnet werden.", 403);

    const userId = publicUserId as string;

    let body: SendOutlookRequest;
    try { body = await req.json(); } catch { return jsonError("Ungültiger Request-Body.", 400); }

    if (!body.account_id) return jsonError("account_id ist erforderlich.", 400);
    if (!body.to?.length || !body.subject || (!body.body_html && !body.body_text)) {
      return jsonError("Fehlende Pflichtfelder.", 400);
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("id, user_id, provider, email_address, display_name, access_token_encrypted, refresh_token_encrypted, token_expires_at, status")
      .eq("id", body.account_id).eq("user_id", userId).eq("provider", "outlook").single();

    if (accountError || !account) return jsonError("Outlook-Konto nicht gefunden.", 404);
    if (account.status !== "active") return jsonError("Konto ist nicht aktiv.", 400);
    if (!account.access_token_encrypted) return jsonError("Keine Zugangsdaten vorhanden.", 400);

    let accessToken: string;
    const now = Date.now();
    const tokenExpiry = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;

    if (tokenExpiry > now + 300000) {
      accessToken = await decryptToken(account.access_token_encrypted, ENCRYPTION_KEY);
    } else if (account.refresh_token_encrypted) {
      const refreshResult = await refreshAccessToken(account.refresh_token_encrypted, ENCRYPTION_KEY, MS_CLIENT_ID, MS_CLIENT_SECRET);
      if (!refreshResult) {
        await supabaseAdmin.from("email_accounts").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", account.id);
        return jsonError("Token konnte nicht erneuert werden.", 401);
      }
      accessToken = refreshResult.access_token;
      try {
        const enc = await encryptToken(refreshResult.access_token, ENCRYPTION_KEY);
        await supabaseAdmin.from("email_accounts").update({
          access_token_encrypted: enc,
          token_expires_at: new Date(now + refreshResult.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", account.id);
      } catch { /* continue */ }
    } else {
      return jsonError("Kein Refresh-Token vorhanden.", 401);
    }

    const fromAddress = account.display_name ? `${account.display_name} <${account.email_address}>` : account.email_address;

    const { data: messageRow, error: insertError } = await supabaseAdmin
      .from("email_messages")
      .insert({
        user_id: userId, account_id: account.id, provider: "outlook",
        from_email: fromAddress, to_email: body.to, cc_email: body.cc || [], bcc_email: body.bcc || [],
        subject: body.subject, body_html: body.body_html || null, body_text: body.body_text || null,
        status: "queued", direction: "outbound",
        contact_id: body.contact_id || null, deal_id: body.deal_id || null,
      })
      .select("id").single();

    if (insertError) return jsonError("E-Mail konnte nicht protokolliert werden.", 500);

    const messageId = messageRow.id;

    const graphPayload = buildGraphMailPayload({
      subject: body.subject, to: body.to, cc: body.cc, bcc: body.bcc,
      bodyHtml: body.body_html, bodyText: body.body_text,
      attachments: body.attachments,
    });

    let graphOk: boolean;
    let graphData: Record<string, unknown> | null = null;

    try {
      const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(graphPayload),
      });
      graphOk = graphResponse.ok;
      if (!graphOk) graphData = await graphResponse.json();
    } catch {
      await supabaseAdmin.from("email_messages").update({ status: "failed", error_message: "Microsoft Graph nicht erreichbar" }).eq("id", messageId);
      return jsonError("Microsoft Graph API nicht erreichbar.", 502);
    }

    if (!graphOk) {
      const errorMsg = (graphData?.error as Record<string, unknown>)?.message || "Unbekannter Microsoft-Fehler";
      await supabaseAdmin.from("email_messages").update({ status: "failed", error_message: String(errorMsg).slice(0, 500) }).eq("id", messageId);
      return jsonError("Outlook-Versand fehlgeschlagen.", 502);
    }

    await supabaseAdmin.from("email_messages").update({
      status: "sent", sent_at: new Date().toISOString(),
    }).eq("id", messageId);

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in send-email-via-outlook:", error instanceof Error ? error.message : "unknown");
    return jsonError("Interner Serverfehler.", 500);
  }
});
