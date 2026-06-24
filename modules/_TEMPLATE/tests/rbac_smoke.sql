-- Modul-RBAC-Smoke — exakt das Muster aus scripts/rbac_smoke.sql, angewandt auf die
-- Modul-Tabellen. Impersoniert einen User (sub = :uid) als authenticated, zaehlt die
-- je RLS sichtbaren Zeilen pro Modul-Tabelle und macht ROLLBACK (non-destruktiv).
--
-- Definition-of-Done: gegen die 4 Rollen-User (admin / management / projektmanager /
-- sales) laufen lassen und die sichtbaren Counts gegen die erwartete Capability-Map
-- pruefen (siehe MODULE.md). Aufruf je User:
--   psql "$DATABASE_URL" -v uid="'<user-uuid>'" -f modules/<modul>/tests/rbac_smoke.sql
--
-- Hinweis: die UUID wird BEREITS gequotet uebergeben (-v uid="'<user-uuid>'"), daher
-- im SQL die rohe psql-Variable :uid verwenden (NICHT :'uid' — das doppelquotet).
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', :uid, 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT '<modul>.widget' t, count(*) FROM <modul>.widget;
ROLLBACK;
