import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Resend sends different event structures; handle both flat and nested
    const eventType = payload?.type ?? payload?.event?.type ?? "";
    const data = payload?.data ?? payload?.event?.data ?? payload;

    // Extract fields from Resend inbound payload
    const fromEmail =
      data.from ??
      data.sender ??
      data.envelope?.from ??
      "";
    const toEmail =
      (Array.isArray(data.to) ? data.to.join(", ") : data.to) ??
      (Array.isArray(data.envelope?.to)
        ? data.envelope.to.join(", ")
        : data.envelope?.to) ??
      "";
    const subject = data.subject ?? "";
    const bodyHtml = data.html ?? "";
    const bodyText = data.text ?? "";

    // Build raw_body: prefer text, fall back to html
    const rawBody = bodyText || bodyHtml || "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("intake_messages").insert({
      sender_email: typeof fromEmail === "string" ? fromEmail : JSON.stringify(fromEmail),
      subject: subject,
      raw_body: rawBody,
      status: "pending",
      received_at: new Date().toISOString(),
      parsed_payload_json: {
        event_type: eventType,
        to_email: toEmail,
        body_html: bodyHtml,
        body_text: bodyText,
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
