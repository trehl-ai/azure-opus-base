-- 07.09.2026: Die Kampagnenzuordnung fuer WerteRaum-Grundschulen entsteht in der
-- Datenbank, nicht im Workflow.
--
-- WIE ES DAZU KAM: Seit dem 04.09. trugen versendete Mails keine campaign_id —
-- der Backfill vom 03.09. hatte 1.715 Aktivitaeten EINMALIG gestempelt, die
-- Workflows setzen das Feld nicht. Am 07.09. wurden alle drei
-- WerteRaum-Workflows gepatcht. Ergebnis: dieselbe Fallunterscheidung
-- (Bayern -> 1.0, sonst -> 2.0) stand danach an ZWEI Orten — in zwei jsCode-
-- Nodes und in get_erneutes_mailing_context. Claude Code hat darauf
-- hingewiesen: "Das Ziel 'nicht an drei Stellen pflegen' ist damit noch nicht
-- erreicht, es sind jetzt zwei."
--
-- DIESER TRIGGER macht daraus einen Ort. Er fuellt campaign_id NUR, wenn sie
-- NULL ist — ein Workflow, der sie setzt, behaelt das letzte Wort. Damit
-- funktionieren auch die drei bereits gepatchten Workflows unveraendert
-- weiter, und kuenftige Workflows brauchen die Regel gar nicht zu kennen.
--
-- ⚠ ER GREIFT AUSSCHLIESSLICH BEI WERTERAUM-GRUNDSCHULEN.
-- Grund: nur dort ist die Zuordnung eindeutig. Bei den weiterfuehrenden
-- Schulen teilen sich WerteRaum 3.0 und VR Fit & Aktiv — Schulen DENSELBEN
-- Verteiler, zwei Monate versetzt (Entscheidung Tomi, 03.09.). Welche Kampagne
-- eine Mail gesendet hat, ist dort NICHT aus den Daten ableitbar — das weiss
-- nur der Workflow. Wuerde der Trigger dort raten, zaehlte er Fit-&-Aktiv-Mails
-- als WerteRaum-Mails und umgekehrt.
-- Der Fit-&-Aktiv-Workflow uuuW957tpI9ihzKW setzt seine campaign_id selbst.
--
-- Ebenfalls ausgenommen: activity_type <> 'email'. Notizen, Anrufe und
-- insbesondere der remail_skipped-Vermerk (activity_type 'note', protokolliert
-- einen NICHT erfolgten Versand) bleiben ungestempelt. Sonst zaehlte die Kachel
-- uebersprungene Mails als versendete.
--
-- Die Fallunterscheidung ist wortgleich zu dem UPDATE, mit dem am 07.09. die
-- 149 ungestempelten Mails nachgetragen wurden.

CREATE OR REPLACE FUNCTION public.set_campaign_id_werteraum_grundschule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bundesland text;
  v_segment    text;
  v_pipeline   uuid;
BEGIN
  -- Ein gesetzter Wert gewinnt immer. Der Trigger fuellt nur Luecken.
  IF NEW.campaign_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.activity_type <> 'email' OR NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.bundesland, d.segment, d.pipeline_id
    INTO v_bundesland, v_segment, v_pipeline
  FROM deals d
  LEFT JOIN contacts c ON c.id = d.primary_contact_id
  WHERE d.id = NEW.deal_id;

  -- Nur WerteRaum-Grundschulen. Ueberall sonst ist die Zuordnung nicht
  -- eindeutig und der Workflow muss sie mitliefern.
  IF v_pipeline IS DISTINCT FROM '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
     OR v_segment IS DISTINCT FROM 'grundschule' THEN
    RETURN NEW;
  END IF;

  NEW.campaign_id := CASE
    WHEN v_bundesland = 'Bayern'
      THEN '8c51eca8-8e2b-480d-8825-7329d57d166a'::uuid
      ELSE '34c7d3ee-a90f-4d74-86f9-006579cc4e55'::uuid
  END;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.set_campaign_id_werteraum_grundschule() IS
  'Fuellt deal_activities.campaign_id fuer WerteRaum-Grundschulen, wenn der Workflow sie nicht setzt. Ein gesetzter Wert gewinnt immer. Greift NICHT bei weiterfuehrenden Schulen — dort teilen sich WerteRaum 3.0 und VR Fit & Aktiv denselben Verteiler, und welche Kampagne gesendet hat, weiss nur der Workflow. Greift NICHT bei activity_type <> email, insbesondere nicht beim remail_skipped-Vermerk.';

DROP TRIGGER IF EXISTS trg_campaign_id_werteraum_grundschule ON public.deal_activities;

CREATE TRIGGER trg_campaign_id_werteraum_grundschule
  BEFORE INSERT ON public.deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_campaign_id_werteraum_grundschule();