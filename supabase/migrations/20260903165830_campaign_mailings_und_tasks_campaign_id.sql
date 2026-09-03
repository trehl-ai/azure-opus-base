-- 03.09.2026: Mailings als eigene Entitaet, plus Aufgabenbezug zur Kampagne.
--
-- ANLASS: Tomi will jedes Mailing freigeben, bevor es rausgeht — "alle Mailings
-- Nachfass WerteRaum bundesweit, 1. Mailing Viktoria, drittes Mailing Bayern",
-- also EINMAL JE MAILING, nicht je Mail und nicht je Kampagne.
--
-- DAS IST DER ENTSCHEIDENDE PUNKT: Eine Kampagne hat MEHRERE Mailings ueber
-- Monate, jedes mit eigenem Text und eigener Freigabe. Die Freigabe an die
-- Kampagne zu haengen waere zu grob (ein 3. Mailing braucht eine neue Freigabe),
-- an die einzelne Mail zu haengen waere unbrauchbar (50 Freigaben taeglich, nach
-- drei Tagen klickt man blind).
--
-- WARUM DAS NOETIG IST, belegt aus dem 02./03.09.2026:
-- Alle drei Textfehler dieser Woche waren MAILINGFEHLER, keine Einzelfallfehler:
--   - "Schirmherrin ist Staatsministerin Ulrike Scharf" ging unbedingt an 651
--     Schulen in 12 Bundeslaendern, in keinem davon zustaendig
--   - "vor genau zwei Wochen haben wir telefoniert" ging 41-mal an Kontakte,
--     mit denen nie telefoniert wurde
--   - "vor gut drei Wochen" haette an Kontakte gehen sollen, deren Erstmail
--     5 bis 14 Wochen zurueckliegt
-- Jeder davon waere bei EINER Textfreigabe aufgefallen. Keiner davon waere bei
-- der 37. Einzelfreigabe noch aufgefallen.
--
-- status entwurf -> freigegeben -> versendet, pausiert als Sonderfall.
-- Aendert jemand betreff oder text, faellt die Freigabe per Trigger zurueck auf
-- entwurf. Eine Freigabe, die eine Textaenderung ueberlebt, ist keine.

CREATE TABLE IF NOT EXISTS public.campaign_mailings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  nummer          integer NOT NULL,
  name            text NOT NULL,
  betreff         text,
  text            text,
  status          text NOT NULL DEFAULT 'entwurf',
  freigegeben_von uuid,
  freigegeben_am  timestamptz,
  workflow_id     text,
  geplant_ab      date,
  versendet_ab    date,
  versendet_bis   date,
  notiz           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_mailings_status_gueltig
    CHECK (status IN ('entwurf','freigegeben','versendet','pausiert')),
  CONSTRAINT campaign_mailings_nummer_je_kampagne
    UNIQUE (campaign_id, nummer),
  -- Freigegeben heisst: es gibt einen Text UND jemanden, der ihn freigegeben hat.
  -- Ohne diese Bedingung waere "freigegeben" eine Behauptung.
  CONSTRAINT campaign_mailings_freigabe_vollstaendig
    CHECK (
      status <> 'freigegeben'
      OR (freigegeben_von IS NOT NULL AND freigegeben_am IS NOT NULL
          AND text IS NOT NULL AND btrim(text) <> '')
    )
);

COMMENT ON TABLE public.campaign_mailings IS
  'Einzelne Mailings einer Kampagne (1. Mailing, Nachfass, 3. Mailing zum Schuljahresbeginn). Freigabe erfolgt EINMAL JE MAILING. Aendert sich betreff oder text, faellt die Freigabe per Trigger auf entwurf zurueck.';
COMMENT ON COLUMN public.campaign_mailings.workflow_id IS
  'n8n-Workflow, der dieses Mailing versendet, z.B. l5oYTyjUlmQvisfz. Verbindet die Freigabe mit dem Versandweg.';
COMMENT ON COLUMN public.campaign_mailings.status IS
  'entwurf = Text in Arbeit. freigegeben = geprueft, darf raus. versendet = gelaufen. pausiert = bewusst angehalten.';

ALTER TABLE public.campaign_mailings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_mailings FROM PUBLIC;
REVOKE ALL ON public.campaign_mailings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.campaign_mailings TO authenticated;

DROP POLICY IF EXISTS campaign_mailings_select ON public.campaign_mailings;
CREATE POLICY campaign_mailings_select ON public.campaign_mailings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS campaign_mailings_insert ON public.campaign_mailings;
CREATE POLICY campaign_mailings_insert ON public.campaign_mailings
  FOR INSERT TO authenticated WITH CHECK (public.can_write_deals());

DROP POLICY IF EXISTS campaign_mailings_update ON public.campaign_mailings;
CREATE POLICY campaign_mailings_update ON public.campaign_mailings
  FOR UPDATE TO authenticated USING (public.can_write_deals())
  WITH CHECK (public.can_write_deals());

-- Kein DELETE: ein versendetes Mailing wird nicht geloescht, sonst verliert die
-- Kampagne ihre Vergangenheit. Zum Zuruecknehmen dient status = 'pausiert'.

CREATE INDEX IF NOT EXISTS idx_campaign_mailings_kampagne
  ON public.campaign_mailings (campaign_id, nummer);
CREATE INDEX IF NOT EXISTS idx_campaign_mailings_status
  ON public.campaign_mailings (status) WHERE status <> 'versendet';

-- Textaenderung setzt die Freigabe zurueck. In der Datenbank, nicht im Formular:
-- was garantiert sein muss, gehoert in Code.
CREATE OR REPLACE FUNCTION public.campaign_mailing_freigabe_zuruecksetzen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'freigegeben'
     AND OLD.status = 'freigegeben'
     AND (NEW.text IS DISTINCT FROM OLD.text OR NEW.betreff IS DISTINCT FROM OLD.betreff)
  THEN
    NEW.status          := 'entwurf';
    NEW.freigegeben_von := NULL;
    NEW.freigegeben_am  := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_campaign_mailing_freigabe ON public.campaign_mailings;
CREATE TRIGGER trg_campaign_mailing_freigabe
  BEFORE UPDATE ON public.campaign_mailings
  FOR EACH ROW EXECUTE FUNCTION public.campaign_mailing_freigabe_zuruecksetzen();

-- Aufgaben je Kampagne. tasks existiert mit Status-Slugs und haengt bisher an
-- deal_id und project_id. Damit "was ist konkret zu tun" eine Liste mit
-- Faelligkeit und Verantwortlichem wird statt einer Notiz im Freitextfeld.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.campaign_id IS
  'Kampagne, zu der diese Aufgabe gehoert. Speist die Aufgabenliste in der Kampagnen-Detailansicht.';

CREATE INDEX IF NOT EXISTS idx_tasks_campaign
  ON public.tasks (campaign_id, status) WHERE campaign_id IS NOT NULL;