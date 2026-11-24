-- Baustufe 2g-D3: Kampagnenseite nach Entscheidung 3 (Pipeline = Produkt).
-- Die Schul-Pipeline unter Viktoria ("Viktoria Rebensburg - Schulen", feste ID ffcb34b3) zaehlt auf
-- der Viktoria-Karte, in der Viktoria-Liste und im Viktoria-Detail mit der Logik der WerteRaum-Karte:
-- Leads = Queue-Zeilen ihrer Deals, kontaktiert = Stufe ab "Mailing erhalten" der eigenen Pipeline,
-- geantwortet = Hauptkontakt mit outreach_status replied, gewonnen = status won.
-- Queue-Zeilen, deren Deal in ffcb34b3 liegt, fallen aus WerteRaum-Karte, -Liste und -Detail heraus.
-- Damit bleibt WerteRaum + Viktoria beim Umzug gleich (Rollback-Test 3 und 1012 Deals).
-- Kosmetik: fester Zweitschluessel name bei den Stufen im Detail; Viktoria-Zaehler "unterkampagnen"
-- zaehlt dieselben Pipelines wie die Liste (heute 3 -> 2).
-- Signaturen, VOLATILE (nur SELECT), SECURITY DEFINER, search_path und Grants unveraendert.
-- Aufrufer: Frontend kampagnenDaten.ts:83/100, CampaignDetail.tsx:519.

CREATE OR REPLACE FUNCTION public.get_kampagnen_uebersicht()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- Baustufe 2g-D3 (Entscheidung 3, Pipeline = Produkt): Schul-Pipelines unter Viktoria (heute nur
-- "Viktoria Rebensburg - Schulen" ffcb34b3) zaehlen auf der Viktoria-Karte mit der Logik der
-- WerteRaum-Karte: Leads = Queue-Zeilen ihrer Deals, kontaktiert = Stufe ab "Mailing erhalten"
-- der eigenen Pipeline, geantwortet = Kontakt mit outreach_status replied, gewonnen = status won.
-- Queue-Zeilen, deren Deal in einer solchen Pipeline liegt, fallen aus der WerteRaum-Karte heraus.
-- Damit bleibt WerteRaum + Viktoria beim Umzug gleich.
with vr_schul as (
  select array['ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid] as ids
),
q_all as (
  select q.*, coalesce(d.pipeline_id = any((select ids from vr_schul)::uuid[]), false) as in_vr_schul
  from werteraum_school_queue q
  left join deals d on d.id = q.deal_id and d.deleted_at is null
),
wr_queue as (
  select
    count(*)                                                          as leads,
    count(*) filter (where email        is not null and btrim(email)        <> '') as mit_email,
    count(*) filter (where website_url  is not null and btrim(website_url)  <> '') as mit_website,
    count(*) filter (where rektor_name  is not null and btrim(rektor_name)  <> '') as mit_name,
    count(*) filter (where email is not null and btrim(email) <> ''
                       and website_url is not null and btrim(website_url) <> ''
                       and rektor_name is not null and btrim(rektor_name) <> '') as vollstaendig,
    count(*) filter (where scrape_status = 'hold')                     as geparkt
  from q_all where not in_vr_schul
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
    and p.id <> all((select ids from vr_schul)::uuid[])
),
vr_schul_queue as (
  select
    count(*)                                                          as leads,
    count(*) filter (where email        is not null and btrim(email)        <> '') as mit_email,
    count(*) filter (where website_url  is not null and btrim(website_url)  <> '') as mit_website,
    count(*) filter (where rektor_name  is not null and btrim(rektor_name)  <> '') as mit_name,
    count(*) filter (where email is not null and btrim(email) <> ''
                       and website_url is not null and btrim(website_url) <> ''
                       and rektor_name is not null and btrim(rektor_name) <> '') as vollstaendig
  from q_all where in_vr_schul
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
    and p.id <> all((select ids from vr_schul)::uuid[])
),
vr_schul_deals as (
  select
    count(*) filter (where s.position >= (select m.position from pipeline_stages m
                                           where m.pipeline_id = d.pipeline_id and m.name = 'Mailing erhalten')) as kontaktiert,
    count(distinct d.primary_contact_id)
      filter (where pc.outreach_status = 'replied')        as geantwortet,
    count(*) filter (where d.status = 'won')               as gewonnen,
    coalesce(min(d.won_at)::date, min(d.created_at)::date) as laeuft_seit
  from deals d
  join pipeline_stages s on s.id = d.pipeline_stage_id
  left join contacts pc  on pc.id = d.primary_contact_id and pc.deleted_at is null
  where d.deleted_at is null
    and d.pipeline_id = any((select ids from vr_schul)::uuid[])
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
    'unterkampagnen', (select count(distinct bundesland) from q_all where not in_vr_schul)
  ),
  json_build_object(
    'slug','viktoria', 'name','Viktoria Rebensburg', 'plausible_site','viktoria-roadshow.com',
    'leads_label','Kontakte in der Pipeline',
    'leads', v.leads + vq.leads, 'geparkt', 0,
    'mit_email', v.mit_email + vq.mit_email, 'mit_website', v.mit_website + vq.mit_website,
    'mit_name', v.mit_name + vq.mit_name,
    'vollstaendig', least(v.mit_email, v.mit_website, v.mit_name) + vq.vollstaendig,
    'angereichert_prozent', case when v.leads + vq.leads = 0 then 0
                                 else round(100.0 * (v.mit_email + vq.mit_email) / (v.leads + vq.leads)) end,
    'kontaktiert', vd.kontaktiert + vsd.kontaktiert,
    'geantwortet', vd.geantwortet + vsd.geantwortet,
    'gewonnen', vd.gewonnen + vsd.gewonnen,
    'laeuft_seit', least(vd.laeuft_seit, vsd.laeuft_seit),
    -- 2g-D3 (Kosmetik 4): zaehlt dieselben Pipelines wie die Liste in
    -- get_kampagne_unterkampagnen('viktoria'): nur Pipelines mit Deals an einer Firma.
    'unterkampagnen', (select count(distinct p.id) from pipelines p
                         join deals d on d.pipeline_id = p.id and d.deleted_at is null
                         join companies co on co.id = d.company_id
                        where p.name ilike 'Viktoria Rebensburg%')
  )
)
from wr_queue q, wr_deals wd, vr_kontakte v, vr_schul_queue vq, vr_deals vd, vr_schul_deals vsd;
$function$;

