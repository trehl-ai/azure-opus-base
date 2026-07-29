-- applied out-of-band via MCP am 2026-07-29, backfill
-- Quelle: supabase_migrations.schema_migrations, Version 20260729115827
-- md5 des Rumpfs unterhalb dieses Kopfes == DB: 23b4c874527058df1be7cf6d079de08a

-- Insert-Guard fuer den Telegram-Intake (DZDA9abY5hcF1kgW, Node "Insert Contact").
-- Grund: eis_contacts hat zwei UNIQUE-AUSDRUCKS-Indexe
--   eis_contacts_linkedin_url_uidx  auf lower(linkedin_url)
--   eis_contacts_name_company_uidx  auf regexp_replace(lower(full_name)|lower(company_name), '[^a-z0-9]','','g')
-- PostgREST kann die nicht abdecken: ohne ?on_conflict zielt "Prefer: resolution=ignore-duplicates"
-- auf den Primaerschluessel (id) und laesst 23505 der anderen Indexe durch (-> HTTP 409);
-- mit ?on_conflict=<spalte> gibt es 42P10, weil ON CONFLICT nur Spalten adressieren kann,
-- keine Ausdruecke. Nur das ZIELLOSE "ON CONFLICT DO NOTHING" deckt beide ab, und das
-- laesst sich ausschliesslich in einer Funktion formulieren.
--
-- Rueckgabe SETOF: eingefuegte Zeile -> 1 Element, uebersprungene Dublette -> leeres Array.
-- Damit feuert der nachgelagerte Node "Trigger Research" nur fuer echte Neuzugaenge.
-- Echte Fehler (NOT NULL, CHECK, falscher Typ) schlagen weiterhin durch und landen im
-- Fehlerzweig des Nodes -- DO NOTHING greift ausschliesslich bei Unique-Verletzungen.

CREATE OR REPLACE FUNCTION public.eis_contacts_insert(p_row jsonb)
RETURNS SETOF public.eis_contacts
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  INSERT INTO public.eis_contacts (
    first_name, last_name, title, company_name, email, phone,
    final_score, lead_queue_id, linkedin_url, outreach_status, connected_on
  )
  VALUES (
    nullif(btrim(p_row->>'first_name'), ''),
    nullif(btrim(p_row->>'last_name'), ''),
    nullif(btrim(p_row->>'title'), ''),
    nullif(btrim(p_row->>'company_name'), ''),
    nullif(btrim(p_row->>'email'), ''),
    nullif(btrim(p_row->>'phone'), ''),
    coalesce(nullif(p_row->>'final_score','')::integer, 0),
    nullif(p_row->>'lead_queue_id','')::uuid,
    nullif(btrim(p_row->>'linkedin_url'), ''),
    coalesce(nullif(btrim(p_row->>'outreach_status'), ''), 'connected'),
    coalesce(nullif(p_row->>'connected_on','')::date, current_date)
  )
  ON CONFLICT DO NOTHING
  RETURNING *;
$function$;

REVOKE ALL ON FUNCTION public.eis_contacts_insert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eis_contacts_insert(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.eis_contacts_insert(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.eis_contacts_insert(jsonb) TO service_role;

COMMENT ON FUNCTION public.eis_contacts_insert(jsonb) IS
'Insert-Guard fuer eis_contacts. Zielloses ON CONFLICT DO NOTHING deckt beide Ausdrucks-Unique-Indexe ab, was PostgREST nativ nicht kann. Dublette -> leeres Array statt HTTP 409. Aufrufer: n8n DZDA9abY5hcF1kgW Node "Insert Contact". Nur service_role.';

NOTIFY pgrst, 'reload schema';;