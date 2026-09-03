-- 03.09.2026: Kampagnen als eigene Entitaet, fuer die Uebersichtskacheln.
--
-- ANLASS: Anforderung Tomi, abgeleitet aus der Vertriebsboost-Masterliste von TT.
-- Neun Kampagnenlinien, segmentiert nach live / vorbereitung / backlog, je Kachel
-- angeschrieben / ausstehend / Auftraege.
--
-- ENTSCHEIDENDE MODELLFRAGE, von Tomi geklaert:
-- WerteRaum 3.0 und VR Fit & Aktiv zielen auf DENSELBEN Verteiler (1.118
-- weiterfuehrende Schulen), mit zwei Monaten Abstand. Eine Kampagne ist damit
-- KEINE Aufteilung der Zielgruppe, sondern eine WELLE ueber sie. Dieselbe Schule
-- zaehlt in beiden Kampagnen — das ist die Absicht, kein Fehler.
--
-- FOLGE FUER DAS MODELL:
--   Zielgruppe   = Regel (pipeline + segment + bundesland), mehrere Kampagnen
--                  duerfen dieselbe Regel tragen
--   angeschrieben = wer hat die Mail DIESER Kampagne bekommen
--                  -> braucht einen Kampagnenstempel auf der Aktivitaet
--   ausstehend    = Zielgruppe minus angeschrieben DIESER Kampagne
--
-- WARUM REGEL UND NICHT campaign_id AUF deals:
-- Eine Spalte an deals muesste fuer 4.197 Datensaetze rueckwirkend gefuellt und
-- von fuenf n8n-Importwegen mitgesetzt werden. Die Regel liest dieselben Felder,
-- die der Versand schon benutzt, und braucht keinen Backfill.
-- Der Stempel gehoert dagegen an die AKTIVITAET, weil dort die Welle entsteht.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  phase         text NOT NULL,
  sortierung    integer NOT NULL DEFAULT 0,
  -- Zielgruppenregel
  pipeline_id   uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  segmente      text[],
  bundesland_modus text NOT NULL DEFAULT 'alle',
  bundeslaender text[],
  -- Verwaltung
  verantwortlich  text,
  konzept_slug    text,
  utm_praefix     text,
  notiz           text,
  aktiv         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_phase_gueltig
    CHECK (phase IN ('live','vorbereitung','backlog')),
  CONSTRAINT campaigns_bundesland_modus_gueltig
    CHECK (bundesland_modus IN ('alle','nur','ausser')),
  -- Bei 'nur' und 'ausser' muss die Liste gefuellt sein, sonst ist die Regel leer
  CONSTRAINT campaigns_bundeslaender_konsistent
    CHECK (
      bundesland_modus = 'alle'
      OR (bundeslaender IS NOT NULL AND array_length(bundeslaender, 1) > 0)
    )
);

COMMENT ON TABLE public.campaigns IS
  'Kampagnenlinien fuer die Uebersichtskacheln. Eine Kampagne ist eine WELLE ueber eine Zielgruppe, keine Aufteilung — mehrere Kampagnen duerfen dieselbe Regel tragen (z.B. WerteRaum 3.0 und Fit & Aktiv auf denselben 1.118 weiterfuehrenden Schulen, zwei Monate versetzt).';
COMMENT ON COLUMN public.campaigns.segmente IS
  'NULL = alle Segmente der Pipeline. Sonst Liste, z.B. {grundschule} oder {weiterfuehrend,beruflich,foerderschule}.';
COMMENT ON COLUMN public.campaigns.bundesland_modus IS
  'alle = kein Bundeslandfilter. nur = ausschliesslich die genannten. ausser = alle ausser den genannten.';

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaigns FROM PUBLIC;
REVOKE ALL ON public.campaigns FROM anon;
GRANT SELECT ON public.campaigns TO authenticated;
GRANT INSERT, UPDATE ON public.campaigns TO authenticated;

DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS campaigns_write ON public.campaigns;
CREATE POLICY campaigns_write ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (public.can_write_deals());

DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
CREATE POLICY campaigns_update ON public.campaigns
  FOR UPDATE TO authenticated USING (public.can_write_deals())
  WITH CHECK (public.can_write_deals());

-- Kein DELETE: eine Kampagne mit Historie wird auf aktiv=false gesetzt,
-- nicht geloescht — sonst verlieren die Aktivitaeten ihren Bezug.

CREATE INDEX IF NOT EXISTS idx_campaigns_phase
  ON public.campaigns (phase, sortierung) WHERE aktiv;

-- Der Kampagnenstempel gehoert an die AKTIVITAET, nicht an den Deal.
-- sequence_type existiert bereits, ist aber bei ALLEN 1.650 Mails NULL und damit
-- unbenutzt; metadata ist ein Sammelbecken mit drei Fremdbedeutungen
-- (sender_email, lookup_path, owner_moved_reason). Deshalb eine eigene Spalte
-- mit Fremdschluessel — ein FK verhindert Tippfehler, jsonb nicht.
ALTER TABLE public.deal_activities
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deal_activities.campaign_id IS
  'Kampagne, zu der diese Aktivitaet gehoert. Massgeblich fuer "angeschrieben" je Kampagne. NULL bei manuellen Aktivitaeten und bei Altbestand, der keiner Kampagne zuzuordnen ist.';

CREATE INDEX IF NOT EXISTS idx_deal_activities_campaign
  ON public.deal_activities (campaign_id, activity_type)
  WHERE campaign_id IS NOT NULL AND deleted_at IS NULL;