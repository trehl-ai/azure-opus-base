-- 20260731061404_kampagnen_dashboard_zuordnung_fix
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 d43c2dbdbcd9fb2866eeee6963a9c7dc verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Korrektur der Deal-Zuordnung je Bundesland.
--
-- Erste Fassung ordnete Deals ueber werteraum_school_queue.contact_id zu — damit waren nur
-- 245 von 615 kontaktierten Deals erreichbar, und Ebene 2 summierte sich nicht auf Ebene 1.
-- Belastbar ist contacts.bundesland: 582 von 615. Die restlichen 33 (und 10 der 30
-- gewonnenen) haben ueberhaupt kein Bundesland — die erscheinen jetzt als eigene Zeile
-- "Ohne Zuordnung", statt stillschweigend zu verschwinden.

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
          count(*) filter (where s.position >= 2)                  as kontaktiert,
          count(*) filter (where s.name = 'Antwort erhalten')      as geantwortet,
          count(*) filter (where s.name = 'Gewonnen')              as gewonnen
        from deals d
        join pipeline_stages s on s.id = d.pipeline_stage_id
        join pipelines p       on p.id = s.pipeline_id
        where d.deleted_at is null and p.name = 'Werteraum - Schulen'
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
        select s.name, s.position,
               count(d.id) filter (where
                 coalesce((select c.bundesland from company_contacts cc
                             join contacts c on c.id = cc.contact_id
                            where cc.company_id = d.company_id and c.bundesland is not null
                            limit 1), 'Ohne Zuordnung') = p_key) as deals
        from pipeline_stages s
        join pipelines p on p.id = s.pipeline_id and p.name = 'Werteraum - Schulen'
        left join deals d on d.pipeline_stage_id = s.id and d.deleted_at is null
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
