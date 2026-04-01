import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Calculate tomorrow's date range (UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    // Find tasks due tomorrow that haven't been reminded
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id, title, due_date, assigned_user_id,
        project:projects!tasks_project_id_fkey(title)
      `)
      .eq("due_date", tomorrowStr)
      .eq("reminder_sent", false)
      .not("status", "eq", "done")
      .not("assigned_user_id", "is", null);

    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders to send", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect unique user IDs
    const userIds = [...new Set(tasks.map((t: any) => t.assigned_user_id))];
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    if (usersError) throw usersError;

    const userMap = new Map(users?.map((u: any) => [u.id, u]) ?? []);

    let sentCount = 0;
    const errors: string[] = [];

    const appUrl = "https://azure-opus-base.lovable.app";

    for (const task of tasks) {
      const user = userMap.get(task.assigned_user_id);
      if (!user || !user.email) {
        errors.push(`No email for user ${task.assigned_user_id}`);
        continue;
      }

      const project = task.project as { title: string } | null;
      const dueDateFormatted = new Date(task.due_date + "T00:00:00").toLocaleDateString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hallo ${user.first_name},</p>
          <p>dieser Task ist morgen fällig:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0;">📋 <strong>${task.title}</strong></td></tr>
            ${project ? `<tr><td style="padding: 8px 0;">📁 Projekt: ${project.title}</td></tr>` : ""}
            <tr><td style="padding: 8px 0;">📅 Fällig am: ${dueDateFormatted}</td></tr>
          </table>
          <p><a href="${appUrl}/tasks" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Task öffnen</a></p>
          <p style="margin-top: 24px;">Mit freundlichen Grüßen<br/>eo ipso Boost</p>
        </div>
      `;

      // Send via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "eo ipso Boost <noreply@ts-connect.cloud>",
          to: [user.email],
          subject: `Erinnerung: ${task.title} ist morgen fällig`,
          html,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        errors.push(`Resend error for task ${task.id}: ${errBody}`);
        continue;
      }

      // Mark reminder as sent
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ reminder_sent: true })
        .eq("id", task.id);

      if (updateError) {
        errors.push(`Update error for task ${task.id}: ${updateError.message}`);
      } else {
        sentCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} reminders`, sentCount, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
