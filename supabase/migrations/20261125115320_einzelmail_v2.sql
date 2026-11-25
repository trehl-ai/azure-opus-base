-- Einzelmail-Ausbau Schritt 1/3 (25.11.2026)
-- einzelmailings: Absender-Domain, Message-ID, In-Reply-To (reserviert), Domain-Trigger,
-- charge optional, hoechstens eine offene Zeile je Deal.
-- Neue Funktionen: get_einzelmails_faellig_v2, einzelmail_als_gesendet_v2 (nur service_role),
-- einzelmail_freigeben, einzelmail_zurueckstellen, get_einzelmails_offen (authenticated, Pruefung is_admin()).
-- Die alten Funktionen get_einzelmails_faellig(text,int) und einzelmail_als_gesendet(uuid)
-- bleiben unveraendert; QrxVaUhF6vvQ13UD nutzt sie bis Schritt 2.

-- 1. Tabelle ------------------------------------------------------------------------
ALTER TABLE public.einzelmailings
  ADD COLUMN absender_domain text
    CONSTRAINT einzelmailings_absender_domain_check
    CHECK (absender_domain IN ('werteraum-schule.de','viktoria-roadshow.com')),
  ADD COLUMN message_id  text,
  ADD COLUMN in_reply_to text;   -- reserviert, wird in Schritt 1 nicht genutzt

COMMENT ON COLUMN public.einzelmailings.in_reply_to IS
  'Reserviert fuer Antworten im Thread (Message-ID der Bezugsmail). Noch nicht genutzt.';

-- Backfill aus der Kampagne, mit Guard: jede Zeile muss eine Domain bekommen.
DO $guard$
DECLARE n_upd int; n_all int;
BEGIN
  UPDATE public.einzelmailings e
     SET absender_domain = k.absender_domain
    FROM public.campaigns k
   WHERE k.id = e.campaign_id AND e.absender_domain IS NULL;
  GET DIAGNOSTICS n_upd = ROW_COUNT;
  SELECT count(*) INTO n_all FROM public.einzelmailings;
  IF n_upd <> n_all OR n_all <> 59 THEN
    RAISE EXCEPTION 'GUARD absender_domain backfill: % von % Zeilen (erwartet 59)', n_upd, n_all;
  END IF;
END
$guard$;

ALTER TABLE public.einzelmailings ALTER COLUMN absender_domain SET NOT NULL;
ALTER TABLE public.einzelmailings ALTER COLUMN charge DROP NOT NULL;
-- UNIQUE (charge, deal_id) bleibt bestehen.

CREATE UNIQUE INDEX einzelmailings_ein_offener_je_deal
  ON public.einzelmailings (deal_id)
  WHERE status IN ('entwurf','freigegeben');

CREATE OR REPLACE FUNCTION public.einzelmailing_domain_setzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.absender_domain IS NULL THEN
    SELECT k.absender_domain INTO NEW.absender_domain
      FROM campaigns k WHERE k.id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.einzelmailing_domain_setzen() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_einzelmailing_domain
  BEFORE INSERT ON public.einzelmailings
  FOR EACH ROW EXECUTE FUNCTION public.einzelmailing_domain_setzen();

-- 2. Faellige Einzelmails, ohne Charge und Stufenfilter, Budget je Domain -------------
CREATE OR REPLACE FUNCTION public.get_einzelmails_faellig_v2(p_limit integer DEFAULT 20)
 RETURNS TABLE(einzelmail_id uuid, deal_id uuid, contact_id uuid, email text, betreff text, text text,
               reihenfolge integer, absender_domain text, in_reply_to text, budget_rest bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  WITH kand AS (
    SELECT e.*
    FROM einzelmailings e
    JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL AND d.status = 'open'
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id AND ps.name <> 'Blacklist'
    JOIN contacts c ON c.id = e.contact_id AND c.deleted_at IS NULL
    WHERE e.status = 'freigegeben'
      AND e.gesendet_am IS NULL
      -- Empfaenger gehoert zum Deal: Hauptkontakt oder Kontakt der Firma des Deals.
      AND (e.contact_id = d.primary_contact_id
           OR EXISTS (SELECT 1 FROM company_contacts cc
                      WHERE cc.company_id = d.company_id AND cc.contact_id = e.contact_id))
      AND lower(btrim(c.email)) = lower(btrim(e.email))
      AND c.bounce_at IS NULL
      AND coalesce(c.outreach_status,'') NOT LIKE 'blocked%'
      AND coalesce(c.outreach_status,'') <> 'bounced'
      AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = lower(btrim(e.email)))
      AND NOT firma_ist_kunde(d.company_id, d.id)
      AND NOT EXISTS (SELECT 1 FROM deal_activities r
                      WHERE r.deal_id = e.deal_id AND r.deleted_at IS NULL
                        AND r.activity_type IN ('email_reply','meeting') AND r.created_at > e.created_at)
  ),
  budget AS (
    SELECT dom.absender_domain,
           coalesce((SELECT b.rest FROM get_domain_tagesbudget(dom.absender_domain) b), 0) AS rest
    FROM (SELECT DISTINCT k.absender_domain FROM kand k) dom
  ),
  rang AS (
    SELECT k.*, b.rest,
           row_number() OVER (PARTITION BY k.absender_domain
                              ORDER BY k.reihenfolge, k.freigegeben_am, k.id) AS rn
    FROM kand k JOIN budget b ON b.absender_domain = k.absender_domain
  )
  SELECT r.id, r.deal_id, r.contact_id, r.email, r.betreff, r.text, r.reihenfolge,
         r.absender_domain, r.in_reply_to, r.rest
  FROM rang r
  WHERE r.rn <= r.rest
  ORDER BY r.reihenfolge, r.freigegeben_am, r.id
  LIMIT p_limit;
