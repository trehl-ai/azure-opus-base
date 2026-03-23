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
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with caller's token to verify identity
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

    // Check caller is admin via users table
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

    // Create admin client with service role key
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      const { email, first_name, last_name, role } = body;

      if (!email || !first_name || !last_name) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if a public user record already exists
      const { data: existingPublicUser } = await adminClient
        .from("users")
        .select("id, is_active, invited_at, password_set_at, onboarding_completed_at")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      const hasCompletedOnboarding = Boolean(
        existingPublicUser?.password_set_at || existingPublicUser?.onboarding_completed_at
      );

      if (existingPublicUser?.is_active && hasCompletedOnboarding) {
        console.error("Invite conflict: public user already active", { email: normalizedEmail });
        return new Response(JSON.stringify({ error: "Benutzer bereits vorhanden" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build redirect URL for password setup
      const originHeader = req.headers.get("origin");
      const refererHeader = req.headers.get("referer");
      let refererOrigin: string | undefined;
      if (refererHeader) {
        try {
          refererOrigin = new URL(refererHeader).origin;
        } catch {
          refererOrigin = undefined;
        }
      }
      const redirectBaseUrl = originHeader || refererOrigin || "";
      const redirectTo = redirectBaseUrl ? `${redirectBaseUrl}/auth/set-password` : undefined;
      console.log("Invite redirectTo:", redirectTo);

      // Invite user via Supabase Auth using service-role admin client
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { first_name, last_name },
        redirectTo,
      });

      if (inviteError) {
        console.error("Invite error:", inviteError);
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const invitedAt = new Date().toISOString();
      const publicUserPayload = {
        email: normalizedEmail,
        first_name,
        last_name,
        role: role || "sales",
        is_active: true,
        invited_at: invitedAt,
      };

      const { error: publicUserError } = existingPublicUser
        ? await adminClient
            .from("users")
            .update(publicUserPayload)
            .eq("id", existingPublicUser.id)
        : await adminClient
            .from("users")
            .insert(publicUserPayload);

      if (publicUserError) {
        console.error("Public user sync error:", publicUserError);
        return new Response(JSON.stringify({ error: "Einladung wurde erstellt, aber der Benutzerdatensatz konnte nicht aktualisiert werden" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: inviteData.user?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id, auth_user_email } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deactivate in users table
      await adminClient
        .from("users")
        .update({ is_active: false, role: "read_only" })
        .eq("id", user_id);

      // Try to find and delete auth user by email
      if (auth_user_email) {
        const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers();
        const authUser = authUsers?.find((u: any) => u.email === auth_user_email);
        if (authUser) {
          await adminClient.auth.admin.deleteUser(authUser.id);
        }
      }

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
    console.error("Error in admin-users:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
