import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { format, startOfDay } from "date-fns";

export function useDashboardDeals() {
  return useQuery({
    queryKey: queryKeys.dashboard.deals,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, status, value_amount, won_at, pipeline_stage_id, company_id, pipeline_id, companies:companies!deals_company_id_fkey(name), stage:pipeline_stages!deals_pipeline_stage_id_fkey(name, position)")
        .in("status", ["open", "won"])
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
}

export function useDashboardProjects() {
  return useQuery({
    queryKey: queryKeys.dashboard.projects,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, status");
      if (error) throw error;
      return data;
    },
  });
}

export function useDashboardOverdueTasks() {
  const today = startOfDay(new Date());
  return useQuery({
    queryKey: queryKeys.dashboard.overdueTasks,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, project:projects!tasks_project_id_fkey(title), assigned:users!tasks_assigned_user_id_fkey(first_name, last_name)")
        .neq("status", "done")
        .lt("due_date", format(today, "yyyy-MM-dd"))
        .order("due_date")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
}

export function useDashboardMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dashboard.myTasks(userId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, priority, project:projects!tasks_project_id_fkey(title)")
        .eq("assigned_user_id", userId!)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useDashboardOpenActivities() {
  return useQuery({
    queryKey: queryKeys.dashboard.openActivities,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("deal_id")
        .is("completed_at", null);
      if (error) throw error;
      return new Set(data.map((a) => a.deal_id));
    },
  });
}

export function useDashboardDefaultStages() {
  return useQuery({
    queryKey: queryKeys.dashboard.defaultStages,
    queryFn: async () => {
      const { data: pipeline } = await supabase.from("pipelines").select("id").eq("is_default", true).single();
      if (!pipeline) return [];
      const { data, error } = await supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipeline.id).order("position");
      if (error) throw error;
      return data;
    },
  });
}
