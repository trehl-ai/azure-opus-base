-- RBAC Smoke Test — Impersonations-basierter SELECT-Sichtbarkeitstest pro User.
-- Setzt request.jwt.claims (sub = :uid) + ROLE authenticated in einer Transaktion,
-- zaehlt die je RLS sichtbaren Zeilen pro Tabelle und macht ROLLBACK (non-destruktiv).
--
-- Aufruf:
--   psql "$DATABASE_URL" -v uid="'<user-uuid>'" -f scripts/rbac_smoke.sql
--
-- Hinweis: die UUID wird wie oben dokumentiert BEREITS gequotet uebergeben
-- (-v uid="'<user-uuid>'"), daher im SQL die rohe psql-Variable :uid verwenden
-- (NICHT :'uid' — das wuerde den schon gequoteten Wert doppelt quoten).
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', :uid, 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'pipelines' t, count(*) FROM pipelines
UNION ALL SELECT 'deals', count(*) FROM deals
UNION ALL SELECT 'deal_activities', count(*) FROM deal_activities
UNION ALL SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'contacts', count(*) FROM contacts
UNION ALL SELECT 'tasks', count(*) FROM tasks;
ROLLBACK;
