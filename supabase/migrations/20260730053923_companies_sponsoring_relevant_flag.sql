-- 20260730053923_companies_sponsoring_relevant_flag
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 308803a5aeae7e5663c942665fdc825a verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Dauerhafte Kennzeichnung statt verstreuter Regex.
-- Bisher baute jedes Skript seine eigene Schul-Erkennung nach (z. B. SCHOOL in
-- scripts/t34_score_and_embed.py). Die Regex ist nachweislich loechrig: 'Schulcampus'
-- und 'Schulamt' enthalten die Zeichenfolge 'schule' nicht, 'Kopernikus GS' und
-- 'GMS Neustift' passen auf kein Muster. Einmal in der DB entschieden gilt fuer alle.
alter table public.companies
  add column if not exists sponsoring_relevant boolean not null default true,
  add column if not exists exclusion_reason text;

comment on column public.companies.sponsoring_relevant is
  'false = kommt als Sponsoring-/Programm-Partner nicht in Frage. Massgeblich fuer Scoring, Embedding und alle Ziellisten - Vorrang vor jeder Namens-Heuristik im Code.';

create index if not exists companies_sponsoring_relevant_idx
  on public.companies (sponsoring_relevant) where sponsoring_relevant = false;
