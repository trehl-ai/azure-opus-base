import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerAuth }, error: authError } = await anonClient.auth.getUser();
    if (authError || !callerAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: callerUser } = await anonClient
      .from("users")
      .select("role")
      .eq("email", callerAuth.email!)
      .maybeSingle();

    if (!callerUser || callerUser.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action } = await req.json();

    if (action === "delete_test_data") {
      // Delete in correct FK order
      await adminClient.from("task_comments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("deal_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("entity_tags").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("company_contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      // Clear FKs on deals before deleting
      await adminClient.from("deals").update({ company_id: null, primary_contact_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("projects").update({ company_id: null, primary_contact_id: null, originating_deal_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      
      await adminClient.from("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("deals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("companies").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_all") {
      // Delete everything including imports, intake, tags, settings, users
      await adminClient.from("task_comments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("deal_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("entity_tags").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("company_contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("import_rows").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("import_jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      await adminClient.from("intake_messages").update({ created_company_id: null, created_contact_id: null, created_deal_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("deals").update({ company_id: null, primary_contact_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("projects").update({ company_id: null, primary_contact_id: null, originating_deal_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      
      await adminClient.from("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("deals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("companies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("intake_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("tags").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("workspace_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in danger-zone:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
