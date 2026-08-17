-- 17.08.2026 — Waechter fuer den unbeaufsichtigten Betrieb.
-- Tomi ist mehrere Tage nicht erreichbar, die Kampagne laeuft weiter.
-- Die Versandkontrolle liefert bisher nur Zahlen; wer sie nicht liest, sieht
-- nichts. Neu ist ein Feld 'alarm' mit klartextlichen Befunden, das die
-- Telegram-Meldung ohne eigene Logik ausgeben kann, plus Bounce- und
-- Reply-Zaehler des Tages.
-- Bestehende Felder bleiben unveraendert, damit die Telegram-Node nicht bricht.

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
         da.deal_id, da.contact_id, d.primary_contact_id, d.pipeline_stage_id
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
),
tag as (
  select
    (select count(*) from mails)                                            as mails_heute,
    (select count(*) from deal_activities
      where activity_type='bounce' and deleted_at is null
        and created_at::date = current_date)                                as bounces_heute,
    (select count(*) from deal_activities
      where activity_type='email_reply' and deleted_at is null
        and created_at::date = current_date)                                as replies_heute,
    (select count(*) from mails where primary_contact_id is distinct from contact_id) as fehlzuordnung,
    (select coalesce(max(n),0) from je_land)                                as groesstes_land,
    (select coalesce(sum(rest),0) from je_kampagne)                          as rest_gesamt,
    (select coalesce(max(tages_limit),0) from k)                            as budget,
    (select count(*) from deals d
       join pipeline_stages ps on ps.id=d.pipeline_stage_id
       join contacts c2 on c2.id=d.primary_contact_id
      where d.pipeline_id='61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
        and d.deleted_at is null and ps.is_outreach_source
        and c2.deleted_at is null and d.segment is null)                    as segment_null,
    (select coalesce(max(x.n),0) from (
       select count(*) as n from mails m join contacts c3 on c3.id=m.contact_id
       group by lower(split_part(c3.email,'@',2))) x)                       as max_pro_domain
),
alarm as (
  select array_remove(array[
    case when t.fehlzuordnung > 0
         then 'ROT: ' || t.fehlzuordnung || ' Mails auf einem Deal, der nicht dem Empfaenger gehoert' end,
    case when t.segment_null > 0
         then 'ROT: ' || t.segment_null || ' Deals ohne segment - werden still uebersprungen' end,
    case when t.mails_heute = 0 and t.rest_gesamt > 0 and extract(dow from current_date) between 1 and 5
         then 'ROT: kein Versand heute, obwohl ' || t.rest_gesamt || ' Kandidaten offen sind' end,
    case when t.mails_heute > t.budget
         then 'ROT: ' || t.mails_heute || ' Mails ueber dem Tagesbudget von ' || t.budget end,
    case when t.max_pro_domain > 3
         then 'GELB: ' || t.max_pro_domain || ' Mails an dieselbe Empfaengerdomain - Domain-Cap pruefen' end,
    case when t.mails_heute > 0 and t.bounces_heute::numeric / greatest(t.mails_heute,1) > 0.15
         then 'GELB: Bounce-Quote ' || round(100.0*t.bounces_heute/t.mails_heute) || ' Prozent' end,
    case when t.replies_heute > 0
         then 'HANDELN: ' || t.replies_heute || ' Antwort(en) heute - Stage Antwort erhalten pruefen' end,
    case when (select max(stat_datum) from werteraum_kampagnen_stats) is distinct from current_date
              and t.mails_heute > 0
         then 'GELB: Plausible-Sync hat heute nichts geschrieben' end,
    case when t.mails_heute > 0 and t.mails_heute < least(t.budget, t.mails_heute + t.rest_gesamt)
         then 'GELB: ' || t.mails_heute || ' Mails statt moeglicher '
              || least(t.budget, t.mails_heute + t.rest_gesamt) end
  ], null) as befunde
  from tag t
)
select json_build_object(
  'datum',  current_date,
  'aktive', (select count(*) from k),
  'budget', (select budget from tag),
  'erwartet', least((select budget from tag),
                    coalesce((select sum(mails_heute + rest) from je_kampagne), 0)),
  'mails',  (select mails_heute from tag),
  'bounces_heute', (select bounces_heute from tag),
  'replies_heute', (select replies_heute from tag),
  'laender', coalesce((select json_agg(json_build_object('bundesland', bundesland, 'n', n)
                                       order by n desc) from je_land), '[]'::json),
  'fremde', coalesce((select sum(jl.n) from je_land jl
                      where not exists (select 1 from k where k.bundesland = jl.bundesland)), 0),
  'deals_mailing_erhalten', (
     select count(distinct m.deal_id) from mails m
     where m.pipeline_stage_id = 'eed128e9-373f-44a1-aaef-f705ce9511da'),
  'fehlzuordnung', (select fehlzuordnung from tag),
  'segment_null', (select segment_null from tag),
  'domain_top', coalesce((select json_agg(x) from (
      select lower(split_part(c.email,'@',2)) as domain, count(*) as n
      from mails m join contacts c on c.id = m.contact_id
      group by 1 having count(*) > 1 order by 2 desc limit 5) x), '[]'::json),
  'kampagnen', coalesce((select json_agg(json_build_object(
        'bundesland', bundesland, 'utm_campaign', utm_campaign, 'tag_nr', tag_nr,
        'mails_heute', mails_heute, 'rest', rest, 'klicks', klicks)
        order by start_datum) from je_kampagne), '[]'::json),
  'klicks', coalesce((select sum(klicks) from je_kampagne), 0),
  'klicks_heute_crm', (select count(*) from deal_activities
                       where activity_type = 'link_click' and deleted_at is null
                         and created_at::date = current_date),
  'tracking_stand', coalesce((select max(stat_datum)::text from werteraum_kampagnen_stats), 'KEINE DATEN'),
  'letzter_reply', coalesce((select max(created_at)::text from deal_activities
                             where activity_type = 'email_reply' and deleted_at is null), 'nie'),
  'alarm', coalesce((select to_json(befunde) from alarm), '[]'::json),
  'alarm_anzahl', coalesce((select array_length(befunde,1) from alarm), 0),
  'max_tag_nr', coalesce((select max(tag_nr) from je_kampagne), 0)
);
$function$;