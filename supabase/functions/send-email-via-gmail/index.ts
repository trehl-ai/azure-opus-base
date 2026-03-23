import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptToken, encryptToken } from "../_shared/token-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------------------------------------------------------------------------
// Gmail RFC 2822 message builder (with attachment support)
// ---------------------------------------------------------------------------

interface Attachment {
  filename: string;
  content: string; // base64
  type: string;
}

function buildRfc2822Message(params: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  attachments?: Attachment[];
}): string {
  const mainBoundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const lines: string[] = [];
  const hasAttachments = params.attachments && params.attachments.length > 0;

  lines.push(`From: ${params.from}`);
  lines.push(`To: ${params.to.join(", ")}`);
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(", ")}`);
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(", ")}`);
  lines.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`);
  lines.push("MIME-Version: 1.0");

  if (hasAttachments) {
    // multipart/mixed wrapping body + attachments
    lines.push(`Content-Type: multipart/mixed; boundary="${mainBoundary}"`);
    lines.push("");

    // Body part
    lines.push(`--${mainBoundary}`);
    if (params.bodyHtml && params.bodyText) {
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push("");
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyText))));
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/html; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyHtml))));
      lines.push(`--${altBoundary}--`);
    } else if (params.bodyHtml) {
      lines.push("Content-Type: text/html; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyHtml))));
    } else {
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyText || ""))));
    }

    // Attachment parts
    for (const att of params.attachments!) {
      lines.push(`--${mainBoundary}`);
      lines.push(`Content-Type: ${att.type}; name="${att.filename}"`);
      lines.push("Content-Transfer-Encoding: base64");
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push("");
      // Split base64 into 76-char lines
      const b64 = att.content;
      for (let i = 0; i < b64.length; i += 76) {
        lines.push(b64.slice(i, i + 76));
      }
    }
    lines.push(`--${mainBoundary}--`);
  } else {
    // No attachments – simple message
    if (params.bodyHtml && params.bodyText) {
      lines.push(`Content-Type: multipart/alternative; boundary="${mainBoundary}"`);
      lines.push("");
      lines.push(`--${mainBoundary}`);
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyText))));
      lines.push(`--${mainBoundary}`);
      lines.push("Content-Type: text/html; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyHtml))));
      lines.push(`--${mainBoundary}--`);
    } else if (params.bodyHtml) {
      lines.push("Content-Type: text/html; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyHtml))));
    } else {
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(btoa(unescape(encodeURIComponent(params.bodyText || ""))));
    }
  }

  return lines.join("\r\n");
}

function toUrlSafeBase64(str: string): string {
  // For raw RFC2822 messages we need raw bytes, not UTF-8 encoded
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(
  refreshTokenEncrypted: string,
  encryptionKey: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const refreshToken = await decryptToken(refreshTokenEncrypted, encryptionKey);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    console.error("Token refresh failed:", data.error || "unknown");
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

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

interface SendGmailRequest {
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
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const ENCRYPTION_KEY = Deno.env.get("EMAIL_TOKEN_ENCRYPTION_KEY");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !ENCRYPTION_KEY) {
      console.error("Missing secrets for send-email-via-gmail");
      return jsonError("Gmail-Versand ist noch nicht konfiguriert.", 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Nicht autorisiert.", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return jsonError("Nicht autorisiert.", 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: publicUserId, error: mapError } = await supabaseAdmin
      .rpc("get_public_user_id", { _auth_user_id: authUser.id });

    if (mapError || !publicUserId) {
      console.error("User ID mapping failed:", mapError?.code || "no public user");
      return jsonError("Benutzer konnte nicht zugeordnet werden.", 403);
    }

    const userId = publicUserId as string;

    let body: SendGmailRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError("Ungültiger Request-Body.", 400);
    }

    if (!body.account_id) return jsonError("account_id ist erforderlich.", 400);
    if (!body.to?.length || !body.subject || (!body.body_html && !body.body_text)) {
      return jsonError("Fehlende Pflichtfelder: to, subject und body_html oder body_text.", 400);
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("id, user_id, provider, email_address, display_name, access_token_encrypted, refresh_token_encrypted, token_expires_at, status")
      .eq("id", body.account_id)
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .single();

    if (accountError || !account) return jsonError("Gmail-Konto nicht gefunden oder kein Zugriff.", 404);
    if (account.status !== "active") return jsonError("Dieses Konto ist nicht aktiv. Bitte verbinde es erneut.", 400);
    if (!account.access_token_encrypted) return jsonError("Keine Zugangsdaten vorhanden. Bitte verbinde das Konto erneut.", 400);

    // Resolve access token
    let accessToken: string;
    const now = Date.now();
    const tokenExpiry = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    const bufferMs = 5 * 60 * 1000;

    if (tokenExpiry > now + bufferMs) {
      try {
        accessToken = await decryptToken(account.access_token_encrypted, ENCRYPTION_KEY);
      } catch {
        return jsonError("Zugangsdaten konnten nicht entschlüsselt werden.", 500);
      }
    } else if (account.refresh_token_encrypted) {
      const refreshResult = await refreshAccessToken(account.refresh_token_encrypted, ENCRYPTION_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      if (!refreshResult) {
        await supabaseAdmin.from("email_accounts").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", account.id);
        return jsonError("Token konnte nicht erneuert werden. Bitte verbinde dein Google-Konto erneut.", 401);
      }
      accessToken = refreshResult.access_token;
      try {
        const newEncrypted = await encryptToken(refreshResult.access_token, ENCRYPTION_KEY);
        await supabaseAdmin.from("email_accounts").update({
          access_token_encrypted: newEncrypted,
          token_expires_at: new Date(now + refreshResult.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", account.id);
      } catch { /* continue */ }
    } else {
      return jsonError("Kein Refresh-Token vorhanden. Bitte verbinde dein Google-Konto erneut.", 401);
    }

    // Insert email record
    const fromAddress = account.display_name ? `${account.display_name} <${account.email_address}>` : account.email_address;

    const { data: messageRow, error: insertError } = await supabaseAdmin
      .from("email_messages")
      .insert({
        user_id: userId, account_id: account.id, provider: "gmail",
        from_email: fromAddress, to_email: body.to, cc_email: body.cc || [], bcc_email: body.bcc || [],
        subject: body.subject, body_html: body.body_html || null, body_text: body.body_text || null,
        status: "queued", direction: "outbound",
        contact_id: body.contact_id || null, deal_id: body.deal_id || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to log email:", insertError.code);
      return jsonError("E-Mail konnte nicht protokolliert werden.", 500);
    }

    const messageId = messageRow.id;

    // Build and send
    const rawMessage = buildRfc2822Message({
      from: fromAddress, to: body.to, cc: body.cc, bcc: body.bcc,
      subject: body.subject, bodyHtml: body.body_html, bodyText: body.body_text,
      attachments: body.attachments,
    });

    const encodedMessage = toUrlSafeBase64(rawMessage);

    let gmailData: Record<string, unknown>;
    let gmailOk: boolean;

    try {
      const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encodedMessage }),
      });
      gmailOk = gmailResponse.ok;
      gmailData = await gmailResponse.json();
    } catch {
      await supabaseAdmin.from("email_messages").update({ status: "failed", error_message: "Gmail API nicht erreichbar" }).eq("id", messageId);
      return jsonError("Gmail-API konnte nicht erreicht werden.", 502);
    }

    if (!gmailOk) {
      const errorMsg = (gmailData.error as Record<string, unknown>)?.message || "Unbekannter Gmail-Fehler";
      await supabaseAdmin.from("email_messages").update({ status: "failed", error_message: String(errorMsg).slice(0, 500) }).eq("id", messageId);
      return jsonError("Gmail-Versand fehlgeschlagen.", 502);
    }

    await supabaseAdmin.from("email_messages").update({
      status: "sent", sent_at: new Date().toISOString(),
      external_message_id: (gmailData.id as string) || null,
      external_thread_id: (gmailData.threadId as string) || null,
    }).eq("id", messageId);

    return new Response(
      JSON.stringify({ success: true, message_id: messageId, gmail_message_id: gmailData.id, gmail_thread_id: gmailData.threadId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in send-email-via-gmail:", error instanceof Error ? error.message : "unknown");
    return jsonError("Interner Serverfehler.", 500);
  }
});
