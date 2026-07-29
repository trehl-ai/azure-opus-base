-- applied out-of-band via MCP am 2026-07-29, backfill
-- Quelle: supabase_migrations.schema_migrations, Version 20260729100302
-- md5 des Rumpfs unterhalb dieses Kopfes == DB: ba20c98f4c7bc93dc5e1c254c42d2f58

-- Struktureller Dublettenschutz fuer eis_contacts.
-- Bisher haengt er allein am zeitlichen Abstand zwischen zwei Bildern: Match Leads liest den
-- DB-Stand, der VOR den Inserts paralleler Executions galt. Bei einem Telegram-Sammelalbum
-- starten zehn Executions in Millisekunden - ueberlappende Screenshot-Raender wuerden dann
-- doppelt landen. executeOnce ist kein Sperrmechanismus, es begrenzt nur auf das erste Item
-- innerhalb EINER Execution.
--
-- Zwei Schluessel, weil linkedin_url nur bei 10 von 35 Zeilen vorhanden ist:
--   1. linkedin_url, sofern gesetzt - der harte, eindeutige Schluessel
--   2. normalisierter Name + Firma als Rueckfallebene
-- Beide partial, damit NULL-Werte nicht kollidieren.
--
-- WICHTIG fuer den n8n-Flow: Der Node "Insert Contact" ist ein reines POST ohne on_conflict.
-- Ohne den Header "Prefer: resolution=ignore-duplicates" liefert PostgREST bei Kollision 409
-- und der Lead ginge verloren statt uebersprungen zu werden.

CREATE UNIQUE INDEX IF NOT EXISTS eis_contacts_linkedin_url_uidx
  ON public.eis_contacts (lower(linkedin_url))
  WHERE linkedin_url IS NOT NULL AND btrim(linkedin_url) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS eis_contacts_name_company_uidx
  ON public.eis_contacts (
    regexp_replace(lower(coalesce(full_name,'')),   '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(company_name,'')),'[^a-z0-9]', '', 'g')
  )
  WHERE coalesce(btrim(full_name),'') <> '';

COMMENT ON INDEX public.eis_contacts_linkedin_url_uidx IS
'Harter Dublettenschutz ueber die LinkedIn-URL. Verhindert doppelte Leads bei parallelen Telegram-Executions (Sammelalbum).';

COMMENT ON INDEX public.eis_contacts_name_company_uidx IS
'Rueckfall-Dublettenschutz ueber normalisierten Namen und Firma, fuer Leads ohne LinkedIn-URL. Normalisierung entfernt alles ausser a-z0-9, faengt damit Schreibvarianten und Sonderzeichen ab.';;