-- 20260730060946_werteraum_kampagnen_plan
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 03b4659815f53d298728b5c79237b60c verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Kampagnensteuerung je Bundesland. Bewusst als Tabelle und nicht als Cron-Datum:
-- der Versand-Workflow fragt taeglich, WELCHE Kampagne heute laeuft. Vor dem jeweiligen
-- Startdatum liefert er nichts - der Workflow darf also gefahrlos aktiv sein.
-- Ferienenden 2026: RLP 07.08., Niedersachsen 12.08., NRW 01.09., BW 12.09.
-- Versandstart jeweils rund eine Woche nach Schulbeginn: in der ersten Schulwoche
-- ist die Schulleitung nicht ansprechbar.
create table if not exists public.werteraum_kampagnen_plan (
  id           uuid primary key default gen_random_uuid(),
  bundesland   text        not null unique,
  start_datum  date        not null,
  end_datum    date,
  utm_content  text        not null,
  tages_limit  integer     not null default 30,
  aktiv        boolean     not null default true,
  notiz        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.werteraum_kampagnen_plan is
  'Steuert den Versandtakt je Bundesland. get_werteraum_aktive_kampagnen() liefert die heute faelligen. Startdatum aendern = Kampagne verschieben, aktiv=false = anhalten.';

insert into public.werteraum_kampagnen_plan (bundesland, start_datum, utm_content, tages_limit, notiz)
values
  ('Rheinland-Pfalz',     date '2026-08-17', 'rlp-w1', 30, 'Ferienende 07.08.'),
  ('Niedersachsen',       date '2026-08-24', 'nds-w1', 30, 'Ferienende 12.08.'),
  ('NRW',                 date '2026-09-07', 'nrw-w1', 30, 'Ferienende 01.09.'),
  ('Baden-Württemberg',   date '2026-09-21', 'bw-w1',  30, 'Ferienende 12.09.')
on conflict (bundesland) do nothing;

alter table public.werteraum_kampagnen_plan enable row level security;
revoke all on public.werteraum_kampagnen_plan from anon, authenticated;
grant all on public.werteraum_kampagnen_plan to service_role;

create or replace function public.get_werteraum_aktive_kampagnen()
returns table (bundesland text, utm_content text, tages_limit integer, start_datum date)
language sql
security definer
set search_path to 'public'
as $$
  select bundesland, utm_content, tages_limit, start_datum
  from werteraum_kampagnen_plan
  where aktiv
    and start_datum <= current_date
    and (end_datum is null or end_datum >= current_date)
  order by start_datum, bundesland;
$$;

revoke all on function public.get_werteraum_aktive_kampagnen() from public, anon;
grant execute on function public.get_werteraum_aktive_kampagnen() to service_role;
