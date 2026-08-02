-- Kampagnen-Dashboard: "gewonnen" und "geantwortet" auf Statusfelder statt Stage-Namen.
--
-- Warum ueberhaupt, wenn die Zahlen doch stimmen: bei "gewonnen" stimmen sie NUR ZUFAELLIG.
-- Nach der Datenreparatur vom 01.08. liefern Stage-Name 'Gewonnen' und status='won' beide 29.
-- Sobald der naechste Deal in der falschen Stage geparkt wird, laeuft die Karte wieder
-- auseinander — die Definition muss am Status haengen, nicht an einem Stage-Namen.
--
-- Bei "geantwortet" ist die Abweichung schon heute da: Stage 'Antwort erhalten' = 3,
-- contacts.outreach_status = 'replied' = 10. Die Karte hat also sieben Antworten verschwiegen.
--
-- Zusaetzlich: 'laeuft_seit' fuer das Kampagnen-Badge. Bisher zeigte die Karte nur den
-- naechsten Starttermin ("Start 17.08.") und liess die Kampagne dadurch kuenftig aussehen,
-- obwohl sie seit der Bayern-Welle laeuft (erste Wins 19.05.2026).
--
-- Pipeline wird ab hier ueber die ID gebunden, nicht ueber p.name — ein Umbenennen der
-- Pipeline haette die Kennzahlen sonst lautlos auf null gesetzt.
--
-- NICHT geaendert: 'kontaktiert' (s.position >= 2, aktuell 615). Die Stufenlogik ist dort
-- die gewollte Definition; eine Umstellung waere eine fachliche Entscheidung, keine Reparatur.

