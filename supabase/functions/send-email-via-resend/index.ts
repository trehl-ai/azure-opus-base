import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  reply_to?: string;
  from?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Validate request body
    const body: SendEmailRequest = await req.json();

    if (!body.to?.length || !body.subject || (!body.body_html && !body.body_text)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, and body_html or body_text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Resend API key
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromAddress = body.from || "CRM <noreply@ts-connect.cloud>";

    // Use service role client to insert email_messages (bypasses RLS for system insert)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Insert email_messages record with status 'queued'
    // account_id is null for platform/system emails (Resend is not a personal account)
    const { data: messageRow, error: insertError } = await supabaseAdmin
      .from("email_messages")
      .insert({
        user_id: userId,
        account_id: null,
        provider: "resend",
        from_email: fromAddress,
        to_email: body.to,
        cc_email: body.cc || [],
        bcc_email: body.bcc || [],
        subject: body.subject,
        body_html: body.body_html || null,
        body_text: body.body_text || null,
        status: "queued",
        direction: "outbound",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert email_messages record:", insertError.code);
      return new Response(
        JSON.stringify({ error: "E-Mail konnte nicht protokolliert werden." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = messageRow.id;

    // Send email via Resend
    const resendPayload: Record<string, unknown> = {
      from: fromAddress,
      to: body.to,
      subject: body.subject,
    };
    if (body.cc?.length) resendPayload.cc = body.cc;
    if (body.bcc?.length) resendPayload.bcc = body.bcc;
    if (body.body_html) resendPayload.html = body.body_html;
    if (body.body_text) resendPayload.text = body.body_text;
    if (body.reply_to) resendPayload.reply_to = body.reply_to;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData.statusCode || resendResponse.status);
      await supabaseAdmin
        .from("email_messages")
        .update({
          status: "failed",
          error_message: String(resendData.message || resendData.name || "Resend-Fehler").slice(0, 500),
        })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ error: "E-Mail-Versand fehlgeschlagen." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update message status to sent
    await supabaseAdmin
      .from("email_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        external_message_id: resendData?.id || null,
      })
      .eq("id", messageId);

    return new Response(
      JSON.stringify({ success: true, message_id: messageId, resend_id: resendData?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-email-via-resend:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
