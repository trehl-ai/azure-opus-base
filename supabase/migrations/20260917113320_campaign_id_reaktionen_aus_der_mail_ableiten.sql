-- 17.09.2026: Reaktionen erben die Kampagne von der Mail, die sie ausgeloest hat.
--
-- BEFUND: Bei den Fit-&-Aktiv-Segmenten sind die MAILS gestempelt (der
-- Workflow setzt campaign_id selbst), Klicks und Bounces aber nicht:
--   link_click weiterfuehrend  7 gesamt, nur 3 gestempelt
--   bounce     weiterfuehrend  1 gesamt, 0 gestempelt
-- Sie fehlen damit in jeder Kampagnenzahl.
--
-- ⚠ WARUM DER BESTEHENDE TRIGGER NICHT REICHT: Er leitet die Kampagne aus
-- Pipeline, Segment und Bundesland ab und ist bewusst auf
-- segment = 'grundschule' beschraenkt. Bei weiterfuehrenden Schulen waere die
-- Ableitung NICHT eindeutig — WerteRaum 3.0 und VR Fit & Aktiv Schulen teilen
-- sich Pipeline UND Segment.
--
-- DIE LOESUNG IST EINE ANDERE QUELLE: Eine Reaktion gehoert zu der Mail, die
-- sie ausgeloest hat. Die traegt ihre Kampagne bereits — vom Versandworkflow
-- gesetzt, nicht abgeleitet.
-- NEU: Traegt ein Klick, Bounce oder eine Antwort keine campaign_id, wird die
-- der LETZTEN Mail desselben Deals vor diesem Zeitpunkt uebernommen.
-- ⚠ VOR DIESEM ZEITPUNKT ist wesentlich: Bei zwei Kampagnen nacheinander
-- gehoert ein Klick zur vorangegangenen Mail, nicht zur neuesten.
--
-- Der bestehende Grundschul-Trigger bleibt und laeuft zuerst; dieser hier
-- fuellt nur, was danach noch leer ist. Zwei Trigger auf derselben Tabelle
-- laufen in alphabetischer Reihenfolge ihrer Namen — "trg_campaign_id_aus_mail"
-- vor "trg_campaign_id_werteraum_grundschule". Deshalb prueft dieser Trigger
-- die Grundschul-Bedingung mit und ueberlaesst ihm den Fall.

CREATE OR REPLACE FUNCTION public.set_campaign_id_aus_mail()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_segment text;
BEGIN
  IF NEW.campaign_id IS NOT NULL
     OR NEW.deal_id IS NULL
     OR NEW.activity_type NOT IN ('email_reply','bounce','link_click') THEN
    RETURN NEW;
  END IF;

  -- Grundschulen macht der andere Trigger; er ist praeziser, weil er das
  -- Bundesland auswertet und damit Bayern von Bundesweit trennt.
  SELECT d.segment INTO v_segment FROM deals d WHERE d.id = NEW.deal_id;
  IF v_segment = 'grundschule' THEN
    RETURN NEW;
  END IF;

  -- Die Kampagne der letzten Mail VOR diesem Zeitpunkt. Bei zwei Kampagnen
  -- nacheinander gehoert die Reaktion zur vorangegangenen Mail.
  SELECT a.campaign_id INTO NEW.campaign_id
  FROM deal_activities a
  WHERE a.deal_id = NEW.deal_id
    AND a.activity_type = 'email'
    AND a.deleted_at IS NULL
    AND a.campaign_id IS NOT NULL
    AND a.created_at <= coalesce(NEW.created_at, now())
  ORDER BY a.created_at DESC
  LIMIT 1;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.set_campaign_id_aus_mail() IS
  'Faellt eine Reaktion (Antwort, Bounce, Klick) ohne campaign_id an, erbt sie die Kampagne der letzten Mail desselben Deals VOR diesem Zeitpunkt. Anders als der Grundschul-Trigger leitet sie nichts aus Pipeline und Segment ab — das waere bei weiterfuehrenden Schulen nicht eindeutig, weil WerteRaum 3.0 und VR Fit & Aktiv Schulen sich beides teilen. Die Mail dagegen traegt ihre Kampagne vom Versandworkflow. Grundschulen ueberlaesst sie dem praeziseren Trigger, der das Bundesland auswertet.';

DROP TRIGGER IF EXISTS trg_campaign_id_aus_mail ON public.deal_activities;
CREATE TRIGGER trg_campaign_id_aus_mail
  BEFORE INSERT ON public.deal_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_campaign_id_aus_mail();