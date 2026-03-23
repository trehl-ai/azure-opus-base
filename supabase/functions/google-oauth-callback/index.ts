import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken } from "../_shared/token-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      console.error("Missing secrets for google-oauth-callback:", missingSecrets.join(", "));
      return htmlResponse(
        "Konfiguration unvollständig",
        "Die Google-Integration ist noch nicht vollständig konfiguriert. Bitte wende dich an deinen Administrator.",
        503
      );
    }

    // --- Parse callback params ---
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      console.error("Google OAuth denied:", oauthError);
      return htmlResponse(
        "Verbindung abgelehnt",
        "Google hat die Verbindung abgelehnt. Bitte versuche es erneut."
      );
    }

    if (!code || !stateParam) {
      return htmlResponse("Ungültige Anfrage", "Fehlende OAuth-Parameter.", 400);
    }

    // Decode state
    let state: { user_id: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return htmlResponse("Ungültiger Aufruf", "Der OAuth-State konnte nicht gelesen werden.", 400);
    }

    const authUserId = state.user_id;
    if (!authUserId) {
      return htmlResponse("Ungültiger Aufruf", "Kein Benutzer im OAuth-State gefunden.", 400);
    }

    // --- Exchange code for tokens ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    let tokenData: Record<string, unknown>;
    try {
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

      tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        // Log only error type, never tokens
        console.error("Google token exchange failed:", tokenData.error || "unknown");
        return htmlResponse(
          "Verbindung fehlgeschlagen",
          "Der Autorisierungscode konnte nicht eingelöst werden. Bitte versuche es erneut."
        );
      }
    } catch (err) {
      console.error("Network error during token exchange");
      return htmlResponse(
        "Verbindungsfehler",
        "Google konnte nicht erreicht werden. Bitte versuche es später erneut.",
        502
      );
    }

    // --- Get user info from Google ---
    let userInfo: Record<string, unknown>;
    try {
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      userInfo = await userInfoResponse.json();
    } catch {
      console.error("Failed to fetch Google user info");
      return htmlResponse(
        "Profilabruf fehlgeschlagen",
        "Dein Google-Profil konnte nicht abgerufen werden.",
        502
      );
    }

    if (!userInfo.email || typeof userInfo.email !== "string") {
      return htmlResponse("E-Mail fehlt", "Google hat keine E-Mail-Adresse zurückgegeben.");
    }

    // --- Encrypt tokens (AES-256-GCM) ---
    const accessTokenEncrypted = await encryptToken(
      tokenData.access_token as string,
      ENCRYPTION_KEY!
    );
    const refreshTokenEncrypted = tokenData.refresh_token
      ? await encryptToken(tokenData.refresh_token as string, ENCRYPTION_KEY!)
      : null;

    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + (tokenData.expires_in as number) * 1000).toISOString()
      : null;

    // --- Upsert email_accounts ---
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await supabaseAdmin
      .from("email_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .eq("email_address", userInfo.email as string)
      .maybeSingle();

    const accountPayload = {
      access_token_encrypted: accessTokenEncrypted,
      ...(refreshTokenEncrypted && { refresh_token_encrypted: refreshTokenEncrypted }),
      token_expires_at: tokenExpiresAt,
      status: "active",
      display_name: (userInfo.name as string) || (userInfo.email as string),
      metadata_json: {
        picture: userInfo.picture || null,
        locale: userInfo.locale || null,
      },
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("email_accounts")
        .update(accountPayload)
        .eq("id", existing.id);

      if (updateError) {
        console.error("Failed to update email_accounts:", updateError.code);
        return htmlResponse("Speicherfehler", "Das Konto konnte nicht aktualisiert werden.", 500);
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from("email_accounts").insert({
        user_id: userId,
        provider: "gmail",
        email_address: userInfo.email as string,
        is_default: false,
        ...accountPayload,
      });

      if (insertError) {
        console.error("Failed to insert email_accounts:", insertError.code);
        return htmlResponse("Speicherfehler", "Das Konto konnte nicht gespeichert werden.", 500);
      }
    }

    // --- Success page that closes the popup ---
    return htmlResponse(
      "Verbindung erfolgreich!",
      `Dein Google-Konto (${userInfo.email}) wurde erfolgreich verbunden. Dieses Fenster schließt sich automatisch.`,
      200,
      true
    );
  } catch (error) {
    console.error("Unexpected error in google-oauth-callback:", error instanceof Error ? error.message : "unknown");
    return htmlResponse(
      "Fehler",
      "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.",
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
