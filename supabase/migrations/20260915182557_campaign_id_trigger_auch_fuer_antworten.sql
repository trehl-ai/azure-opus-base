-- 15.09.2026: Der Kampagnenstempel gilt auch fuer Antworten, Bounces und Klicks.
--
-- BEFUND: Von 28 Antworten im Bestand tragen 6 keine campaign_id — alle aus
-- September. Der Trigger steigt bei activity_type <> 'email' aus; die 22
-- gestempelten stammen aus einem Backfill, der bis August reichte.
-- ⚠ DIE FOLGE IST EINE VERZERRTE AUSWERTUNG: Die Kachel zeigte fuer
-- Bundesweit 6 Antworten. Ueber den Deal aufgeloest sind es 10 — vier
-- ungestempelte gehoeren dorthin, zwei zu Bayern.
-- Bei kleinen Zahlen aendert das die Quote erheblich: Bundesweit 0,4 statt
-- 0,7 Prozent.
--
-- NEU: Der Trigger stempelt auch email_reply, bounce und link_click.
-- ⚠ NICHT termin_click: den setzt termin_click_intake selbst, und zwar ueber
-- die utm — das ist genauer als die Ableitung aus Pipeline und Segment.
-- Ein gesetzter Wert gewinnt ohnehin immer, aber die Absicht gehoert notiert.
--
-- ⚠ WARUM DIE ABLEITUNG HIER TRAEGT: Der Trigger beschraenkt auf
-- pipeline = WerteRaum UND segment = grundschule. Dort ist die Zuordnung
-- ueber das Bundesland eindeutig (Bayern oder Bundesweit). Bei
-- weiterfuehrenden Schulen waere sie es NICHT — WerteRaum 3.0 und
-- VR Fit & Aktiv Schulen teilen sich Pipeline und Segment. Deshalb bleibt die
-- Beschraenkung.

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

  -- NEU 15.09.2026: nicht mehr nur 'email'. Eine Antwort ohne Stempel
  -- verzerrt die Auswertung genauso wie eine ungestempelte Mail.
  -- termin_click bleibt aussen vor: den setzt termin_click_intake selbst
  -- ueber die utm, das ist genauer als diese Ableitung.
  IF NEW.activity_type NOT IN ('email','email_reply','bounce','link_click')
     OR NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.bundesland, d.segment, d.pipeline_id
    INTO v_bundesland, v_segment, v_pipeline
  FROM deals d
  LEFT JOIN contacts c ON c.id = d.primary_contact_id
  WHERE d.id = NEW.deal_id;

  -- Nur WerteRaum-Grundschulen. Dort ist die Zuordnung ueber das Bundesland
  -- eindeutig. Bei weiterfuehrenden Schulen NICHT: WerteRaum 3.0 und
  -- VR Fit & Aktiv Schulen teilen sich Pipeline UND Segment.
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
  'Fuellt campaign_id bei WerteRaum-Grundschulen aus Pipeline, Segment und Bundesland. Seit 15.09.2026 nicht mehr nur fuer email, sondern auch fuer email_reply, bounce und link_click — 6 von 28 Antworten waren ungestempelt und verzerrten die Kampagnenauswertung. termin_click bleibt ausgenommen: den setzt termin_click_intake ueber die utm, das ist genauer. Die Beschraenkung auf segment = grundschule bleibt, weil WerteRaum 3.0 und VR Fit & Aktiv Schulen sich Pipeline und Segment teilen und die Ableitung dort nicht eindeutig waere.';