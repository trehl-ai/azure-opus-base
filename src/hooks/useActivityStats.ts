import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FunnelKwBucket = {
  kw_label: string;
  zu_wiedervorlage: number;
  zu_infos: number;
  zu_lost: number;
  zu_terminiert: number;
};

export type FunnelBestandStage = {
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
  kw_nr_diese: number;
  kw_nr_letzte: number;
  calls_diese_woche: number;
  calls_letzte_woche: number;
  stage_infos_diese_kw: number;
  stage_wiedervorlage_diese_kw: number;
  lost_diese_kw: number;
  stage_infos_letzte_kw: number;
  stage_wiedervorlage_letzte_kw: number;
  lost_letzte_kw: number;
  funnel_kw: FunnelKwBucket[];
  funnel_bestand: FunnelBestandStage[];
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
