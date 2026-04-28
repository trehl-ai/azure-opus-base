import { useCallback } from "react";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { supabase } from "@/integrations/supabase/client";

export function useSendEmail() {
  const { getAccessToken } = useMicrosoftAuth();

  const sendEmail = useCallback(async (
    to: string,
    subject: string,
    bodyHtml: string,
  ): Promise<void> => {
    const accessToken = await getAccessToken();

    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: bodyHtml },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || "E-Mail konnte nicht gesendet werden");
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_email_messages").insert({
        user_id: user.id,
        subject,
        body: bodyHtml,
      });
    }
  }, [getAccessToken]);

  return { sendEmail };
}
