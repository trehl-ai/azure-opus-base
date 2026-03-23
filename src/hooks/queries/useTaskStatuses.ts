import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskStatus {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
  is_default: boolean;
  color: string | null;
  created_at: string;
}

export function useTaskStatuses(includeInactive = false) {
  return useQuery({
    queryKey: ["task-statuses", includeInactive],
    queryFn: async () => {
      let q = supabase
        .from("task_statuses" as any)
        .select("*")
        .order("position", { ascending: true });
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as TaskStatus[];
    },
  });
}

/** Build a slug→label map for quick lookups */
export function useTaskStatusMap(includeInactive = false) {
  const query = useTaskStatuses(includeInactive);
  const map: Record<string, string> = {};
  query.data?.forEach((s) => { map[s.slug] = s.name; });
  return { ...query, statusMap: map };
}
