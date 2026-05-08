import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PipelineBreakdownItem = {
  name: string;
  deal_count: number;
  total_value: number;
};

export type HoverCompanyValue = {
  company_name: string;
  pipeline_name: string;
  total_value: number;
  deal_count: number;
};

export type HoverCompanyExpected = {
  company_name: string;
  pipeline_name: string;
  expected_value: number;
  avg_probability: number;
  deal_count: number;
};

export type DashboardStats = {
  pipeline_value: number;
  won_value: number;
  deal_count: number;
  avg_probability: number;
  weighted_probability: number;
  expected_value: number;
  contact_count: number;
  company_count: number;
  hot_leads: number;
  warm_leads: number;
  medium_leads: number;
  cold_leads: number;
  pipeline_breakdown: PipelineBreakdownItem[];
  hover_pipeline_companies?: HoverCompanyValue[];
  hover_won_companies?: HoverCompanyValue[];
  hover_probability_companies?: HoverCompanyExpected[];
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
