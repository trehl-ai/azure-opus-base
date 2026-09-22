-- 22.09.2026: Drei gezielte Aenderungen an get_versand_konsistenz(integer) und eine an wr_tageswaechter(),
-- als Ersetzung im vorhandenen Funktionstext (7.683 Zeichen), damit der uebrige Text byte-identisch bleibt.
-- Jede Ersetzung wird geprueft: fehlt der alte Text oder fehlt danach der neue, bricht die Migration ab.
--  1. Regel "Kontakt email_sent ohne Aktivitaet": eine Mail, die an DIESEN Kontakt ging (a.contact_id = c.id),
--     zaehlt auch dann, wenn sie am Schwesterdeal derselben Firma haengt (16 Dubletten-Fehlalarme seit 17.09.).
--  2. Regel "Aktivitaet ohne Kontaktstatus": nur Mails, die an den Hauptkontakt gingen (4 Dubletten-Fehlalarme).
--  3. Bounce-Tagesschwelle 15 % -> 8 %, aber erst ab 20 Mails am Tag (10./11.09. lagen bei 10-11 % und blieben stumm).
--  4. wr_tageswaechter (Telegram): harte Bounces 20 % -> 8 % ab 20 Mails.
DO $mig$
DECLARE
  v_def text;
  v_new text;
  v_alt text;
  v_neu text;
BEGIN
  v_def := pg_get_functiondef('public.get_versand_konsistenz(integer)'::regprocedure);
  v_new := v_def;

  -- 1.
  v_alt := E'    AND NOT EXISTS (SELECT 1 FROM deals d JOIN deal_activities a ON a.deal_id = d.id\n      WHERE d.primary_contact_id = c.id AND a.activity_type = ''email'' AND a.deleted_at IS NULL)';
  v_neu := v_alt || E'\n    AND NOT EXISTS (SELECT 1 FROM deal_activities a\n      WHERE a.contact_id = c.id AND a.activity_type = ''email'' AND a.deleted_at IS NULL)';
  IF position(v_alt IN v_new) = 0 THEN RAISE EXCEPTION 'Ersetzung 1: alter Text nicht gefunden'; END IF;
  v_new := replace(v_new, v_alt, v_neu);

  -- 2.
  v_alt := E'    AND c.outreach_status = ''pending'' AND c.bounce_at IS NULL\n    AND NOT EXISTS (SELECT 1 FROM deal_activities k';
  v_neu := E'    AND c.outreach_status = ''pending'' AND c.bounce_at IS NULL\n    AND (a.contact_id IS NULL OR a.contact_id = c.id)\n    AND NOT EXISTS (SELECT 1 FROM deal_activities k';
  IF position(v_alt IN v_new) = 0 THEN RAISE EXCEPTION 'Ersetzung 2: alter Text nicht gefunden'; END IF;
  v_new := replace(v_new, v_alt, v_neu);

  -- 3.
  v_alt := '(x.mails > 0 AND x.bounces::numeric / x.mails > 0.15) AS ueberschritten';
  v_neu := '(x.mails >= 20 AND x.bounces::numeric / x.mails > 0.08) AS ueberschritten';
  IF position(v_alt IN v_new) = 0 THEN RAISE EXCEPTION 'Ersetzung 3a: alter Text nicht gefunden'; END IF;
  v_new := replace(v_new, v_alt, v_neu);
  v_alt := '''Bounce-Quote ueber 15 Prozent des Tages''::text';
  v_neu := '''Bounce-Quote ueber 8 Prozent des Tages (ab 20 Mails)''::text';
  IF position(v_alt IN v_new) = 0 THEN RAISE EXCEPTION 'Ersetzung 3b: alter Text nicht gefunden'; END IF;
  v_new := replace(v_new, v_alt, v_neu);

  IF v_new = v_def THEN RAISE EXCEPTION 'get_versand_konsistenz: nichts geaendert'; END IF;
  EXECUTE v_new;

  -- 4. wr_tageswaechter
  v_def := pg_get_functiondef('public.wr_tageswaechter'::regproc);
  v_alt := 'IF v_mails > 0 AND v_bounce_hart::numeric / v_mails > 0.2 THEN';
  v_neu := 'IF v_mails >= 20 AND v_bounce_hart::numeric / v_mails > 0.08 THEN';
  IF position(v_alt IN v_def) = 0 THEN RAISE EXCEPTION 'Ersetzung 4: alter Text nicht gefunden'; END IF;
  EXECUTE replace(v_def, v_alt, v_neu);
END
$mig$;