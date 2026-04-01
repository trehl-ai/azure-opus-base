import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<(?:p|div|tr|li|h[1-6])[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/gi, "Ä")
    .replace(/&Ouml;/gi, "Ö")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    console.log("Webhook received, type:", payload?.type);
    console.log("Payload keys:", JSON.stringify(Object.keys(payload?.data ?? {})));

    const data = payload?.data ?? {};

    // 1. Extract metadata from webhook
    const fromEmail = data.from ?? data.sender ?? data.envelope?.from ?? "";
    const toEmail =
      (Array.isArray(data.to) ? data.to.join(", ") : data.to) ??
      (Array.isArray(data.envelope?.to)
        ? data.envelope.to.join(", ")
        : data.envelope?.to) ??
      "";
    const subject = data.subject ?? "";
    const emailId = data.email_id ?? data.id ?? "";

    console.log("email_id:", emailId);
    console.log("from:", typeof fromEmail === "string" ? fromEmail : JSON.stringify(fromEmail));
    console.log("subject:", subject);

    // 2. Extract body directly from webhook payload (Resend inbound delivers html/text inline)
    let bodyText = data.text ?? "";
    let bodyHtml = data.html ?? "";

    console.log("body_text from webhook, length:", bodyText.length);
    console.log("body_html from webhook, length:", bodyHtml.length);

    // 3. If webhook didn't include body, try Resend API as fallback
    if (!bodyText && !bodyHtml && emailId) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          console.log("No body in webhook, trying Resend Receiving API...");
          const res = await fetch(
            `https://api.resend.com/emails/receiving/${emailId}`,
            {
              method: "GET",
              headers: { "Authorization": `Bearer ${resendApiKey}` },
            }
          );
          console.log("Resend API response status:", res.status);
          if (res.ok) {
            const emailData = await res.json();
            bodyText = emailData.text ?? "";
            bodyHtml = emailData.html ?? "";
            console.log("Fallback body_text length:", bodyText.length);
            console.log("Fallback body_html length:", bodyHtml.length);
          } else {
            const errorBody = await res.text();
            console.error("Resend API error:", res.status, errorBody);
          }
        } catch (fetchErr) {
          console.error("Resend API fetch failed:", fetchErr);
        }
      }
    }

    // 4. Build raw_body: prefer text, fall back to HTML→text
    let rawBody = bodyText;
    if (!rawBody && bodyHtml) {
      rawBody = stripHtmlToText(bodyHtml);
      console.log("Converted HTML to text, length:", rawBody.length);
    }

    // 5. Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("intake_messages").insert({
      sender_email: typeof fromEmail === "string" ? fromEmail : JSON.stringify(fromEmail),
      subject,
      raw_body: rawBody || null,
      status: "new",
      received_at: new Date().toISOString(),
      parsed_payload_json: {
        event_type: payload?.type ?? "",
        to_email: toEmail,
        body_html: bodyHtml,
        body_text: bodyText,
        email_id: emailId,
        raw_payload: payload,
      },
    });

    if (error) {
      console.error("DB insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store message" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Intake message stored successfully");
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
