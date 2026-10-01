-- 29.09.2026: Datenleck. anon konnte mit dem publishable Key 10 Objekte ueber PostgREST lesen
-- (5 Tabellen ohne RLS, 5 security_definer-Views), darunter Namen, E-Mail und Telefon
-- (v_werteraum_outreach, v_schneeball_sources, v_eis_connect_queue, v_werteraum_readiness).
-- Entzug fuer anon; authenticated behaelt nur v_werteraum_readiness (Frontend kampagnenDaten.ts).
-- n8n (0uD4, Sj9z, tTlV, IDdl) liest mit service_role und bleibt unberuehrt.
REVOKE ALL ON public.deal_title_city_backup_20260713, public.deal_title_city_backup2_20260713,
              public.werteraum_email_backup_20260806, public.school_domain_city_map,
              public.werteraum_school_import FROM anon, authenticated;
ALTER TABLE public.deal_title_city_backup_20260713  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_title_city_backup2_20260713 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.werteraum_email_backup_20260806  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_domain_city_map           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.werteraum_school_import          ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.v_werteraum_outreach, public.v_schneeball_sources,
              public.v_eis_connect_queue, public.werteraum_lauf_report FROM anon, authenticated;
REVOKE ALL ON public.v_werteraum_readiness FROM anon;

ALTER FUNCTION public.anrede_team_oder_kollegium(text) SET search_path = public;

DO $$
DECLARE o text; objs text[] := ARRAY[
  'public.deal_title_city_backup_20260713','public.deal_title_city_backup2_20260713',
  'public.werteraum_email_backup_20260806','public.school_domain_city_map','public.werteraum_school_import',
  'public.v_werteraum_readiness','public.v_eis_connect_queue','public.werteraum_lauf_report',
  'public.v_werteraum_outreach','public.v_schneeball_sources'];
BEGIN
  FOREACH o IN ARRAY objs LOOP
    IF has_table_privilege('anon', o, 'SELECT') THEN
      RAISE EXCEPTION 'anon hat noch SELECT auf %', o;
    END IF;
    IF NOT has_table_privilege('service_role', o, 'SELECT') THEN
      RAISE EXCEPTION 'service_role hat kein SELECT auf %', o;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('authenticated', 'public.v_werteraum_readiness', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated hat SELECT auf v_werteraum_readiness verloren';
  END IF;
END $$;
