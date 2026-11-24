-- EXECUTE-Haertung: sechs Funktionen ohne Frontend-Aufruf (go Tomi 24.11.2026).
-- Gemessen 24.11.2026: Repo src/ + supabase/functions 0 rpc-Aufrufe; Edge Functions 0/13 (inkl. deploytem
-- academy-intel-trigger); n8n 118 Workflows: wr_mail_event (DQWG, PWkk), wr_tageswaechter (gyBX),
-- get_werteraum_candidates (l5oY) per REST mit Credential "EIC — Supabase Service Role"; korrigiere_mailadresse
-- und notify_* nicht per REST. Alle DB-Aufrufer von get_werteraum_candidates sind SECURITY DEFINER.
-- notify_* sind Trigger-Funktionen: EXECUTE wird beim Feuern nicht geprueft (Rollback-Test 24.11.:
-- authenticated ohne EXECUTE, Trigger feuert).
-- Vorher: notify_* {=X,postgres,anon,authenticated,service_role}; die vier anderen {postgres,authenticated,service_role}.

REVOKE EXECUTE ON FUNCTION public.korrigiere_mailadresse(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_second_mailing_scheduled() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_erneutes_mailing_scheduled() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_werteraum_candidates(integer, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wr_tageswaechter() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wr_mail_event(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_werteraum_candidates(integer, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.wr_tageswaechter() TO service_role;
GRANT EXECUTE ON FUNCTION public.wr_mail_event(text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
