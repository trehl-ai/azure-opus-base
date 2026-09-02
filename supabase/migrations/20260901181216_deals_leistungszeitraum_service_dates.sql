-- 01.09.2026, Anforderung Thomas Timmer: Ueberblick, welche Umsaetze zu welchem
-- Jahr gehoeren. Entscheidung TT: Massgeblich ist die LEISTUNGSERBRINGUNG,
-- nicht der Auftragseingang.
--
-- Bewusst NICHT event_start_date genannt: gemessen 23 von 159 Deals in
-- Corporate Events / Erlebniswelten / Ausschreibungen sind Konzepte,
-- Feinkonzepte, Nachbestellungen oder Beratung ohne eigenen
-- Veranstaltungstermin (14 davon gewonnen, 302.650 EUR). Ein Feld namens
-- event_* wuerde dort falsch verstanden und falsch befuellt.
--
-- Reporting-Regel: Umsatzjahr = Jahr von service_start_date.
-- won_at wird ausdruecklich NICHT mehr als Umsatzanker verwendet — es traegt
-- zwei Bedeutungen (nachgetragenes Jahresende bei Excel-Altdeals vs.
-- Zeitpunkt des Stage-Wechsels bei neuen Deals).
-- Keine periodengerechte Abgrenzung ueber den Jahreswechsel: ein Vorgang
-- zaehlt vollstaendig in sein Startjahr. service_end_date ist vorhanden,
-- falls das spaeter anders ausgewertet werden soll.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date   date;

COMMENT ON COLUMN public.deals.service_start_date IS
  'Beginn der Leistungserbringung (Veranstaltungstag oder Lieferdatum). Massgeblich fuer die Jahreszuordnung des Umsatzes.';
COMMENT ON COLUMN public.deals.service_end_date IS
  'Ende der Leistungserbringung. Bei eintaegigen Leistungen gleich service_start_date.';

-- Reihenfolge erzwingen. Kein Prompt, kein UI-Hinweis: was garantiert sein
-- muss, gehoert in die Datenbank. NULL-Werte bleiben zulaessig, damit
-- unvollstaendige Datensaetze weiter gespeichert werden koennen.
ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_service_zeitraum_plausibel;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_service_zeitraum_plausibel
  CHECK (
    service_end_date IS NULL
    OR service_start_date IS NULL
    OR service_end_date >= service_start_date
  );

-- Auswertungen laufen ueber das Startdatum, gefiltert auf nicht geloeschte Deals.
CREATE INDEX IF NOT EXISTS idx_deals_service_start_date
  ON public.deals (service_start_date)
  WHERE deleted_at IS NULL;