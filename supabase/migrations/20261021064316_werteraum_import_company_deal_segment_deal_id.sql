CREATE OR REPLACE FUNCTION public.werteraum_import_company_deal(p_school_id uuid, p_contact_id uuid, p_stage_id uuid DEFAULT 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid)
 RETURNS TABLE(o_company_id uuid, o_deal_id uuid, o_firma_neu boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c_pipeline constant uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  c_owner    constant uuid := '81de2da3-eef1-4b20-955f-09aed66bc1a3';
  c_default  constant uuid := 'e090b0f7-a646-494d-b069-2dcd0726c5f9';
  s      record;
  v_comp uuid;
  v_deal uuid;
  v_neu  boolean := false;
  v_stage uuid;
begin
  select q.schulname, q.ort, q.website_url, q.schulstufe into s
  from werteraum_school_queue q where q.id = p_school_id;
  if not found then
    raise exception 'Schule % nicht in werteraum_school_queue', p_school_id;
  end if;

  -- Stage nur uebernehmen, wenn sie wirklich zur WerteRaum-Pipeline gehoert
  select ps.id into v_stage
  from pipeline_stages ps
  where ps.id = p_stage_id and ps.pipeline_id = c_pipeline;
  if v_stage is null then
    v_stage := c_default;
  end if;

  select co.id into v_comp from companies co
   where co.deleted_at is null
     and lower(btrim(co.name)) = lower(btrim(s.schulname))
   order by co.created_at limit 1;

  if v_comp is null then
    insert into companies (name, city, website, country, status, source,
                           sponsoring_relevant, exclusion_reason, research_status)
    values (s.schulname, s.ort, s.website_url, 'Deutschland', 'prospect', 'werteraum_import',
            false, 'Schule/Kita - kein Sponsoring-Ziel', 'pending')
    returning id into v_comp;
    v_neu := true;
  end if;

  -- Kern des Fixes vom 30.07.: ohne diese Verknuepfung ist der Kontakt fuer
  -- get_werteraum_candidates unsichtbar. Spalten hier zwingend qualifizieren.
  insert into company_contacts (company_id, contact_id, is_primary, relationship_type)
  select v_comp, p_contact_id, true, 'mitarbeiter'
  where not exists (select 1 from company_contacts cc
                     where cc.company_id = v_comp and cc.contact_id = p_contact_id);

  insert into deals (title, company_id, primary_contact_id, pipeline_id, pipeline_stage_id,
                     status, priority, currency, value_amount, probability_percent, source,
                     owner_user_id, segment)
  values (s.schulname || coalesce(' (' || nullif(btrim(s.ort), '') || ')', ''),
          v_comp, p_contact_id,
          c_pipeline,
          v_stage,
          'open', 'medium', 'EUR', 0, 0, 'werteraum_import',
          c_owner,
          -- 21.10.2026: ohne segment ist der Deal fuer get_werteraum_candidates
          -- (d.segment = p_segment) unsichtbar. Werte der Queue = Werte des CHECK.
          s.schulstufe)
  returning id into v_deal;

  -- 21.10.2026: deal_id zurueck in die Queue (BXGX "Update Queue" schreibt nur
  -- contact_id). Nur wenn noch leer, damit kein bestehender Bezug ueberschrieben wird.
  update werteraum_school_queue q
     set deal_id = v_deal
   where q.id = p_school_id and q.deal_id is null;

  return query select v_comp, v_deal, v_neu;
end $function$
;
