-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS vr_fit_score integer,
  ADD COLUMN IF NOT EXISTS vr_hook text,
  ADD COLUMN IF NOT EXISTS org_mission text,
  ADD COLUMN IF NOT EXISTS org_programs text;

COMMENT ON COLUMN public.contacts.vr_fit_score IS 'Viktoria Rebensburg Botschafter-Fit-Score 1-10 (VR Stiftungen Research)';
COMMENT ON COLUMN public.contacts.vr_hook IS 'Konkreter Kooperations-Anknüpfungspunkt (VR Stiftungen Research)';
COMMENT ON COLUMN public.contacts.org_mission IS 'Kernmission der Organisation (VR Stiftungen Research)';
COMMENT ON COLUMN public.contacts.org_programs IS 'Aktuelle Programme/Projekte (VR Stiftungen Research)';

NOTIFY pgrst, 'reload schema';
