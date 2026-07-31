-- 20260730061228_werteraum_kampagnen_plan_utm_campaign_rename_v2
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 7347b05dcb5aeb0505e762a51f775ab9 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Umbenannt: der Wert landet im Mail-Link als utm_campaign, NICHT als utm_content.
-- Grund: 'Build Email' schreibt in utm_content bereits die ersten 8 Zeichen der contact_id,
-- und genau darueber ordnet 'EIC — Plausible → CRM Sync' Klicks einzelnen Schulen zu.
-- Das Bundesland dort hineinzuschreiben haette die Kontakt-Zuordnung zerstoert.
alter table public.werteraum_kampagnen_plan rename column utm_content to utm_campaign;

update public.werteraum_kampagnen_plan set utm_campaign = 'werteraum-' || utm_campaign
 where utm_campaign not like 'werteraum-%';

-- Beide Funktionen aendern ihren Rueckgabetyp (Spaltenname) -> DROP ist Pflicht,
-- CREATE OR REPLACE scheitert mit 42P13.
drop function if exists public.get_werteraum_aktive_kampagnen();
create function public.get_werteraum_aktive_kampagnen()
returns table (bundesland text, utm_campaign text, tages_limit integer, start_datum date)
language sql security definer set search_path to 'public'
as $$
  select bundesland, utm_campaign, tages_limit, start_datum
  from werteraum_kampagnen_plan
  where aktiv and start_datum <= current_date
    and (end_datum is null or end_datum >= current_date)
  order by start_datum, bundesland;
$$;

drop function if exists public.get_werteraum_naechste_kampagne();
create function public.get_werteraum_naechste_kampagne()
returns table (bundesland text, utm_campaign text, tages_limit integer,
               start_datum date, offene_kandidaten integer)
language sql security definer set search_path to 'public'
as $$
  select k.bundesland, k.utm_campaign, k.tages_limit, k.start_datum,
         (select count(*)::int from get_werteraum_candidates(100000, k.bundesland))
  from werteraum_kampagnen_plan k
  where k.aktiv
    and k.start_datum <= current_date
    and (k.end_datum is null or k.end_datum >= current_date)
    and (select count(*) from get_werteraum_candidates(1, k.bundesland)) > 0
  order by k.start_datum, k.bundesland
  limit 1;
$$;

revoke all on function public.get_werteraum_aktive_kampagnen() from public, anon;
revoke all on function public.get_werteraum_naechste_kampagne() from public, anon;
grant execute on function public.get_werteraum_aktive_kampagnen()  to service_role;
grant execute on function public.get_werteraum_naechste_kampagne() to service_role;
