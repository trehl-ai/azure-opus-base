import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MainProject {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export function useMainProjects(onlyActive = true) {
  return useQuery<MainProject[]>({
    queryKey: ["main-projects", onlyActive],
    queryFn: async () => {
      let q = supabase
        .from("main_projects" as any)
        .select("*")
        .order("name");
      if (onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MainProject[];
    },
  });
}
