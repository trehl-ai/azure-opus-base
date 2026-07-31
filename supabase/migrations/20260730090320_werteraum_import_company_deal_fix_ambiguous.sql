-- 20260730090320_werteraum_import_company_deal_fix_ambiguous
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 cc9449c2045980559295b06e08630152 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- FIX 30.07.2026: der Lauf um 08:00 brach mit 42702 "column reference company_id is
-- ambiguous". Ursache: RETURNS TABLE (company_id ...) deklariert einen OUT-Parameter
-- gleichen Namens wie die Spalte company_contacts.company_id - im WHERE der
-- Existenzpruefung war nicht entscheidbar, welcher gemeint ist.
-- Loesung: OUT-Parameter mit Praefix, zusaetzlich alle Spalten qualifiziert.
drop function if exists public.werteraum_import_company_deal(uuid, uuid, uuid);

create function public.werteraum_import_company_deal(
  p_school_id  uuid,
  p_contact_id uuid,
  p_stage_id   uuid default 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid
)
returns table (o_company_id uuid, o_deal_id uuid, o_firma_neu boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s      record;
  v_comp uuid;
  v_deal uuid;
  v_neu  boolean := false;
begin
  select q.schulname, q.ort, q.website_url into s
  from werteraum_school_queue q where q.id = p_school_id;
  if not found then
    raise exception 'Schule % nicht in werteraum_school_queue', p_school_id;
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
                     status, priority, currency, value_amount, probability_percent, source)
  values (s.schulname || coalesce(' (' || nullif(btrim(s.ort), '') || ')', ''),
          v_comp, p_contact_id,
          '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid,
          coalesce(p_stage_id, 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid),
          'open', 'medium', 'EUR', 0, 0, 'werteraum_import')
  returning id into v_deal;

  return query select v_comp, v_deal, v_neu;
end $$;

revoke all on function public.werteraum_import_company_deal(uuid, uuid, uuid) from public, anon;
grant execute on function public.werteraum_import_company_deal(uuid, uuid, uuid) to service_role;
