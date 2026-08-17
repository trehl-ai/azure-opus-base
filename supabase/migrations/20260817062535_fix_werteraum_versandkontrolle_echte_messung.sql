-- FIX 17.08.2026: drei strukturelle Blindstellen in der Versandkontrolle.
-- 1) bundesland kam aus deals.primary_contact_id statt aus dem echten
--    Empfaenger (deal_activities.contact_id) -> Fehlalarm 'fremde'.
-- 2) deals_mailing_erhalten prueft deals.updated_at. Es gibt keinen
--    updated_at-Trigger auf deals und n8n setzt das Feld nicht ->
--    der Wert war strukturell immer 0. Jetzt aus audit_log.
-- 3) neuer Waechter 'fehlzuordnung': Mails, deren Deal nicht zum
--    Empfaengerkontakt gehoert. Muss dauerhaft 0 sein.
-- 4) 'tracking_stand': macht sichtbar, dass werteraum_kampagnen_stats leer ist,
--    statt klicks=0 als Messung auszugeben.

CREATE OR REPLACE FUNCTION public.get_werteraum_versandkontrolle()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
with k as (
  select * from get_werteraum_aktive_kampagnen()
),
mails as (
  select coalesce(nullif(btrim(c.bundesland), ''), '(ohne Bundesland)') as bundesland,
         da.deal_id, da.contact_id, d.primary_contact_id
  from deal_activities da
  join deals d         on d.id = da.deal_id
  left join contacts c on c.id = da.contact_id
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
         (select count(*) from get_werteraum_candidates(100000, k.bundesland)) as rest,
         coalesce((select sum(s.visitors) from werteraum_kampagnen_stats s
                   where s.utm_campaign = k.utm_campaign), 0)              as klicks
  from k
)
select json_build_object(
  'datum',  current_date,
  'aktive', (select count(*) from k),
  'budget', coalesce((select max(tages_limit) from k), 0),
  'erwartet', least(coalesce((select max(tages_limit) from k), 0),
                    coalesce((select sum(mails_heute + rest) from je_kampagne), 0)),
  'mails',  (select count(*) from mails),
  'laender', coalesce((select json_agg(json_build_object('bundesland', bundesland, 'n', n)
                                       order by n desc) from je_land), '[]'::json),
  'fremde', coalesce((select sum(jl.n) from je_land jl
                      where not exists (select 1 from k where k.bundesland = jl.bundesland)), 0),
  -- Stage-Moves heute aus dem Audit-Log, nicht aus updated_at.
  'deals_mailing_erhalten', (
     select count(*) from audit_log a
     where a.entity_type = 'deals'
       and a.aktion = 'UPDATE'
       and a.created_at::date = current_date
       and a.details->'new'->>'pipeline_stage_id' = 'eed128e9-373f-44a1-aaef-f705ce9511da'
       and a.details->'old'->>'pipeline_stage_id' is distinct from 'eed128e9-373f-44a1-aaef-f705ce9511da'
  ),
  -- Waechter: Aktivitaet haengt an einem Deal, der nicht dem Empfaenger gehoert.
  'fehlzuordnung', (select count(*) from mails
                    where primary_contact_id is distinct from contact_id),
  -- Waechter: mehrere Mails an dieselbe Empfaengerdomain heute.
  'domain_top', coalesce((select json_agg(x) from (
      select lower(split_part(c.email,'@',2)) as domain, count(*) as n
      from mails m join contacts c on c.id = m.contact_id
      group by 1 having count(*) > 1 order by 2 desc limit 5) x), '[]'::json),
  'kampagnen', coalesce((select json_agg(json_build_object(
        'bundesland', bundesland, 'utm_campaign', utm_campaign, 'tag_nr', tag_nr,
        'mails_heute', mails_heute, 'rest', rest, 'klicks', klicks)
        order by start_datum) from je_kampagne), '[]'::json),
  'klicks', coalesce((select sum(klicks) from je_kampagne), 0),
  'tracking_stand', coalesce((select max(stat_datum)::text from werteraum_kampagnen_stats),
                             'KEINE DATEN - Plausible-Sync hat nie geschrieben'),
  'letzter_reply', coalesce((select max(created_at)::text from deal_activities
                             where activity_type = 'email_reply' and deleted_at is null),
                            'nie'),
  'max_tag_nr', coalesce((select max(tag_nr) from je_kampagne), 0)
);
$function$;