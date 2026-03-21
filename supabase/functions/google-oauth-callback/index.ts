import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple XOR-based encryption (will be replaced with AES when crypto lib is added)
function encryptToken(token: string, key: string): string {
  const tokenBytes = new TextEncoder().encode(token);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return base64Encode(encrypted);
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
      return htmlResponse(
        "Konfiguration unvollständig",
        `Die folgenden Secrets müssen gesetzt werden: ${missingSecrets.join(", ")}. Bitte wende dich an deinen Administrator.`,
        503
      );
    }

    // --- Parse callback params ---
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return htmlResponse("Verbindung abgelehnt", `Google hat die Verbindung abgelehnt: ${error}`);
    }

    if (!code || !stateParam) {
      return htmlResponse("Ungültige Anfrage", "Fehlende Parameter (code oder state).", 400);
    }

    // Decode state
    let state: { user_id: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return htmlResponse("Ungültiger State-Parameter", "Der OAuth-State konnte nicht gelesen werden.", 400);
    }

    const userId = state.user_id;
    if (!userId) {
      return htmlResponse("Fehlender Benutzer", "Kein user_id im State gefunden.", 400);
    }

    // --- Exchange code for tokens ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token exchange error:", tokenData);
      return htmlResponse(
        "Token-Austausch fehlgeschlagen",
        `Google konnte keinen Access Token ausstellen: ${tokenData.error_description || tokenData.error || "Unbekannter Fehler"}`
      );
    }

    // --- Get user info from Google ---
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    if (!userInfo.email) {
      return htmlResponse("E-Mail nicht ermittelt", "Google hat keine E-Mail-Adresse zurückgegeben.");
    }

    // --- Encrypt tokens ---
    const accessTokenEncrypted = encryptToken(tokenData.access_token, ENCRYPTION_KEY!);
    const refreshTokenEncrypted = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token, ENCRYPTION_KEY!)
      : null;

    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // --- Upsert email_accounts ---
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if this Google email is already linked for this user
    const { data: existing } = await supabaseAdmin
      .from("email_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .eq("email_address", userInfo.email)
      .maybeSingle();

    if (existing) {
      // Update existing account
      await supabaseAdmin
        .from("email_accounts")
        .update({
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted || undefined,
          token_expires_at: tokenExpiresAt,
          status: "active",
          display_name: userInfo.name || userInfo.email,
          metadata_json: { picture: userInfo.picture, locale: userInfo.locale },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Insert new account
      await supabaseAdmin.from("email_accounts").insert({
        user_id: userId,
        provider: "gmail",
        email_address: userInfo.email,
        display_name: userInfo.name || userInfo.email,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        status: "active",
        is_default: false,
        metadata_json: { picture: userInfo.picture, locale: userInfo.locale },
      });
    }

    // --- Success page that closes the popup ---
    return htmlResponse(
      "Verbindung erfolgreich!",
      `Dein Google-Konto (${userInfo.email}) wurde erfolgreich verbunden. Dieses Fenster schließt sich automatisch.`,
      200,
      true
    );
  } catch (error) {
    console.error("Error in google-oauth-callback:", error);
    return htmlResponse(
      "Fehler",
      `Ein unerwarteter Fehler ist aufgetreten: ${error instanceof Error ? error.message : "Unbekannt"}`,
      500
    );
  }
});

function htmlResponse(title: string, message: string, status = 200, autoClose = false): Response {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .card { background: white; border-radius: 12px; padding: 32px; max-width: 420px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  ${autoClose ? `<script>
    setTimeout(() => {
      if (window.opener) {
        window.opener.postMessage({ type: 'google-oauth-success' }, '*');
        window.close();
      }
    }, 1500);
  </script>` : ""}
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
