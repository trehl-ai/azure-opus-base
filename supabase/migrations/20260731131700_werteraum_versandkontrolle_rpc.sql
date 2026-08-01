-- Wirkungskontrolle fuer den WerteRaum-Versand. Liest nur, aendert nichts.
-- Bewusst EINE Funktion statt vier PostgREST-Abfragen: Pruefung 2 braucht den Join
-- deal_activities -> deals -> contacts, und den ueber PostgREST-Embedding zu bauen waere
-- fragiler als eine Zeile SQL.
create or replace function public.get_werteraum_versandkontrolle()
returns json
language sql
security definer
set search_path to 'public'
as $$
with mails as (
  select da.deal_id
  from deal_activities da
  where da.activity_type = 'email'
    and da.deleted_at is null
    and da.created_at::date = current_date
),
empfaenger as (
  select coalesce(nullif(btrim(c.bundesland), ''), '(ohne Bundesland)') as bundesland,
         count(*) as n
  from mails m
  join deals d      on d.id = m.deal_id
  left join contacts c on c.id = d.primary_contact_id
  group by 1
)
select json_build_object(
  'datum', current_date,
  -- 1. Sind Mails rausgegangen?
  'mails', (select count(*) from mails),
  -- 2. Stimmt die Kampagnenzuordnung?
  'laender', coalesce((select json_agg(json_build_object('bundesland', bundesland, 'n', n)
                                       order by n desc) from empfaenger), '[]'::json),
  'fremde', coalesce((select sum(n) from empfaenger
                      where bundesland <> 'Rheinland-Pfalz'), 0),
  -- 3. Sind die Deals gewandert?
  'deals_mailing_erhalten', (select count(*) from deals d
     where d.pipeline_stage_id = 'eed128e9-373f-44a1-aaef-f705ce9511da'
       and d.deleted_at is null
       and d.updated_at::date = current_date),
  -- 4. Kommt das Tracking an? (gefuellt vom Plausible-Sync, alle 30 Min)
  'klicks', coalesce((select sum(visitors) from werteraum_kampagnen_stats
                      where utm_campaign = 'werteraum-rlp-w1'), 0),
  'klicks_heute', coalesce((select sum(visitors) from werteraum_kampagnen_stats
                            where utm_campaign = 'werteraum-rlp-w1'
                              and stat_datum = current_date), 0)
);
$$;

revoke execute on function public.get_werteraum_versandkontrolle() from public, anon;
grant execute on function public.get_werteraum_versandkontrolle() to authenticated, service_role;