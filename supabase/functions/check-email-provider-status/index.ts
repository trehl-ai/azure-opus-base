const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check which provider secrets are configured
    const googleReady =
      !!Deno.env.get("GOOGLE_CLIENT_ID") &&
      !!Deno.env.get("GOOGLE_CLIENT_SECRET") &&
      !!Deno.env.get("EMAIL_TOKEN_ENCRYPTION_KEY");

    const outlookReady =
      !!Deno.env.get("MICROSOFT_CLIENT_ID") &&
      !!Deno.env.get("MICROSOFT_CLIENT_SECRET") &&
      !!Deno.env.get("EMAIL_TOKEN_ENCRYPTION_KEY");

    const resendReady = !!Deno.env.get("RESEND_API_KEY");

    return new Response(
      JSON.stringify({
        google: googleReady,
        outlook: outlookReady,
        resend: resendReady,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking provider status:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ google: false, outlook: false, resend: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
