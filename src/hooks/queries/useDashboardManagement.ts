import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// RLS tables (deals, deal_activities, pipeline_stages) → ALWAYS the session
// `supabase` client, never supabaseEIC (auth.uid()=NULL → 0 rows silently).
// See memory: eoipso_rls_session_client_rule + eslint rule no-supabaseeic-rls.

const WR_PIPELINE_ID = "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e"; // Werteraum - Schulen
const WR_STAGE_TERMINIERT_ID = "6cfd9d0a-cdfa-4048-b711-bf63bd4640b6"; // WR-Stage "Terminiert"

/* ------------------------------------------------------------------ */
/* Gewonnener Umsatz — SUM(value_amount) WHERE status='won'           */
/*                     AND deleted_at IS NULL                          */
/* Soft-deleted Deals werden NICHT mitgezählt → 67 Deals / 1.825 M €. */
/* ------------------------------------------------------------------ */
export interface WonTotal {
  value: number;
  count: number;
}

export function useWonTotal() {
  return useQuery({
    queryKey: ["dashboard", "won_total"],
    queryFn: async (): Promise<WonTotal> => {
      const { data, error } = await (supabase as any)
        .from("deals")
        .select("value_amount")
        .eq("status", "won")
        .is("deleted_at", null);
      if (error) throw error;
      const rows = (data ?? []) as { value_amount: number | null }[];
      return {
        value: rows.reduce((sum, r) => sum + (r.value_amount ?? 0), 0),
        count: rows.length,
      };
    },
    staleTime: 60_000,
  });
}

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
      const [erfasst, angeschrieben, replyRows, termin] = await Promise.all([
        // Schulen erfasst: alle WerteRaum-Deals
        (supabase as any)
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_id", WR_PIPELINE_ID)
          .is("deleted_at", null),
        // Angeschrieben: distinct Deals mit email-Aktivität (parent-count via !inner)
        (supabase as any)
          .from("deals")
          .select("id, deal_activities!inner(id)", { count: "exact", head: true })
          .eq("pipeline_id", WR_PIPELINE_ID)
          .is("deleted_at", null)
          .eq("deal_activities.activity_type", "email"),
        // Geantwortet: distinct contact_id mit email_reply (client-seitig dedupliziert)
        (supabase as any)
          .from("deal_activities")
          .select("contact_id, deals!inner(pipeline_id)")
          .eq("deals.pipeline_id", WR_PIPELINE_ID)
          .eq("activity_type", "email_reply"),
        // Termin: WerteRaum-Deals in Stage "Terminiert"
        (supabase as any)
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_id", WR_PIPELINE_ID)
          .eq("pipeline_stage_id", WR_STAGE_TERMINIERT_ID)
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
