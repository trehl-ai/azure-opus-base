-- 18.09.2026: Stufenwechsel in eine "Mensch"-Stufe storniert geplante Zweitmailings.
--
-- Eine Mail haengt an DREI Stellen: Aktivitaet, outreach_status, scheduled_mailings.
-- Beim Verschieben eines Deals wurde bisher nur die Stufe angefasst; ein pending
-- 2nd_mailing blieb stehen und ging am naechsten 10:00-Lauf raus. 18.09.: zwei
-- Wiedervorlage-Klicker bekamen so die dritte Mail statt des Anrufs.
--
-- GEMESSEN (audit_log, 14 Tage, Stufenwechsel je Tag):
--   Mailing erhalten -> 2. Mailing   29,6/Tag  O3hW plant und LEGT pendings an — nie stornieren
--   Identifiziert    -> Mailing erh. 11,9/Tag  Erstversand
--   Wiedervorlage    -> 2. Mailing    4,2/Tag  O3hW (seit 18.09. keine Quelle mehr)
--   2. Mailing -> Antwort erhalten     0,6/Tag  } Zielstufen dieses Triggers,
--   2. Mailing -> Verloren             0,4/Tag  } zusammen unter 1/Tag.
--   2. Mailing -> Wiedervorlage        0,1/Tag  } (genau der Fall vom 18.09.)
--   -> Terminiert / Angebot erstellt   je 0,1/Tag
--
-- ⚠ DER KERN — RUECKSTELLUNGEN BLEIBEN UNBERUEHRT:
--   Ein Wechsel NACH "Mailing erhalten" oder in eine Quellstufe ("Identifiziert",
--   "Qualifiziert — …") ist eine Rueckstellung IN den Nachfass. Am 17.09. wurden
--   10 Deals aus "2. Mailing" nach "Mailing erhalten" zurueckgestellt, damit sie
--   den Nachfass BEKOMMEN — am 18.09. ging er raus. Haette dieser Trigger dort
--   storniert, waere die Rueckstellung wirkungslos gewesen.
--   Ebenso bleibt der Wechsel NACH "2. Mailing" (Planung durch O3hW) frei — dort
--   entstehen die pendings gerade erst.
--   Storniert wird NUR beim Wechsel in eine Stufe, in der ein Mensch oder das
--   Ende der Strecke steht — dieselbe Liste wie in get_due_second_mailings.

CREATE OR REPLACE FUNCTION public.deals_stufenwechsel_storniert_pending_mailings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_neu text;
  v_alt text;
  v_n   int;
BEGIN
  IF NEW.pipeline_stage_id IS NOT DISTINCT FROM OLD.pipeline_stage_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_neu FROM pipeline_stages WHERE id = NEW.pipeline_stage_id;
  SELECT name INTO v_alt FROM pipeline_stages WHERE id = OLD.pipeline_stage_id;

  -- Nur "Mensch"- und Endstufen. Alles andere — insbesondere "Mailing erhalten",
  -- "Identifiziert", "Qualifiziert — …" (Rueckstellung in den Nachfass) und
  -- "2. Mailing" (Planung) — laesst pendings bewusst stehen.
  IF v_neu NOT IN ('Wiedervorlage','Antwort erhalten','Terminiert','Angebot erstellt',
                   'Verhandlung','Gewonnen','Verloren','Blacklist') THEN
    RETURN NEW;
  END IF;

  UPDATE scheduled_mailings
     SET status = 'cancelled', lost_check_at = now()
   WHERE deal_id = NEW.id AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 0 THEN
    INSERT INTO deal_activities(deal_id, activity_type, title, description, owner_user_id, auto_generated, status)
    VALUES (NEW.id, 'note',
            'Geplanter Nachfass storniert (Stufenwechsel)',
            v_n || ' geplante(s) 2. Mailing storniert, weil der Deal von "' || coalesce(v_alt,'?') ||
            '" nach "' || v_neu || '" verschoben wurde. Wer dort steht, wartet auf einen Menschen, nicht auf die naechste Mail.',
            NEW.owner_user_id, true, 'completed');
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.deals_stufenwechsel_storniert_pending_mailings() IS
  'Trigger auf deals: Wechsel in eine Mensch-/Endstufe (Wiedervorlage, Antwort erhalten, Terminiert, Angebot erstellt, Verhandlung, Gewonnen, Verloren, Blacklist) storniert pending scheduled_mailings des Deals und legt eine Notiz an. Rueckstellungen nach "Mailing erhalten"/Quellstufen und die Planung nach "2. Mailing" bleiben bewusst unberuehrt (17./18.09.2026: 10 zurueckgestellte Deals sollten den Nachfass bekommen). Gemessen: Zielstufen zusammen < 1 Wechsel/Tag.';

DROP TRIGGER IF EXISTS trg_deals_stufenwechsel_storniert_pending_mailings ON public.deals;
CREATE TRIGGER trg_deals_stufenwechsel_storniert_pending_mailings
  AFTER UPDATE OF pipeline_stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_stufenwechsel_storniert_pending_mailings();