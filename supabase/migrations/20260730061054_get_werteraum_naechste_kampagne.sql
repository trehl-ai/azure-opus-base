-- 20260730061054_get_werteraum_naechste_kampagne
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 1a03a78111b8c8e9e63955123b3eb8a3 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Liefert GENAU EINE Kampagne: die am laengsten laufende, die heute faellig ist UND
-- noch Kandidaten hat. Dadurch arbeiten sich die Wellen nacheinander ab, statt sich zu
-- ueberlagern, sobald mehrere Startdaten erreicht sind.
-- Liefert KEINE Zeile, wenn nichts faellig ist. Der Versand-Workflow bekommt dann 0 Items
-- und laeuft nicht weiter - das ist hier die gewollte Bremse, kein Defekt.
create or replace function public.get_werteraum_naechste_kampagne()
returns table (bundesland text, utm_content text, tages_limit integer,
               start_datum date, offene_kandidaten integer)
language sql
security definer
set search_path to 'public'
as $$
  select k.bundesland, k.utm_content, k.tages_limit, k.start_datum,
         (select count(*)::int from get_werteraum_candidates(100000, k.bundesland)) as offene_kandidaten
  from werteraum_kampagnen_plan k
  where k.aktiv
    and k.start_datum <= current_date
    and (k.end_datum is null or k.end_datum >= current_date)
    and (select count(*) from get_werteraum_candidates(1, k.bundesland)) > 0
  order by k.start_datum, k.bundesland
  limit 1;
$$;

revoke all on function public.get_werteraum_naechste_kampagne() from public, anon;
grant execute on function public.get_werteraum_naechste_kampagne() to service_role;
