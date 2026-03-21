import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Multi-provider email service abstraction
// ---------------------------------------------------------------------------

export type EmailProvider = "resend" | "gmail" | "outlook";

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  reply_to?: string;
  from?: string;
  /** Provider to use. Defaults to "resend" (system channel). */
  provider?: EmailProvider;
  /** Specific email_account id – required for gmail/outlook. */
  account_id?: string;
}

export interface SendEmailResult {
  success: boolean;
  message_id?: string;
  external_id?: string;
  thread_id?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------

/**
 * Send an email through the appropriate provider.
 * - "resend": system/platform channel (no account_id needed)
 * - "gmail": personal Gmail account (account_id required)
 * - "outlook": not yet implemented
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = params.provider ?? "resend";

  switch (provider) {
    case "resend":
      return sendViaResend(params);
    case "gmail":
      return sendViaGmail(params);
    case "outlook":
      return sendViaOutlook(params);
    default:
      throw new Error(`Unbekannter Provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// Resend channel (system / notification emails)
// ---------------------------------------------------------------------------

async function sendViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke("send-email-via-resend", {
    body: {
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body_html: params.body_html,
      body_text: params.body_text,
      reply_to: params.reply_to,
      from: params.from,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: data.error };
  }

  return {
    success: true,
    message_id: data?.message_id,
    external_id: data?.resend_id,
  };
}

// ---------------------------------------------------------------------------
// Gmail channel (personal user accounts)
// ---------------------------------------------------------------------------

async function sendViaGmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!params.account_id) {
    return { success: false, error: "account_id ist für Gmail-Versand erforderlich." };
  }

  const { data, error } = await supabase.functions.invoke("send-email-via-gmail", {
    body: {
      account_id: params.account_id,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body_html: params.body_html,
      body_text: params.body_text,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: data.details || data.error };
  }

  return {
    success: true,
    message_id: data?.message_id,
    external_id: data?.gmail_message_id,
    thread_id: data?.gmail_thread_id,
  };
}
