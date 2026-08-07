import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PipelineBreakdownItem = {
  name: string;
  deal_count: number;
  total_value: number;
  weighted_value: number;
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
  /** Summe der OFFENEN Deals, alle Jahre. */
  pipeline_value: number;
  /** Summe der gewonnenen Deals im Jahresfenster (won_at). */
  won_value: number;
  won_deal_count: number;
  /** Anzahl der OFFENEN Deals. */
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
  /** Jahr, auf das die Gewonnen-Zahlen gefiltert sind (null = alle Jahre). */
  won_year: number | null;
  /** Vergleich ueber alle Pipelines — folgt bewusst NICHT dem Umschalter. */
  pipeline_breakdown: PipelineBreakdownItem[];
  hover_pipeline_companies?: HoverCompanyValue[];
  hover_won_companies?: HoverCompanyValue[];
  hover_probability_companies?: HoverCompanyExpected[];
};

/**
 * Kacheln + Lead-Score-Verteilung der Startseite.
 *
 * @param pipelineId  Pipeline-Filter; null = Gesamt (kein Filter).
 * @param wonYear     Jahr fuer die Gewonnen-Kachel (won_at); null = alle Jahre.
 *
 * Aggregiert wird komplett in der RPC. Ein Client-seitiges SUM ueber die Deals
 * waere falsch: PostgREST liefert stillschweigend nur 1000 Zeilen, allein die
 * offenen Deals sind bereits ueber 3.200.
 */
export function useDashboardStats(
  pipelineId: string | null,
  wonYear: number | null,
) {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["dashboard_stats", pipelineId, wonYear],
    queryFn: async () => {
      // as-any-Cast: generierte types.ts kennt die neue Signatur (noch) nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_dashboard_stats", {
        p_pipeline_id: pipelineId,
        p_won_year: wonYear,
      });
      if (error) throw error;
      return data as DashboardStats;
    },
    staleTime: 60_000,
  });

  return { stats: data ?? null, loading: isLoading, error };
}