CREATE OR REPLACE FUNCTION public.get_kampagne_unterkampagnen(p_slug text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- Baustufe 2g-D3 (Entscheidung 3): Schul-Pipelines unter Viktoria (heute ffcb34b3) erscheinen in
-- der Viktoria-Liste mit der WerteRaum-Logik (Leads = Queue-Zeilen ihrer Deals, kontaktiert ab
-- "Mailing erhalten" der eigenen Pipeline, geantwortet = Kontakt replied, gewonnen = status won);
-- ihre Queue-Zeilen fallen aus der WerteRaum-Liste heraus.
select case p_slug

  when 'werteraum' then coalesce((
    select json_agg(row_to_json(x) order by x.leads desc, x.kontaktiert desc)
    from (
      with queue_bl as (
        select
          q.bundesland,
          count(*)                                                as leads,
          count(*) filter (where q.scrape_status = 'hold')        as geparkt,
          count(q.email)                                          as mit_email,
          count(q.website_url)                                    as mit_website,
          count(q.rektor_name)                                    as mit_name
        from werteraum_school_queue q
        left join deals qd on qd.id = q.deal_id and qd.deleted_at is null
        where qd.pipeline_id is distinct from 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
        group by q.bundesland
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
        and p.id <> 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
      group by p.name, p.id

      union all

      -- Schul-Pipeline: WerteRaum-Logik; nur wenn sie Deals an einer Firma hat (wie die Zeilen oben)
      select
        replace(p.name, 'Viktoria Rebensburg - ', ''),
        p.id::text,
        (select count(*) from werteraum_school_queue q join deals qd on qd.id = q.deal_id and qd.deleted_at is null
          where qd.pipeline_id = p.id),
        (select count(*) from werteraum_school_queue q join deals qd on qd.id = q.deal_id and qd.deleted_at is null
          where qd.pipeline_id = p.id and q.scrape_status = 'hold')::int,
        (select count(q.email) from werteraum_school_queue q join deals qd on qd.id = q.deal_id and qd.deleted_at is null
          where qd.pipeline_id = p.id),
        (select count(q.website_url) from werteraum_school_queue q join deals qd on qd.id = q.deal_id and qd.deleted_at is null
          where qd.pipeline_id = p.id),
        (select count(q.rektor_name) from werteraum_school_queue q join deals qd on qd.id = q.deal_id and qd.deleted_at is null
          where qd.pipeline_id = p.id),
        (select case when count(*) = 0 then 0 else round(100.0 * count(q.email) / count(*)) end
           from werteraum_school_queue q join deals qd on qd.id = q.deal_id and qd.deleted_at is null
          where qd.pipeline_id = p.id),
        count(*) filter (where s.position >= (select m.position from pipeline_stages m
                                               where m.pipeline_id = p.id and m.name = 'Mailing erhalten')),
        count(distinct d.primary_contact_id) filter (where pc.outreach_status = 'replied'),
        count(*) filter (where d.status = 'won'),
        'outreach2026'::text,
        null::date
      from pipelines p
      join deals d            on d.pipeline_id = p.id and d.deleted_at is null
      join pipeline_stages s  on s.id = d.pipeline_stage_id
      join companies co       on co.id = d.company_id
      left join contacts pc   on pc.id = d.primary_contact_id and pc.deleted_at is null
      where p.id = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
      group by p.name, p.id
    ) y
  ), '[]'::json)

  else '[]'::json
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_kampagne_detail(p_slug text, p_key text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- Baustufe 2g-D3: fester Zweitschluessel name bei den Stufen (mehrere Stufen teilen Position 1).
-- Entscheidung 3: Queue/Schulstufen der WerteRaum-Bundeslaender ohne Zeilen, deren Deal in der
-- Schul-Pipeline unter Viktoria (ffcb34b3) liegt; die Viktoria-Detailansicht dieser Pipeline
-- zeigt dafuer ihre Queue-Zeilen und Schulstufen.
select case p_slug

  when 'werteraum' then json_build_object(
    'stages', coalesce((
      select json_agg(row_to_json(s2) order by s2.position, s2.name)
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
        select q.scrape_status, q.score_status, count(*) as n
        from werteraum_school_queue q
        left join deals qd on qd.id = q.deal_id and qd.deleted_at is null
        where q.bundesland = p_key
          and qd.pipeline_id is distinct from 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
        group by q.scrape_status, q.score_status order by 3 desc
      ) t), '[]'::json),
    'schulstufen', coalesce((
      select json_agg(row_to_json(u))
      from (
        select coalesce(q.schulstufe,'unbekannt') as schulstufe, count(*) as n
        from werteraum_school_queue q
        left join deals qd on qd.id = q.deal_id and qd.deleted_at is null
        where q.bundesland = p_key
          and qd.pipeline_id is distinct from 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
        group by 1 order by 2 desc
      ) u), '[]'::json),
    'kampagne', (select row_to_json(k) from werteraum_kampagnen_plan k
                 where k.bundesland = p_key and k.aktiv limit 1)
  )

  when 'viktoria' then json_build_object(
    'stages', coalesce((
      select json_agg(row_to_json(s3) order by s3.position, s3.name)
      from (
        select s.name, s.position, count(d.id) as deals
        from pipeline_stages s
        left join deals d on d.pipeline_stage_id = s.id and d.deleted_at is null
        where s.pipeline_id = p_key::uuid
        group by s.name, s.position
      ) s3), '[]'::json),
    'queue', coalesce((
      select json_agg(row_to_json(t))
      from (
        select q.scrape_status, q.score_status, count(*) as n
        from werteraum_school_queue q
        join deals qd on qd.id = q.deal_id and qd.deleted_at is null
        where p_key = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'
          and qd.pipeline_id = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
        group by q.scrape_status, q.score_status order by 3 desc
      ) t), '[]'::json),
    'schulstufen', coalesce((
      select json_agg(row_to_json(u))
      from (
        select coalesce(q.schulstufe,'unbekannt') as schulstufe, count(*) as n
        from werteraum_school_queue q
        join deals qd on qd.id = q.deal_id and qd.deleted_at is null
        where p_key = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'
          and qd.pipeline_id = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid
        group by 1 order by 2 desc
      ) u), '[]'::json),
    'kampagne', null
  )

  else '{}'::json
end;
$function$;
