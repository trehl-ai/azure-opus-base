-- 01.09.2026, Anforderung Thomas Timmer: Ueberblick, welche Umsaetze zu welchem
-- Jahr gehoeren. Entscheidung TT: Massgeblich ist die LEISTUNGSERBRINGUNG,
-- nicht der Auftragseingang.
-- Bewusst NICHT event_start_date genannt: 23 von 159 Deals in Corporate Events /
-- Erlebniswelten / Ausschreibungen sind Konzepte, Feinkonzepte, Nachbestellungen
-- oder Beratung ohne eigenen Veranstaltungstermin.
-- Reporting-Regel: Umsatzjahr = Jahr von service_start_date.
-- won_at wird NICHT mehr als Umsatzanker verwendet.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date   date;

COMMENT ON COLUMN public.deals.service_start_date IS
  'Beginn der Leistungserbringung (Veranstaltungstag oder Lieferdatum). Massgeblich fuer die Jahreszuordnung des Umsatzes.';
COMMENT ON COLUMN public.deals.service_end_date IS
  'Ende der Leistungserbringung. Bei eintaegigen Leistungen gleich service_start_date.';

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_service_zeitraum_plausibel;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_service_zeitraum_plausibel
  CHECK (
    service_end_date IS NULL
    OR service_start_date IS NULL
    OR service_end_date >= service_start_date
  );

CREATE INDEX IF NOT EXISTS idx_deals_service_start_date
  ON public.deals (service_start_date)
  WHERE deleted_at IS NULL;
