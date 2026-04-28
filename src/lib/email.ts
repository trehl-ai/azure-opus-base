import { supabase } from "@/integrations/supabase/client";
import { sendOutlookEmailViaGraph } from "@/lib/sendOutlookEmail";

// ---------------------------------------------------------------------------
// Multi-provider email service abstraction
// ---------------------------------------------------------------------------

export type EmailProvider = "resend" | "gmail" | "outlook";

export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  type: string;
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  reply_to?: string;
  from?: string;
  provider?: EmailProvider;
  account_id?: string;
  contact_id?: string;
  deal_id?: string;
  attachments?: EmailAttachment[];
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
// Resend channel
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
      contact_id: params.contact_id,
      deal_id: params.deal_id,
      attachments: params.attachments,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };

  return { success: true, message_id: data?.message_id, external_id: data?.resend_id };
}

// ---------------------------------------------------------------------------
// Gmail channel
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
      contact_id: params.contact_id,
      deal_id: params.deal_id,
      attachments: params.attachments,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.details || data.error };

  return {
    success: true,
    message_id: data?.message_id,
    external_id: data?.gmail_message_id,
    thread_id: data?.gmail_thread_id,
  };
}

// ---------------------------------------------------------------------------
// Outlook channel
// ---------------------------------------------------------------------------

async function sendViaOutlook(params: SendEmailParams): Promise<SendEmailResult> {
  if (!params.body_html) {
    return { success: false, error: "body_html ist für Outlook-Versand erforderlich." };
  }

  const result = await sendOutlookEmailViaGraph({
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    bodyHtml: params.body_html,
    attachments: params.attachments,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Log to user_email_messages so EmailHistory and email_attachments-FK keep working
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: inserted } = await supabase
        .from("user_email_messages")
        .insert({ user_id: user.id, subject: params.subject, body: params.body_html })
        .select("id")
        .single();
      if (inserted?.id) {
        return { success: true, message_id: inserted.id };
      }
    }
  } catch {
    // Logging-Fehler darf den Versand nicht versenken
  }

  return { success: true };
}
