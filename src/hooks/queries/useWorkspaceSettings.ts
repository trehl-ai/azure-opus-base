import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: queryKeys.workspaceSettings.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_settings")
        .select("*");
      if (error) throw error;
      // Convert to key-value map
      const settings: Record<string, string> = {};
      data?.forEach((s) => {
        settings[s.key] = s.value ?? "";
      });
      return settings;
    },
  });
}
