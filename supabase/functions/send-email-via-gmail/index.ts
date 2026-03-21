import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decode as base64Decode, encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------------------------------------------------------------------------
// Token encryption helpers (must match google-oauth-callback)
// ---------------------------------------------------------------------------

function decryptToken(encrypted: string, key: string): string {
  const encBytes = base64Decode(encrypted);
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = new Uint8Array(encBytes.length);
  for (let i = 0; i < encBytes.length; i++) {
    decrypted[i] = encBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

function encryptToken(token: string, key: string): string {
  const tokenBytes = new TextEncoder().encode(token);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return base64Encode(encrypted);
}

// ---------------------------------------------------------------------------
// Gmail RFC 2822 message builder
// ---------------------------------------------------------------------------

function buildRfc2822Message(params: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
}): string {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const lines: string[] = [];

  lines.push(`From: ${params.from}`);
  lines.push(`To: ${params.to.join(", ")}`);
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(", ")}`);
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(", ")}`);
  lines.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`);
  lines.push("MIME-Version: 1.0");

  if (params.bodyHtml && params.bodyText) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(btoa(unescape(encodeURIComponent(params.bodyText))));
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(btoa(unescape(encodeURIComponent(params.bodyHtml))));
    lines.push(`--${boundary}--`);
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

  return lines.join("\r\n");
}

// URL-safe base64 for Gmail API
function toUrlSafeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Refresh access token
// ---------------------------------------------------------------------------

async function refreshAccessToken(
  refreshTokenEncrypted: string,
  encryptionKey: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const refreshToken = decryptToken(refreshTokenEncrypted, encryptionKey);

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
    console.error("Token refresh failed:", data);
    return null;
  }

  return { access_token: data.access_token, expires_in: data.expires_in };
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Secret guards ---
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const ENCRYPTION_KEY = Deno.env.get("EMAIL_TOKEN_ENCRYPTION_KEY");

    const missingSecrets = [
      ...(!GOOGLE_CLIENT_ID ? ["GOOGLE_CLIENT_ID"] : []),
      ...(!GOOGLE_CLIENT_SECRET ? ["GOOGLE_CLIENT_SECRET"] : []),
      ...(!ENCRYPTION_KEY ? ["EMAIL_TOKEN_ENCRYPTION_KEY"] : []),
    ];

    if (missingSecrets.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Gmail-Versand ist noch nicht konfiguriert.",
          details: `Fehlende Secrets: ${missingSecrets.join(", ")}`,
          missing: missingSecrets,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Authenticate user ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // --- Validate request ---
    const body: SendGmailRequest = await req.json();

    if (!body.account_id) {
      return new Response(
        JSON.stringify({ error: "account_id ist erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.to?.length || !body.subject || (!body.body_html && !body.body_text)) {
      return new Response(
        JSON.stringify({ error: "Fehlende Pflichtfelder: to, subject und body_html oder body_text." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Load email account ---
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: account, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("*")
      .eq("id", body.account_id)
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Gmail-Konto nicht gefunden oder kein Zugriff." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (account.status !== "active") {
      return new Response(
        JSON.stringify({ error: `Konto-Status ist '${account.status}'. Nur aktive Konten können senden.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Resolve access token (refresh if expired) ---
    let accessToken: string;
    const now = Date.now();
    const tokenExpiry = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    const bufferMs = 5 * 60 * 1000; // 5 min buffer

    if (account.access_token_encrypted && tokenExpiry > now + bufferMs) {
      // Token still valid
      accessToken = decryptToken(account.access_token_encrypted, ENCRYPTION_KEY!);
    } else if (account.refresh_token_encrypted) {
      // Refresh needed
      const refreshResult = await refreshAccessToken(
        account.refresh_token_encrypted,
        ENCRYPTION_KEY!,
        GOOGLE_CLIENT_ID!,
        GOOGLE_CLIENT_SECRET!
      );

      if (!refreshResult) {
        // Mark account as error
        await supabaseAdmin
          .from("email_accounts")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", account.id);

        return new Response(
          JSON.stringify({ error: "Access Token konnte nicht erneuert werden. Bitte verbinde dein Google-Konto erneut." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = refreshResult.access_token;

      // Persist new token
      await supabaseAdmin
        .from("email_accounts")
        .update({
          access_token_encrypted: encryptToken(refreshResult.access_token, ENCRYPTION_KEY!),
          token_expires_at: new Date(now + refreshResult.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
    } else {
      return new Response(
        JSON.stringify({ error: "Kein gültiger Token vorhanden. Bitte verbinde dein Google-Konto erneut." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Insert email_messages record (queued) ---
    const fromAddress = account.display_name
      ? `${account.display_name} <${account.email_address}>`
      : account.email_address;

    const { data: messageRow, error: insertError } = await supabaseAdmin
      .from("email_messages")
      .insert({
        user_id: userId,
        account_id: account.id,
        provider: "gmail",
        from_email: fromAddress,
        to_email: body.to,
        cc_email: body.cc || [],
        bcc_email: body.bcc || [],
        subject: body.subject,
        body_html: body.body_html || null,
        body_text: body.body_text || null,
        status: "queued",
        direction: "outbound",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert email_messages:", insertError);
      return new Response(
        JSON.stringify({ error: "E-Mail konnte nicht protokolliert werden.", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = messageRow.id;

    // --- Build RFC 2822 and send via Gmail API ---
    const rawMessage = buildRfc2822Message({
      from: fromAddress,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.body_html,
      bodyText: body.body_text,
    });

    const encodedMessage = toUrlSafeBase64(rawMessage);

    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    const gmailData = await gmailResponse.json();

    if (!gmailResponse.ok) {
      console.error("Gmail API error:", gmailData);

      await supabaseAdmin
        .from("email_messages")
        .update({
          status: "failed",
          error_message: JSON.stringify(gmailData.error || gmailData),
        })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ error: "Gmail-Versand fehlgeschlagen.", details: gmailData.error?.message || "Unbekannter Fehler" }),
        { status: gmailResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Update message as sent ---
    await supabaseAdmin
      .from("email_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        external_message_id: gmailData.id || null,
        external_thread_id: gmailData.threadId || null,
      })
      .eq("id", messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        gmail_message_id: gmailData.id,
        gmail_thread_id: gmailData.threadId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-email-via-gmail:", error);
    return new Response(
      JSON.stringify({
        error: "Interner Serverfehler",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