create or replace function public.get_kampagnen_uebersicht()
returns json
language sql
security definer
set search_path to 'public'
as $$
with wr_queue as (
  select
    count(*)                                                          as leads,
    count(*) filter (where email        is not null and btrim(email)        <> '') as mit_email,
    count(*) filter (where website_url  is not null and btrim(website_url)  <> '') as mit_website,
    count(*) filter (where rektor_name  is not null and btrim(rektor_name)  <> '') as mit_name,
    count(*) filter (where email is not null and btrim(email) <> ''
                       and website_url is not null and btrim(website_url) <> ''
                       and rektor_name is not null and btrim(rektor_name) <> '') as vollstaendig,
    count(*) filter (where scrape_status = 'hold')                     as geparkt
  from werteraum_school_queue
),
wr_deals as (
  select
    count(*) filter (where s.position >= 2)                as kontaktiert,
    -- Antworten haengen am Kontakt, nicht am Deal-Stand: ein Kontakt kann geantwortet haben,
    -- ohne dass jemand den Deal weitergeschoben hat. distinct, weil ein Kontakt mehrere
    -- Deals tragen kann.
    count(distinct d.primary_contact_id)
      filter (where pc.outreach_status = 'replied')        as geantwortet,
    count(*) filter (where d.status = 'won')               as gewonnen,
    -- Startpunkt der Kampagne: erster Gewinn, ersatzweise der aelteste Deal.
    coalesce(min(d.won_at)::date, min(d.created_at)::date) as laeuft_seit
  from deals d
  join pipeline_stages s on s.id = d.pipeline_stage_id
  left join contacts pc  on pc.id = d.primary_contact_id and pc.deleted_at is null
  where d.deleted_at is null
    and d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
),
vr_kontakte as (
  select
    count(distinct c.id)                                                            as leads,
    count(distinct c.id) filter (where c.email is not null and btrim(c.email) <> '') as mit_email,
    count(distinct c.id) filter (where co.website is not null and btrim(co.website) <> '') as mit_website,
    count(distinct c.id) filter (where btrim(coalesce(c.first_name,'')) <> '')       as mit_name
  from contacts c
  join company_contacts cc on cc.contact_id = c.id
  join companies co        on co.id = cc.company_id
  join deals d             on d.company_id = co.id and d.deleted_at is null
  join pipelines p         on p.id = d.pipeline_id
  where c.deleted_at is null and p.name ilike 'Viktoria Rebensburg%'
),
vr_deals as (
  -- Viktoria bleibt bewusst auf der Stage-Logik: dort ist "Terminiert" eine echte Stufe
  -- und kein Statusfeld-Aequivalent. Auftrag betraf nur die WerteRaum-Pipeline.
  select
    count(*) filter (where s.name in ('Infomaterial erhalten','Terminiert','Angebot erstellt','Gewonnen','Verloren')) as kontaktiert,
    count(*) filter (where s.name = 'Terminiert')  as geantwortet,
    count(*) filter (where s.name = 'Gewonnen')    as gewonnen,
    coalesce(min(d.won_at)::date, min(d.created_at)::date) as laeuft_seit
  from deals d
  join pipeline_stages s on s.id = d.pipeline_stage_id
  join pipelines p       on p.id = s.pipeline_id
  where d.deleted_at is null and p.name ilike 'Viktoria Rebensburg%'
)
select json_build_array(
  json_build_object(
    'slug','werteraum', 'name','WerteRaum', 'plausible_site','werteraum-schule.de',
    'leads_label','Schulen in der Queue',
    'leads', q.leads, 'geparkt', q.geparkt,
    'mit_email', q.mit_email, 'mit_website', q.mit_website, 'mit_name', q.mit_name,
    'vollstaendig', q.vollstaendig,
    'angereichert_prozent', case when q.leads = 0 then 0
                                 else round(100.0 * q.mit_email / q.leads) end,
    'kontaktiert', wd.kontaktiert, 'geantwortet', wd.geantwortet, 'gewonnen', wd.gewonnen,
    'laeuft_seit', wd.laeuft_seit,
    'unterkampagnen', (select count(distinct bundesland) from werteraum_school_queue)
  ),
  json_build_object(
    'slug','viktoria', 'name','Viktoria Rebensburg', 'plausible_site','viktoria-roadshow.com',
    'leads_label','Kontakte in der Pipeline',
    'leads', v.leads, 'geparkt', 0,
    'mit_email', v.mit_email, 'mit_website', v.mit_website, 'mit_name', v.mit_name,
    'vollstaendig', least(v.mit_email, v.mit_website, v.mit_name),
    'angereichert_prozent', case when v.leads = 0 then 0
                                 else round(100.0 * v.mit_email / v.leads) end,
    'kontaktiert', vd.kontaktiert, 'geantwortet', vd.geantwortet, 'gewonnen', vd.gewonnen,
    'laeuft_seit', vd.laeuft_seit,
    'unterkampagnen', (select count(*) from pipelines where name ilike 'Viktoria Rebensburg%')
  )
)
from wr_queue q, wr_deals wd, vr_kontakte v, vr_deals vd;
$$;

