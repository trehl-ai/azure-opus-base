import { useCallback } from "react";
import { sendOutlookEmailViaGraph } from "@/lib/sendOutlookEmail";
import { supabase } from "@/integrations/supabase/client";

export function useSendEmail() {
  const sendEmail = useCallback(async (
    to: string,
    subject: string,
    bodyHtml: string,
  ): Promise<void> => {
    const result = await sendOutlookEmailViaGraph({
      to: [to],
      subject,
      bodyHtml,
    });

    if (!result.success) {
      throw new Error(result.error || "E-Mail konnte nicht gesendet werden");
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_email_messages").insert({
        user_id: user.id,
        subject,
        body: bodyHtml,
      });
    }
  }, []);

  return { sendEmail };
}
