-- 09.11.2026 Einzelmail-Versand: individuelle, einzeln freigegebene Mails (erste Charge: 59 Wiedervorlage-Schulen WerteRaum).
-- Versand nur per n8n-Workflow, der ausschliesslich get_einzelmails_faellig() liest (nur status 'freigegeben')
-- und jede Mail ueber einzelmail_als_gesendet() / einzelmail_fehler() zurueckmeldet.
CREATE TABLE public.einzelmailings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge          text NOT NULL,
  reihenfolge     integer NOT NULL,
  prio            integer,
  deal_id         uuid NOT NULL REFERENCES public.deals(id),
  contact_id      uuid NOT NULL REFERENCES public.contacts(id),
  campaign_id     uuid NOT NULL REFERENCES public.campaigns(id),
  email           text NOT NULL,
  betreff         text NOT NULL,
  text            text NOT NULL,
  hinweis         text,
  kontext         text,
  status          text NOT NULL DEFAULT 'entwurf'
                  CHECK (status IN ('entwurf','freigegeben','gesendet','fehler','zurueckgestellt')),
  freigegeben_von uuid,
  freigegeben_am  timestamptz,
  gesendet_am     timestamptz,
  fehler          text,
  activity_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge, deal_id),
  CHECK (status <> 'freigegeben' OR (freigegeben_von IS NOT NULL AND freigegeben_am IS NOT NULL))
);
ALTER TABLE public.einzelmailings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.einzelmailings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.einzelmailings TO service_role;

-- Gleiche Regel wie campaign_mailings: Text/Betreff einer freigegebenen Zeile aendern -> zurueck auf entwurf.
CREATE OR REPLACE FUNCTION public.einzelmailing_freigabe_zuruecksetzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'freigegeben' AND OLD.status = 'freigegeben'
     AND (NEW.text IS DISTINCT FROM OLD.text OR NEW.betreff IS DISTINCT FROM OLD.betreff OR NEW.email IS DISTINCT FROM OLD.email)
  THEN
    NEW.status := 'entwurf';
    NEW.freigegeben_von := NULL;
    NEW.freigegeben_am := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.einzelmailing_freigabe_zuruecksetzen() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_einzelmailing_freigabe BEFORE UPDATE ON public.einzelmailings
  FOR EACH ROW EXECUTE FUNCTION public.einzelmailing_freigabe_zuruecksetzen();

-- Faellige Mails: nur freigegeben, Deal noch offen und in der Ausgangsstufe, Adresse unveraendert und nicht gesperrt,
-- keine Antwort seit Anlage, keine Kundenfirma. Menge gedeckelt durch p_limit UND das Tagesbudget der Absenderdomain.
CREATE OR REPLACE FUNCTION public.get_einzelmails_faellig(p_charge text, p_limit integer DEFAULT 20)
 RETURNS TABLE(einzelmail_id uuid, deal_id uuid, contact_id uuid, email text, betreff text, text text, reihenfolge integer, budget_rest bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH budget AS (
    SELECT coalesce((SELECT b.rest FROM get_domain_tagesbudget('werteraum-schule.de') b), 0) AS rest
  )
  SELECT e.id, e.deal_id, e.contact_id, e.email, e.betreff, e.text, e.reihenfolge, (SELECT rest FROM budget)
  FROM einzelmailings e
  JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL AND d.status = 'open'
  JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id AND ps.name = 'Wiedervorlage'
  JOIN contacts c ON c.id = e.contact_id AND c.deleted_at IS NULL
  WHERE e.charge = p_charge
    AND e.status = 'freigegeben'
    AND e.gesendet_am IS NULL
    AND lower(btrim(c.email)) = lower(btrim(e.email))
    AND c.bounce_at IS NULL
    AND coalesce(c.outreach_status,'') NOT LIKE 'blocked%'
    AND coalesce(c.outreach_status,'') <> 'bounced'
    AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = lower(btrim(e.email)))
    AND NOT firma_ist_kunde(d.company_id, d.id)
    AND NOT EXISTS (SELECT 1 FROM deal_activities r
                    WHERE r.deal_id = e.deal_id AND r.deleted_at IS NULL
                      AND r.activity_type IN ('email_reply','meeting') AND r.created_at > e.created_at)
  ORDER BY e.reihenfolge
  LIMIT least(p_limit, (SELECT rest FROM budget));
$function$;
REVOKE ALL ON FUNCTION public.get_einzelmails_faellig(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_einzelmails_faellig(text, integer) TO service_role;

-- Rueckmeldung nach erfolgreichem SMTP-Versand: Zeile auf gesendet, Mail als Aktivitaet am Deal (zaehlt ins Domainbudget).
CREATE OR REPLACE FUNCTION public.einzelmail_als_gesendet(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e einzelmailings%ROWTYPE;
  v_act uuid;
BEGIN
  SELECT * INTO e FROM einzelmailings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'nicht_gefunden');
  END IF;
  IF e.status = 'gesendet' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'schon_gesendet', 'activity_id', e.activity_id);
  END IF;
  IF e.status <> 'freigegeben' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'nicht_freigegeben', 'ist', e.status);
  END IF;
  INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description, campaign_id, sequence_type,
                               created_by_user_id, owner_user_id, auto_generated, metadata, created_at, updated_at)
  VALUES (e.deal_id, e.contact_id, 'email', 'Einzelmail versendet: ' || e.betreff, e.text, e.campaign_id, 'einzelmail',
          '81de2da3-eef1-4b20-955f-09aed66bc1a3', '81de2da3-eef1-4b20-955f-09aed66bc1a3', true,
          jsonb_build_object('einzelmail_id', e.id, 'charge', e.charge, 'empfaenger', e.email), now(), now())
  RETURNING id INTO v_act;
  UPDATE einzelmailings SET status = 'gesendet', gesendet_am = now(), activity_id = v_act WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'status', 'gesendet', 'activity_id', v_act, 'deal_id', e.deal_id);
END
$function$;
REVOKE ALL ON FUNCTION public.einzelmail_als_gesendet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.einzelmail_als_gesendet(uuid) TO service_role;

-- Rueckmeldung bei SMTP-Fehler: Zeile auf fehler (wird nicht automatisch erneut versucht).
CREATE OR REPLACE FUNCTION public.einzelmail_fehler(p_id uuid, p_fehler text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  UPDATE einzelmailings SET status = 'fehler', fehler = left(coalesce(p_fehler,'?'), 1000)
  WHERE id = p_id AND status = 'freigegeben';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', n = 1, 'status', CASE WHEN n = 1 THEN 'fehler_gespeichert' ELSE 'nicht_freigegeben_oder_unbekannt' END);
END
$function$;
REVOKE ALL ON FUNCTION public.einzelmail_fehler(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.einzelmail_fehler(uuid, text) TO service_role;