-- Ebene 2 muss dieselbe Definition benutzen wie Ebene 1. Sonst summiert die
-- Bundesland-Tabelle auf 3 Antworten, waehrend die Karte darueber 10 zeigt.
create or replace function public.get_kampagne_unterkampagnen(p_slug text)
returns json
language sql
security definer
set search_path to 'public'
as $$
select case p_slug

  when 'werteraum' then coalesce((
    select json_agg(row_to_json(x) order by x.leads desc, x.kontaktiert desc)
    from (
      with queue_bl as (
        select
          bundesland,
          count(*)                                                as leads,
          count(*) filter (where scrape_status = 'hold')          as geparkt,
          count(email)                                            as mit_email,
          count(website_url)                                      as mit_website,
          count(rektor_name)                                      as mit_name
        from werteraum_school_queue
        group by bundesland
      ),
      deal_bl as (
        select
          coalesce((
            select c.bundesland from company_contacts cc
              join contacts c on c.id = cc.contact_id
             where cc.company_id = d.company_id and c.bundesland is not null
             limit 1), 'Ohne Zuordnung')                          as bundesland,
          count(*) filter (where s.position >= 2)                 as kontaktiert,
          count(distinct d.primary_contact_id)
            filter (where pc.outreach_status = 'replied')         as geantwortet,
          count(*) filter (where d.status = 'won')                as gewonnen
        from deals d
        join pipeline_stages s on s.id = d.pipeline_stage_id
        left join contacts pc  on pc.id = d.primary_contact_id and pc.deleted_at is null
        where d.deleted_at is null
          and d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
        group by 1
      )
      select
        coalesce(q.bundesland, b.bundesland)      as name,
        coalesce(q.bundesland, b.bundesland)      as key,
        coalesce(q.leads, 0)                      as leads,
        coalesce(q.geparkt, 0)                    as geparkt,
        coalesce(q.mit_email, 0)                  as mit_email,
        coalesce(q.mit_website, 0)                as mit_website,
        coalesce(q.mit_name, 0)                   as mit_name,
        case when coalesce(q.leads,0) = 0 then 0
             else round(100.0 * q.mit_email / q.leads) end as angereichert_prozent,
        coalesce(b.kontaktiert, 0)                as kontaktiert,
        coalesce(b.geantwortet, 0)                as geantwortet,
        coalesce(b.gewonnen, 0)                   as gewonnen,
        k.utm_campaign,
        k.start_datum
      from queue_bl q
      full outer join deal_bl b on b.bundesland = q.bundesland
      left join werteraum_kampagnen_plan k
             on k.bundesland = coalesce(q.bundesland, b.bundesland) and k.aktiv
    ) x
  ), '[]'::json)

  when 'viktoria' then coalesce((
    select json_agg(row_to_json(y) order by y.leads desc)
    from (
      select
        replace(p.name, 'Viktoria Rebensburg - ', '')                 as name,
        p.id::text                                                    as key,
        count(distinct c.id)                                          as leads,
        0                                                             as geparkt,
        count(distinct c.id) filter (where c.email is not null)       as mit_email,
        count(distinct c.id) filter (where co.website is not null)    as mit_website,
        count(distinct c.id) filter (where btrim(coalesce(c.first_name,'')) <> '') as mit_name,
        case when count(distinct c.id) = 0 then 0
             else round(100.0 * count(distinct c.id) filter (where c.email is not null)
                              / count(distinct c.id)) end            as angereichert_prozent,
        count(distinct d.id) filter (where s.name <> 'Qualifiziert')  as kontaktiert,
        count(distinct d.id) filter (where s.name = 'Terminiert')     as geantwortet,
        count(distinct d.id) filter (where s.name = 'Gewonnen')       as gewonnen,
        'outreach2026'::text                                          as utm_campaign,
        null::date                                                    as start_datum
      from pipelines p
      join deals d            on d.pipeline_id = p.id and d.deleted_at is null
      join pipeline_stages s  on s.id = d.pipeline_stage_id
      join companies co       on co.id = d.company_id
      left join company_contacts cc on cc.company_id = co.id
      left join contacts c    on c.id = cc.contact_id and c.deleted_at is null
      where p.name ilike 'Viktoria Rebensburg%'
      group by p.name, p.id
    ) y
  ), '[]'::json)

  else '[]'::json
end;
$$;

-- CREATE OR REPLACE erhaelt die Rechte; hier nur zur Absicherung wiederholt,
-- damit ein Neuanlegen nicht versehentlich anon offenlaesst (vgl. 20260731061932).
revoke execute on function public.get_kampagnen_uebersicht()        from public, anon;
revoke execute on function public.get_kampagne_unterkampagnen(text) from public, anon;
grant  execute on function public.get_kampagnen_uebersicht()        to authenticated;
grant  execute on function public.get_kampagne_unterkampagnen(text) to authenticated;
