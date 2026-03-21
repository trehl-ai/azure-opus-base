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
  /** Specific email_account id – required for gmail/outlook in the future. */
  account_id?: string;
}

export interface SendEmailResult {
  success: boolean;
  message_id?: string;
  external_id?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------

/**
 * Send an email through the appropriate provider.
 * Currently only "resend" is implemented. Gmail and Outlook will be added
 * once OAuth flows are in place.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = params.provider ?? "resend";

  switch (provider) {
    case "resend":
      return sendViaResend(params);
    case "gmail":
      throw new Error("Gmail-Versand ist noch nicht implementiert.");
    case "outlook":
      throw new Error("Outlook-Versand ist noch nicht implementiert.");
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
