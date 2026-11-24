-- Baustufe 2f-1: set_werteraum_termin stilllegen (Schritt 1 von 2: EXECUTE entziehen, DROP spaeter).
-- Die Funktion zieht Deals fest in die WR-Pipeline 61b1b7e2 auf "Terminiert" und wuerde F&A-Deals nach
-- dem Umzug zurueckholen. Seit 29.07.2026 ersetzt durch cal_booking_intake (Kommentar dort:
-- "set_werteraum_termin ist damit ueberfluessig").
-- Aufrufer gemessen 24.11.2026: n8n 0/118 Workflows, Repo 0 (nur Migrationen), DB 0 (Funktionen,
-- Views, Policies, Trigger, pg_depend), Edge Functions 0/13; letzte Schreibspur 29.07.2026.
-- pg_stat_user_functions nicht verfuegbar (track_functions = none).
-- Vorher: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}. Nachher nur Owner.
-- DROP FUNCTION erst nach 14 Tagen ohne Fehler (Wiedervorlage 08.12.2026).

REVOKE EXECUTE ON FUNCTION public.set_werteraum_termin(text, text, timestamp with time zone, text, text) FROM PUBLIC, anon, authenticated, service_role;
