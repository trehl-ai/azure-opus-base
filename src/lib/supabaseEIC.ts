// Dedicated Supabase client for the EIC (eo ipso connect) project — used ONLY
// by the Campaigns pages. Do NOT use for any other feature; the main app uses
// `@/integrations/supabase/client`.
import { createClient } from "@supabase/supabase-js";

const EIC_SUPABASE_URL = "https://ttgvhqygmgtnjgwunuwz.supabase.co";
const EIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3ZocXlnbWd0bmpnd3VudXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDE3MTQsImV4cCI6MjA5MjUxNzcxNH0.be9sR4ayWvHROA9CL_GRroDXorsJ_6dz07crZSUnlP8";

export const supabaseEIC = createClient(EIC_SUPABASE_URL, EIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "sb-eic-auth",
  },
});

export type OutreachStats = {
  gesamt: number;
  pending: number;
  email_sent: number;
  link_clicked: number;
  replied: number;
  terminated: number;
  cluster_a: number;
  cluster_b: number;
  cluster_c: number;
  cluster_d: number;
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
