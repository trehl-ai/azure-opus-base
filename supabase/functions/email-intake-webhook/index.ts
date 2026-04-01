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

async function fetchEmailFromResend(emailId: string, apiKey: string): Promise<{ text: string; html: string } | null> {
  try {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.error(`Resend API error: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    return {
      text: data.text ?? "",
      html: data.html ?? "",
    };
  } catch (err) {
    console.error("Failed to fetch email from Resend API:", err);
    return null;
  }
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

    const eventType = payload?.type ?? payload?.event?.type ?? "";
    const data = payload?.data ?? payload?.event?.data ?? payload;

    const fromEmail =
      data.from ?? data.sender ?? data.envelope?.from ?? "";
    const toEmail =
      (Array.isArray(data.to) ? data.to.join(", ") : data.to) ??
      (Array.isArray(data.envelope?.to)
        ? data.envelope.to.join(", ")
        : data.envelope?.to) ??
      "";
    const subject = data.subject ?? "";

    // Extract email_id to fetch full content from Resend API
    const emailId = data.email_id ?? data.id ?? "";

    let bodyText = data.text ?? "";
    let bodyHtml = data.html ?? "";

    // If we have an email_id but no body content, fetch from Resend API
    if (emailId && (!bodyText && !bodyHtml)) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        console.log(`Fetching full email content from Resend API for: ${emailId}`);
        const fullEmail = await fetchEmailFromResend(emailId, resendApiKey);
        if (fullEmail) {
          bodyText = fullEmail.text;
          bodyHtml = fullEmail.html;
          console.log(`Resend API: text=${bodyText.length} chars, html=${bodyHtml.length} chars`);
        }
      } else {
        console.warn("RESEND_API_KEY not set, cannot fetch full email content");
      }
    }

    // Build raw_body: prefer text, fall back to HTML→text conversion
    let rawBody = bodyText || "";
    if (!rawBody && bodyHtml) {
      rawBody = stripHtmlToText(bodyHtml);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("intake_messages").insert({
      sender_email: typeof fromEmail === "string" ? fromEmail : JSON.stringify(fromEmail),
      subject: subject,
      raw_body: rawBody,
      status: "new",
      received_at: new Date().toISOString(),
      parsed_payload_json: {
        event_type: eventType,
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
