import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FunnelStage = {
  stage: string;
  position: number;
  deals: number;
};

export type StageFeedItem = {
  activity_type: string;
  title: string;
  created_at: string;
  company_name: string;
};

export type ActivityStats = {
  calls_diese_woche: number;
  calls_letzte_woche: number;
  stage_infos_diese_woche: number;
  stage_infos_letzte_woche: number;
  stage_moves_diese_woche: number;
  stage_moves_letzte_woche: number;
  lost_diese_woche: number;
  lost_letzte_woche: number;
  funnel: FunnelStage[];
  stage_feed: StageFeedItem[];
};

export function useActivityStats() {
  const { data, isLoading, error } = useQuery<ActivityStats>({
    queryKey: ["dashboard_activity_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_activity_stats" as never,
      );
      if (error) throw error;
      return data as ActivityStats;
    },
    staleTime: 60_000,
  });

  return { activityStats: data ?? null, loading: isLoading, error };
}
