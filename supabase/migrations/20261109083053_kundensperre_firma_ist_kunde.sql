-- 09.11.2026 Kundensperre: Keine Akquise-/Nachfassmail an Firmen, die bereits Kunde sind
-- (anderer Deal derselben Firma gewonnen oder in Terminiert/Angebot erstellt/Verhandlung/Gewonnen).
-- Anlass: Brentano-GS Aschaffenburg (Kunde, Deal e15abb36) bekam am 05.11. die WR-Erstmail ueber
-- die Import-Dublette 32180ccb. Bisheriger Schutz griff nur, wenn am Kunden-Deal eine Mail protokolliert war.
CREATE OR REPLACE FUNCTION public.firma_ist_kunde(p_company_id uuid, p_deal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_company_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM deals k
    JOIN pipeline_stages ps ON ps.id = k.pipeline_stage_id
    WHERE k.company_id = p_company_id
      AND k.id IS DISTINCT FROM p_deal_id
      AND k.deleted_at IS NULL
      AND (k.status = 'won'
           OR COALESCE(ps.is_won_stage, false)
           OR ps.name IN ('Terminiert','Angebot erstellt','Verhandlung','Gewonnen'))
  );
$function$;

REVOKE ALL ON FUNCTION public.firma_ist_kunde(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firma_ist_kunde(uuid, uuid) TO service_role;

DO $patch$
DECLARE
  r record;
  v_def text;
  v_neu text;
  v_n int;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.get_werteraum_candidates(integer,text,text,integer)',
       E'      AND lower(c.email) NOT IN (SELECT mail FROM bereits_bemailt)\n',
       E'      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n      AND lower(c.email) NOT IN (SELECT mail FROM bereits_bemailt)\n'),
      ('public.get_fua_schulen_candidates(integer,integer)',
       E'      AND COALESCE(c.outreach_status,''pending'') = ''pending''\n',
       E'      AND COALESCE(c.outreach_status,''pending'') = ''pending''\n      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n'),
      ('public.get_due_second_mailings(integer,integer)',
       E'      AND d.status = ''open''\n',
       E'      AND d.status = ''open''\n      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n'),
      ('public.plane_zweitkontakte(integer,integer,boolean)',
       E'      AND d.status = ''open''\n',
       E'      AND d.status = ''open''\n      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n'),
      ('public.get_fua_nachfass_candidates(integer,integer,integer)',
       E'      AND (co.id IS NULL OR co.deleted_at IS NULL)\n',
       E'      AND (co.id IS NULL OR co.deleted_at IS NULL)\n      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n'),
      ('public.get_vr_stiftungen_nachfass_candidates(integer,integer)',
       E'      AND (co.id IS NULL OR co.deleted_at IS NULL)\n',
       E'      AND (co.id IS NULL OR co.deleted_at IS NULL)\n      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n'),
      ('public.get_vr_stiftungen_candidates(integer)',
       E'    AND COALESCE(c.outreach_status, ''pending'') = ''pending''\n',
       E'    AND COALESCE(c.outreach_status, ''pending'') = ''pending''\n    AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n')
    ) AS t(sig, anker, ersatz)
  LOOP
    v_def := pg_get_functiondef(r.sig::regprocedure);
    IF position('firma_ist_kunde' IN v_def) > 0 THEN
      RAISE EXCEPTION 'Bereits gepatcht: %', r.sig;
    END IF;
    v_n := (length(v_def) - length(replace(v_def, r.anker, ''))) / length(r.anker);
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Anker % mal in % (Soll 1)', v_n, r.sig;
    END IF;
    v_neu := replace(v_def, r.anker, r.ersatz);
    EXECUTE v_neu;
  END LOOP;
END
$patch$;