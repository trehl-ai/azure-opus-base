-- 20260731061225_kampagnen_dashboard_rpcs
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 2a1c8d6d4e0dc457c7de0a3ad233169f verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Kampagnen-Dashboard, drei Ebenen.
-- Ebene 1: get_kampagnen_uebersicht()      — eine Zeile je Kampagne
-- Ebene 2: get_kampagne_unterkampagnen()   — WerteRaum je Bundesland, Viktoria je Zielgruppe
-- Ebene 3: get_kampagne_detail()           — Stages + Anreicherung einer Unterkampagne
--
-- "Leads" ist bewusst je Kampagne verschieden definiert und wird im Feld leads_label
-- mitgeliefert, damit die Oberflaeche nicht Aepfel mit Birnen beschriftet:
--   WerteRaum = Schulen in werteraum_school_queue (Festlegung Tomi, 31.07.2026)
--   Viktoria  = Kontakte, die ueber company_contacts an einem Deal der Pipeline haengen

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
    count(*) filter (where s.name = 'Antwort erhalten')    as geantwortet,
    count(*) filter (where s.name = 'Gewonnen')            as gewonnen
  from deals d
  join pipeline_stages s on s.id = d.pipeline_stage_id
  join pipelines p       on p.id = s.pipeline_id
  where d.deleted_at is null and p.name = 'Werteraum - Schulen'
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
  select
    count(*) filter (where s.name in ('Infomaterial erhalten','Terminiert','Angebot erstellt','Gewonnen','Verloren')) as kontaktiert,
    count(*) filter (where s.name = 'Terminiert')  as geantwortet,
    count(*) filter (where s.name = 'Gewonnen')    as gewonnen
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
    'unterkampagnen', (select count(*) from pipelines where name ilike 'Viktoria Rebensburg%')
  )
)
from wr_queue q, wr_deals wd, vr_kontakte v, vr_deals vd;
$$;


create or replace function public.get_kampagne_unterkampagnen(p_slug text)
returns json
language sql
security definer
set search_path to 'public'
as $$
select case p_slug

  when 'werteraum' then coalesce((
    select json_agg(row_to_json(x) order by x.leads desc)
    from (
      select
        q.bundesland                                                  as name,
        q.bundesland                                                  as key,
        count(*)                                                      as leads,
        count(*) filter (where q.scrape_status = 'hold')              as geparkt,
        count(q.email)                                                as mit_email,
        count(q.website_url)                                          as mit_website,
        count(q.rektor_name)                                          as mit_name,
        case when count(*) = 0 then 0
             else round(100.0 * count(q.email) / count(*)) end        as angereichert_prozent,
        count(d.id) filter (where s.position >= 2)                    as kontaktiert,
        count(d.id) filter (where s.name = 'Gewonnen')                as gewonnen,
        k.utm_campaign,
        k.start_datum
      from werteraum_school_queue q
      left join company_contacts cc on cc.contact_id = q.contact_id
      left join deals d  on d.company_id = cc.company_id and d.deleted_at is null
      left join pipeline_stages s on s.id = d.pipeline_stage_id
      left join werteraum_kampagnen_plan k on k.bundesland = q.bundesland and k.aktiv
      group by q.bundesland, k.utm_campaign, k.start_datum
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
                              / count(distinct c.id)) end             as angereichert_prozent,
        count(distinct d.id) filter (where s.name <> 'Qualifiziert')  as kontaktiert,
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


create or replace function public.get_kampagne_detail(p_slug text, p_key text)
returns json
language sql
security definer
set search_path to 'public'
as $$
select case p_slug

  when 'werteraum' then json_build_object(
    'stages', coalesce((
      select json_agg(row_to_json(s2) order by s2.position)
      from (
        select s.name, s.position, count(d.id) as deals
        from pipeline_stages s
        join pipelines p on p.id = s.pipeline_id and p.name = 'Werteraum - Schulen'
        left join deals d on d.pipeline_stage_id = s.id and d.deleted_at is null
          and exists (
            select 1 from company_contacts cc
            join werteraum_school_queue q on q.contact_id = cc.contact_id
            where cc.company_id = d.company_id and q.bundesland = p_key)
        group by s.name, s.position
      ) s2), '[]'::json),
    'queue', coalesce((
      select json_agg(row_to_json(t))
      from (
        select scrape_status, score_status, count(*) as n
        from werteraum_school_queue where bundesland = p_key
        group by scrape_status, score_status order by 3 desc
      ) t), '[]'::json),
    'schulstufen', coalesce((
      select json_agg(row_to_json(u))
      from (
        select coalesce(schulstufe,'unbekannt') as schulstufe, count(*) as n
        from werteraum_school_queue where bundesland = p_key
        group by 1 order by 2 desc
      ) u), '[]'::json),
    'kampagne', (select row_to_json(k) from werteraum_kampagnen_plan k
                 where k.bundesland = p_key and k.aktiv limit 1)
  )

  when 'viktoria' then json_build_object(
    'stages', coalesce((
      select json_agg(row_to_json(s3) order by s3.position)
      from (
        select s.name, s.position, count(d.id) as deals
        from pipeline_stages s
        left join deals d on d.pipeline_stage_id = s.id and d.deleted_at is null
        where s.pipeline_id = p_key::uuid
        group by s.name, s.position
      ) s3), '[]'::json),
    'queue', '[]'::json,
    'schulstufen', '[]'::json,
    'kampagne', null
  )

  else '{}'::json
end;
$$;

grant execute on function public.get_kampagnen_uebersicht()                to authenticated;
grant execute on function public.get_kampagne_unterkampagnen(text)         to authenticated;
grant execute on function public.get_kampagne_detail(text, text)           to authenticated;