$fn$;

-- 3. Als gesendet melden, mit Message-ID; Urheber = Freigebende(r) -------------------
CREATE OR REPLACE FUNCTION public.einzelmail_als_gesendet_v2(p_id uuid, p_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  e einzelmailings%ROWTYPE;
  v_act uuid;
  v_user uuid;
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
  -- Urheber = freigegeben_von, falls in public.users (FK owner_user_id), sonst Owner des Deals.
  SELECT u.id INTO v_user FROM users u WHERE u.id = e.freigegeben_von;
  IF v_user IS NULL THEN
    SELECT d.owner_user_id INTO v_user FROM deals d WHERE d.id = e.deal_id;
  END IF;
  INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description, campaign_id, sequence_type,
                               created_by_user_id, owner_user_id, auto_generated, metadata, created_at, updated_at)
  VALUES (e.deal_id, e.contact_id, 'email', 'Einzelmail versendet: ' || e.betreff, e.text, e.campaign_id, 'einzelmail',
          v_user, v_user, true,
          jsonb_build_object('einzelmail_id', e.id, 'charge', e.charge, 'empfaenger', e.email,
                             'absender_domain', e.absender_domain, 'message_id', p_message_id),
          now(), now())
  RETURNING id INTO v_act;
  UPDATE einzelmailings
     SET status = 'gesendet', gesendet_am = now(), activity_id = v_act, message_id = p_message_id
   WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'status', 'gesendet', 'activity_id', v_act, 'deal_id', e.deal_id);
END
$fn$;

-- 4. Oberflaeche (nur admin) ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.einzelmail_freigeben(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE n int;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'einzelmail_freigeben: nur admin' USING ERRCODE = '42501';
  END IF;
  UPDATE einzelmailings
     SET status = 'freigegeben', freigegeben_von = auth.uid(), freigegeben_am = now(), fehler = NULL
   WHERE id = p_id AND status = 'entwurf';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', n = 1,
    'status', CASE WHEN n = 1 THEN 'freigegeben' ELSE 'nicht_im_entwurf_oder_unbekannt' END);
END
$fn$;

CREATE OR REPLACE FUNCTION public.einzelmail_zurueckstellen(p_id uuid, p_grund text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE n int;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'einzelmail_zurueckstellen: nur admin' USING ERRCODE = '42501';
  END IF;
  -- Grund in die Notizspalte hinweis (angehaengt, nichts ueberschrieben).
  UPDATE einzelmailings
     SET status = 'zurueckgestellt',
         hinweis = concat_ws(E'\n', nullif(hinweis, ''),
                   'Zurueckgestellt ' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI')
                   || ': ' || coalesce(nullif(btrim(p_grund), ''), '(ohne Grund)'))
   WHERE id = p_id AND status IN ('entwurf','freigegeben','fehler');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', n = 1,
    'status', CASE WHEN n = 1 THEN 'zurueckgestellt' ELSE 'nicht_offen_oder_unbekannt' END);
END
$fn$;

CREATE OR REPLACE FUNCTION public.get_einzelmails_offen()
 RETURNS TABLE(einzelmail_id uuid, status text, deal_id uuid, schule text, stufe text, empfaenger text,
               betreff text, text text, absender_domain text, kampagne text, hinweis text, kontext text,
               fehler text, reihenfolge integer, freigegeben_am timestamptz, created_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'get_einzelmails_offen: nur admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.status, e.deal_id, coalesce(co.name, d.title), ps.name, e.email,
         e.betreff, e.text, e.absender_domain, k.name, e.hinweis, e.kontext,
         e.fehler, e.reihenfolge, e.freigegeben_am, e.created_at
  FROM einzelmailings e
  JOIN deals d ON d.id = e.deal_id
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  LEFT JOIN campaigns k ON k.id = e.campaign_id
  WHERE e.status IN ('entwurf','freigegeben','fehler')
  ORDER BY CASE e.status WHEN 'fehler' THEN 0 WHEN 'entwurf' THEN 1 ELSE 2 END,
           e.reihenfolge, e.created_at;
END
$fn$;

-- 5. Rechte -------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_einzelmails_faellig_v2(integer)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.einzelmail_als_gesendet_v2(uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.einzelmail_freigeben(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.einzelmail_zurueckstellen(uuid, text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_einzelmails_offen()                    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_einzelmails_faellig_v2(integer)     TO service_role;
GRANT EXECUTE ON FUNCTION public.einzelmail_als_gesendet_v2(uuid, text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.einzelmail_freigeben(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.einzelmail_zurueckstellen(uuid, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_einzelmails_offen()                 TO authenticated;
-- Tabelle einzelmailings bleibt fuer anon/authenticated gesperrt (keine Aenderung an den Tabellenrechten).
