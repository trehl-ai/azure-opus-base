import { useState, useEffect, useCallback } from "react";
import { AccountInfo, InteractionRequiredAuthError, SilentRequest } from "@azure/msal-browser";
import { msalInstance, loginRequest } from "@/lib/msalConfig";
import { supabase } from "@/integrations/supabase/client";

export interface OutlookAccount {
  email: string;
  displayName: string;
}

function mapAuthError(err: any): string | null {
  console.error("MSAL auth error:", err);
  if (
    err?.errorCode === "interaction_required" ||
    err?.errorCode === "consent_required" ||
    err?.errorCode === "admin_consent_required" ||
    err?.message?.includes("AADSTS65001") ||
    err?.message?.includes("admin")
  ) {
    return (
      "Ihre Organisation erfordert eine Administrator-Genehmigung. " +
      "Bitte wenden Sie sich an Ihren IT-Administrator oder besuchen Sie " +
      "/admin/outlook-consent für weitere Informationen."
    );
  }
  if (err?.errorCode === "user_cancelled") {
    return null;
  }
  return "Verbindung fehlgeschlagen: " + (err?.message || "Unbekannter Fehler");
}

export function useMicrosoftAuth() {
  const [outlookAccount, setOutlookAccount] = useState<OutlookAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      await msalInstance.initialize();

      try {
        const result = await msalInstance.handleRedirectPromise();
        if (result) {
          setConnecting(true);
          try {
            await persistTokenToSupabase(result.account, result.accessToken);
          } catch (err) {
            setError("Fehler beim Speichern des Tokens");
            console.error(err);
          } finally {
            setConnecting(false);
          }
        }
      } catch (err) {
        setError(mapAuthError(err));
        setConnecting(false);
      }

      await loadExistingAccount();
    };

    init();
  }, []);

  const loadExistingAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("email_accounts")
      .select("email_address, display_name")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .maybeSingle();
    if (data) {
      setOutlookAccount({
        email: data.email_address,
        displayName: data.display_name ?? "",
      });
    }
  };

  const persistTokenToSupabase = async (account: AccountInfo, accessToken: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const graphUser = await graphRes.json();
    const email: string = graphUser.mail || graphUser.userPrincipalName;
    const displayName: string = graphUser.displayName;

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    await supabase.from("email_accounts").upsert({
      user_id: user.id,
      provider: "microsoft",
      email_address: email,
      display_name: displayName,
      access_token_encrypted: accessToken,
      refresh_token_encrypted: null,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    setOutlookAccount({ email, displayName });
  };

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      await msalInstance.initialize();
      await msalInstance.loginRedirect(loginRequest);
    } catch (err) {
      setError(mapAuthError(err));
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("email_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "microsoft");
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      await msalInstance.logoutPopup({ account: accounts[0] });
    }
    setOutlookAccount(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    if (!accounts.length) throw new Error("No Microsoft account connected");

    const silentRequest: SilentRequest = {
      scopes: loginRequest.scopes,
      account: accounts[0],
    };

    try {
      const result = await msalInstance.acquireTokenSilent(silentRequest);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("email_accounts").update({
          access_token_encrypted: result.accessToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("provider", "microsoft");
      }
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        const result = await msalInstance.acquireTokenPopup(silentRequest);
        return result.accessToken;
      }
      throw err;
    }
  }, []);

  return { outlookAccount, connecting, error, connect, disconnect, getAccessToken };
}
