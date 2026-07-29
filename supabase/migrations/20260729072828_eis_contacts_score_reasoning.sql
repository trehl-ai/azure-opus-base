-- applied out-of-band via MCP am 2026-07-29, backfill
-- Quelle: supabase_migrations.schema_migrations, Version 20260729072828
-- md5 des Rumpfs unterhalb dieses Kopfes == DB: 634928c7feb22d48b2207f745699e106

alter table public.eis_contacts add column if not exists score_reasoning text;
comment on column public.eis_contacts.score_reasoning is
  'Begruendung des final_score. Gesetzt beim Nachzug 2026-07-29 fuer Kontakte ohne lead_queue_id (Screenshot-Herkunft), die sonst dauerhaft auf 0 stehen. Gleiche 5-Dimensionen-Skala wie fn_eis_recalculate_score: company_size 0-25, csr_signal 0-25, sponsor_affinity 0-20, decision_maker 0-20, regional_fit 0-10.';;