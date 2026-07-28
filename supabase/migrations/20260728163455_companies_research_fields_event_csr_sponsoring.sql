-- Backfill. Applied out-of-band via MCP am 2026-07-28.
-- Diese Datei re-applied nichts Neues; sie holt die bereits live in ttgvhqygmgtnjgwunuwz
-- angewendete Migration in das Repo nach, damit CI drift-check gruen bleibt.
-- Quelle: supabase_migrations.schema_migrations, version 20260728163455 (verbatim).

-- Firmen-Research fuer den Ideen-Matcher: Event-, CSR-, Sponsoring- und Agentur-Signale.
-- Ebene bewusst companies statt contacts: Firmenattribute auf Kontakten fuehren zu
-- mehrfacher Recherche und divergierenden Staenden (BMW hat 5 Kontakte).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS research_dossier        text,
  ADD COLUMN IF NOT EXISTS research_findings       jsonb,
  ADD COLUMN IF NOT EXISTS incumbent_agencies      text[],
  ADD COLUMN IF NOT EXISTS event_signal_score      integer,
  ADD COLUMN IF NOT EXISTS csr_signal_score        integer,
  ADD COLUMN IF NOT EXISTS sponsoring_signal_score integer,
  ADD COLUMN IF NOT EXISTS concept_matches         jsonb,
  ADD COLUMN IF NOT EXISTS pitch_angle             text,
  ADD COLUMN IF NOT EXISTS research_status         text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS research_error          text,
  ADD COLUMN IF NOT EXISTS last_research_at        timestamptz;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_research_status_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_research_status_chk
  CHECK (research_status IS NULL OR research_status IN ('pending','running','done','failed','skipped'));

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_signal_scores_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_signal_scores_chk
  CHECK (
    (event_signal_score      IS NULL OR event_signal_score      BETWEEN 0 AND 100) AND
    (csr_signal_score        IS NULL OR csr_signal_score        BETWEEN 0 AND 100) AND
    (sponsoring_signal_score IS NULL OR sponsoring_signal_score BETWEEN 0 AND 100)
  );

CREATE INDEX IF NOT EXISTS idx_companies_research_status
  ON public.companies (research_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_event_signal
  ON public.companies (event_signal_score DESC) WHERE deleted_at IS NULL AND event_signal_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_incumbent_agencies
  ON public.companies USING gin (incumbent_agencies);
CREATE INDEX IF NOT EXISTS idx_companies_research_findings
  ON public.companies USING gin (research_findings);
CREATE INDEX IF NOT EXISTS idx_companies_concept_matches
  ON public.companies USING gin (concept_matches);

COMMENT ON COLUMN public.companies.research_findings IS
'Strukturierte Rechercheergebnisse. Schema:
{
  "events": [{"titel":"Mitarbeiterfest 2024","jahr":2024,"typ":"mitarbeiterfest",
              "agentur":"streuplan","url":"https://...","teilnehmer":null}],
  "csr":    {"schwerpunkte":["Gesundheit","Soziales"],"bericht_url":"https://...",
             "jahr":2025,"zitat":"kurzer Beleg"},
  "sponsoring": [{"objekt":"...","kategorie":"Sport","laufzeit":"2024-2026","url":"https://..."}],
  "quellen": [{"url":"https://...","achse":"event|csr|sponsoring|agentur","abgerufen":"2026-07-28"}]
}';

COMMENT ON COLUMN public.companies.incumbent_agencies IS
'Agenturen, die nachweislich bereits fuer diese Firma gearbeitet haben. Wettbewerbsbeleg UND Kaufsignal: wer schon einmal eine Agentur beauftragt hat, kauft Events ein. Beispiel Helsana -> streuplan (Mitarbeiterfest).';

COMMENT ON COLUMN public.companies.event_signal_score IS
'0-100. Belegte Event-Aktivitaet: wiederkehrende Formate und juengere Nachweise zaehlen hoeher als einmalige oder alte.';

COMMENT ON COLUMN public.companies.concept_matches IS
'[{"slug":"academy-of-stars","score":82,"rationale":"kurz","evidence_url":"https://..."}] - Treffer gegen den Ideen-Matcher.';