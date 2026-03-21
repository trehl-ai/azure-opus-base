import { supabase } from "@/integrations/supabase/client";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams) {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: params,
  });

  if (error) {
    throw new Error(`Email sending failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
