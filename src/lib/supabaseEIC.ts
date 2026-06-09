// ⚠️ DEPRECATED MODULE — kept only for backwards-compatible imports.
// There is exactly ONE Supabase client in this app: `@/integrations/supabase/client`.
// This file re-exports that single authenticated client (as `supabaseEIC`) plus
// shared TypeScript types. Do NOT instantiate another Supabase client here or
// anywhere else — using an anon/secondary client breaks RLS
// (auth.uid() = NULL → 401 / 0 rows).
import { supabase } from "@/integrations/supabase/client";

export const supabaseEIC = supabase;

export type OutreachStats = {
  gesamt: number;
  pending: number;
  email_sent: number;
  link_clicked: number;
  replied: number;
  terminated: number;
  /** Real opt-outs only (Abmeldung / unsubscribe). Distinct from `terminated`. */
  opt_out: number;
  /** Contacts moved to "Terminiert" before any mail went out — NOT opt-outs. */
  terminated_before_mailing: number;
  cluster_a: number;
  cluster_b: number;
  cluster_c: number;
  cluster_d: number;
};

export type VrStiftungenCandidateRow = {
  contact_id: string;
  deal_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  vr_hook: string | null;
  vr_fit_score: number | null;
  org_mission: string | null;
  outreach_status: string | null;
};

export type WerteraumOutreachRow = {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  anrede: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_name: string | null;
  stage: string | null;
  outreach_score: number | null;
  outreach_cluster: string | null;
  outreach_hook: string | null;
  outreach_email_draft: string | null;
  outreach_status: string | null;
  lead_score_details: unknown;
  schneeball_asked_at: string | null;
  schneeball_referrals: unknown;
  webinar_invited_at: string | null;
  webinar_attended_at: string | null;
  deal_id: string | null;
  value_amount: number | null;
};
