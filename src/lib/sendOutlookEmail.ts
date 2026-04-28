import { InteractionRequiredAuthError, SilentRequest } from "@azure/msal-browser";
import { msalInstance, loginRequest } from "@/lib/msalConfig";

export interface OutlookSendParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  attachments?: { filename: string; content: string; type: string }[];
}

export interface OutlookSendResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

async function getAccessToken(): Promise<string> {
  await msalInstance.initialize();
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) {
    throw new Error("Kein Outlook-Konto verbunden");
  }

  const silentRequest: SilentRequest = {
    scopes: loginRequest.scopes,
    account: accounts[0],
  };

  try {
    const result = await msalInstance.acquireTokenSilent(silentRequest);
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await msalInstance.acquireTokenPopup(silentRequest);
      return result.accessToken;
    }
    throw err;
  }
}

export async function sendOutlookEmailViaGraph(
  params: OutlookSendParams,
): Promise<OutlookSendResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Outlook-Auth fehlgeschlagen",
    };
  }

  const message: Record<string, unknown> = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.bodyHtml },
    toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
  };
  if (params.cc?.length) {
    message.ccRecipients = params.cc.map((address) => ({ emailAddress: { address } }));
  }
  if (params.bcc?.length) {
    message.bccRecipients = params.bcc.map((address) => ({ emailAddress: { address } }));
  }
  if (params.attachments?.length) {
    message.attachments = params.attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename,
      contentType: a.type,
      contentBytes: a.content,
    }));
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return {
      success: false,
      error: err.error?.message || "E-Mail konnte nicht gesendet werden",
    };
  }

  return { success: true };
}

export function hasOutlookAccount(): boolean {
  return msalInstance.getAllAccounts().length > 0;
}
