import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PipelineBreakdownItem = {
  name: string;
  deal_count: number;
  total_value: number;
};

export type DashboardStats = {
  pipeline_value: number;
  won_value: number;
  deal_count: number;
  avg_probability: number;
  contact_count: number;
  company_count: number;
  hot_leads: number;
  warm_leads: number;
  medium_leads: number;
  cold_leads: number;
  pipeline_breakdown: PipelineBreakdownItem[];
};

export function useDashboardStats() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["dashboard_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_dashboard_stats" as never,
      );
      if (error) throw error;
      return data as DashboardStats;
    },
    staleTime: 60_000,
  });

  return { stats: data ?? null, loading: isLoading, error };
}
