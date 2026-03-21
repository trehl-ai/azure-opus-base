import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export function usePipelines() {
  return useQuery({
    queryKey: queryKeys.pipelines.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function usePipelineStages(pipelineId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pipelines.stages(pipelineId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId!)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!pipelineId,
  });
}
