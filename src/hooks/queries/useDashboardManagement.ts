import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// RLS tables (deals, deal_activities, pipeline_stages) → ALWAYS the session
// `supabase` client, never supabaseEIC (auth.uid()=NULL → 0 rows silently).
// See memory: eoipso_rls_session_client_rule + eslint rule no-supabaseeic-rls.

export const WR_PIPELINE_ID = "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e"; // Werteraum - Schulen
// Kampagne "VR Fit & Aktiv — Schulen": ihre campaigns.pipeline_id gehoert zum Schul-Funnel
// (Baustufe 2h, wie get_activity_stats seit 2g-D2). Heute = WR, nach dem Umzug = VRS.
const FUA_CAMPAIGN_ID = "11da18f2-9ea8-4950-9d2a-42416f0aef39";

/* ------------------------------------------------------------------ */
/* Gewonnener Umsatz                                                   */
/* Frueher: useWonTotal() holte alle won-Zeilen und summierte im       */
/* Browser. Das ist an der 1000-Zeilen-Kappung von PostgREST vorbei    */
/* nicht sicher und kannte weder Pipeline- noch Jahresfilter.          */
/* Jetzt: won_value / won_deal_count kommen aus get_dashboard_stats.   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Maschinen-Banner — Live-Counter der Akquise-Aktivität              */
/* ------------------------------------------------------------------ */
export interface MachineStats {
  mails: number;
  activities: number;
  calls: number;
  termine: number;
}

export function useMachineStats() {
  return useQuery({
    queryKey: ["dashboard", "machine_stats"],
    queryFn: async (): Promise<MachineStats> => {
      const [mails, activities, calls, termine] = await Promise.all([
        (supabase as any)
          .from("deal_activities")
          .select("id", { count: "exact", head: true })
          .eq("activity_type", "email"),
        (supabase as any)
          .from("deal_activities")
          .select("id", { count: "exact", head: true }),
        (supabase as any)
          .from("deal_activities")
          .select("id", { count: "exact", head: true })
          .eq("activity_type", "call"),
        // deals JOIN pipeline_stages WHERE name ILIKE '%terminiert%' (alle Pipelines)
        (supabase as any)
          .from("deals")
          .select("id, pipeline_stages!inner(name)", { count: "exact", head: true })
          .is("deleted_at", null)
          .ilike("pipeline_stages.name", "%terminiert%"),
      ]);
      for (const r of [mails, activities, calls, termine]) {
        if (r.error) throw r.error;
      }
      return {
        mails: mails.count ?? 0,
        activities: activities.count ?? 0,
        calls: calls.count ?? 0,
        termine: termine.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ */
/* WerteRaum-Funnel — kumulativ (kalt → Gespräch), absteigend         */
/* ------------------------------------------------------------------ */
export interface FunnelStep {
  label: string;
  value: number;
}

export function useWerteraumFunnel() {
  return useQuery({
    queryKey: ["dashboard", "werteraum_funnel"],
    queryFn: async (): Promise<FunnelStep[]> => {
      // Schul-Pipelines: WerteRaum + Pipeline der F&A-Kampagne (heute identisch mit WR).
      // Stufe "Terminiert" ueber den Namen je Pipeline statt fester WR-ID.
      const kampagne = await (supabase as any)
        .from("campaigns")
        .select("pipeline_id")
        .eq("id", FUA_CAMPAIGN_ID)
        .maybeSingle();
      if (kampagne.error) throw kampagne.error;
      const pipelineIds = Array.from(
        new Set([WR_PIPELINE_ID, kampagne.data?.pipeline_id].filter(Boolean)),
      ) as string[];

      const terminStufen = await (supabase as any)
        .from("pipeline_stages")
        .select("id")
        .in("pipeline_id", pipelineIds)
        .eq("name", "Terminiert");
      if (terminStufen.error) throw terminStufen.error;
      const terminStufenIds = ((terminStufen.data ?? []) as { id: string }[]).map((r) => r.id);

      const [erfasst, angeschrieben, replyRows, termin] = await Promise.all([
        // Schulen erfasst: alle Deals der Schul-Pipelines
        (supabase as any)
          .from("deals")
          .select("id", { count: "exact", head: true })
          .in("pipeline_id", pipelineIds)
          .is("deleted_at", null),
        // Angeschrieben: distinct Deals mit email-Aktivität (parent-count via !inner)
        (supabase as any)
          .from("deals")
          .select("id, deal_activities!inner(id)", { count: "exact", head: true })
          .in("pipeline_id", pipelineIds)
          .is("deleted_at", null)
          .eq("deal_activities.activity_type", "email"),
        // Geantwortet: distinct contact_id mit email_reply (client-seitig dedupliziert)
        (supabase as any)
          .from("deal_activities")
          .select("contact_id, deals!inner(pipeline_id)")
          .in("deals.pipeline_id", pipelineIds)
          .eq("activity_type", "email_reply"),
        // Termin: Deals der Schul-Pipelines in deren Stufe "Terminiert"
        (supabase as any)
          .from("deals")
          .select("id", { count: "exact", head: true })
          .in("pipeline_id", pipelineIds)
          .in("pipeline_stage_id", terminStufenIds)
          .is("deleted_at", null),
      ]);
      for (const r of [erfasst, angeschrieben, replyRows, termin]) {
        if (r.error) throw r.error;
      }
      const replyContacts = new Set(
        ((replyRows.data ?? []) as { contact_id: string | null }[])
          .map((r) => r.contact_id)
          .filter(Boolean),
      );
      return [
        { label: "Schulen erfasst", value: erfasst.count ?? 0 },
        { label: "Angeschrieben", value: angeschrieben.count ?? 0 },
        { label: "Geantwortet", value: replyContacts.size },
        { label: "Termin", value: termin.count ?? 0 },
      ];
    },
    staleTime: 60_000,
  });
}
