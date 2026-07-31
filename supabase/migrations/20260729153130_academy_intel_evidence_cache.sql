-- 20260729153130_academy_intel_evidence_cache
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 0a044e043a1fb19f103ea6d3eb0b8786 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Beleg-Cache fuer den Academy-Intel-Matcher (WF M520BnD8ZQSmti6z).
-- Die drei Brave-Abfragen (CSR/Engagement/Site-Deep) haengen ausschliesslich an
-- company_name und resolved_domain, nicht am Konzept. Der bestehende Cache greift
-- aber pro (contact_id, concept_slug) -> dieselben Abfragen liefen 3x je Kontakt.
-- Diese Tabelle entkoppelt die Belegsammlung vom Konzept.
create table if not exists public.academy_intel_evidence_cache (
  domain        text        not null,
  company_name  text        not null default '',
  csr           jsonb       not null default '[]'::jsonb,
  engagement    jsonb       not null default '[]'::jsonb,
  site_deep     jsonb       not null default '[]'::jsonb,
  fetched_at    timestamptz not null default now(),
  hits          integer     not null default 0,
  primary key (domain, company_name)
);

comment on table public.academy_intel_evidence_cache is
  'Brave-Belegcache pro (domain, company_name). TTL wird im n8n-Workflow geprueft (30 Tage), nicht hier. Befuellt und gelesen von WF M520BnD8ZQSmti6z.';

-- Strenger als academy_intel (das laeuft ohne RLS und ist fuer anon offen):
-- kein anon/authenticated-Zugriff. service_role umgeht RLS und schreibt weiterhin.
alter table public.academy_intel_evidence_cache enable row level security;
revoke all on public.academy_intel_evidence_cache from anon, authenticated;
grant all on public.academy_intel_evidence_cache to service_role;
