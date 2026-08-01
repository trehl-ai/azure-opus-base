-- Wirkungskontrolle, jetzt gegen die tatsaechliche Zuteilung statt gegen eine feste 30.
--
-- Fallstrick, der den naiven Ansatz LEAST(tages_limit, count(candidates)) falsch macht:
-- get_werteraum_candidates schliesst Kontakte aus, die bereits eine email-Aktivitaet haben.
-- 30 Minuten NACH dem Versand sind die heute gemailten Schulen also nicht mehr in der Menge.
-- Wer die Kandidaten jetzt zaehlt, sieht den REST, nicht den Vorrat vor dem Versand.
-- Bei RLP mit genau 5 Kandidaten waere die Erwartung nach dem Versand 0, tatsaechlich 5 —
-- also genau der Fehlalarm, der vermieden werden soll.
-- Richtig ist: Vorrat vor dem Versand = heute gemailt + noch offen.
create or replace function public.get_werteraum_versandkontrolle()
returns json
language sql
security definer
set search_path to 'public'
as $$
with k as (
  select * from get_werteraum_aktive_kampagnen()
),
mails as (
  select coalesce(nullif(btrim(c.bundesland), ''), '(ohne Bundesland)') as bundesland
  from deal_activities da
  join deals d         on d.id = da.deal_id
  left join contacts c on c.id = d.primary_contact_id
  where da.activity_type = 'email'
    and da.deleted_at is null
    and da.created_at::date = current_date
),
je_land as (
  select bundesland, count(*) as n from mails group by 1
),
je_kampagne as (
  select k.bundesland, k.utm_campaign, k.tages_limit, k.start_datum,
         (current_date - k.start_datum) + 1                                as tag_nr,
         coalesce((select jl.n from je_land jl
                   where jl.bundesland = k.bundesland), 0)                 as mails_heute,
         (select count(*) from get_werteraum_candidates(3000, k.bundesland)) as rest,
         coalesce((select sum(s.visitors) from werteraum_kampagnen_stats s
                   where s.utm_campaign = k.utm_campaign), 0)              as klicks
  from k
)
select json_build_object(
  'datum',  current_date,
  'aktive', (select count(*) from k),
  -- Tagesbudget wie im Versand: das groesste Einzellimit, nicht die Summe.
  'budget', coalesce((select max(tages_limit) from k), 0),
  -- Erwartung = was heute ueberhaupt versendbar war, gedeckelt aufs Tagesbudget.
  'erwartet', least(coalesce((select max(tages_limit) from k), 0),
                    coalesce((select sum(mails_heute + rest) from je_kampagne), 0)),
  'mails',  (select count(*) from mails),
  'laender', coalesce((select json_agg(json_build_object('bundesland', bundesland, 'n', n)
                                       order by n desc) from je_land), '[]'::json),
  -- "fremd" heisst: ausserhalb ALLER heute aktiven Kampagnen. Ab 24.08. sind das mehrere,
  -- ein fester Vergleich gegen 'Rheinland-Pfalz' waere dann selbst der Fehlalarm.
  'fremde', coalesce((select sum(jl.n) from je_land jl
                      where not exists (select 1 from k where k.bundesland = jl.bundesland)), 0),
  'deals_mailing_erhalten', (select count(*) from deals d
     where d.pipeline_stage_id = 'eed128e9-373f-44a1-aaef-f705ce9511da'
       and d.deleted_at is null
       and d.updated_at::date = current_date),
  'kampagnen', coalesce((select json_agg(json_build_object(
        'bundesland', bundesland, 'utm_campaign', utm_campaign, 'tag_nr', tag_nr,
        'mails_heute', mails_heute, 'rest', rest, 'klicks', klicks)
        order by start_datum) from je_kampagne), '[]'::json),
  'klicks', coalesce((select sum(klicks) from je_kampagne), 0),
  'max_tag_nr', coalesce((select max(tag_nr) from je_kampagne), 0)
);
$$;

revoke execute on function public.get_werteraum_versandkontrolle() from public, anon;
grant execute on function public.get_werteraum_versandkontrolle() to authenticated, service_role;