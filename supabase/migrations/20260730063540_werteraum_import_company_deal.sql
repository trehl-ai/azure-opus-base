-- 20260730063540_werteraum_import_company_deal
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 33f5debaa5b2d8160b76b5b124e1e95d verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Ersetzt den Node 'Create Deal' in WF BXGXA8Hg1fIZZEwt.
-- Der Node legte einen Deal mit primary_contact_id an, aber OHNE company_id und ohne
-- Firma - deshalb fehlte die Kette contact -> company_contacts -> companies -> deals,
-- die get_werteraum_candidates zwingend verlangt. Ergebnis: 596 recherchierte Schulen
-- waren fuer den Versand unsichtbar (Analyse 30.07.2026).
-- Diese Funktion macht Firma, Verknuepfung und Deal in einem Schritt und kennzeichnet
-- die Firma sofort als Schule, damit die Labelluecke gar nicht erst entsteht.
create or replace function public.werteraum_import_company_deal(
  p_school_id  uuid,
  p_contact_id uuid,
  p_stage_id   uuid default 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid
)
returns table (company_id uuid, deal_id uuid, firma_neu boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s        record;
  v_comp   uuid;
  v_deal   uuid;
  v_neu    boolean := false;
begin
  select schulname, ort, website_url, bundesland into s
  from werteraum_school_queue where id = p_school_id;
  if not found then
    raise exception 'Schule % nicht in werteraum_school_queue', p_school_id;
  end if;

  select id into v_comp from companies
   where deleted_at is null and lower(btrim(name)) = lower(btrim(s.schulname))
   order by created_at limit 1;

  if v_comp is null then
    insert into companies (name, city, website, country, status, source,
                           sponsoring_relevant, exclusion_reason, research_status)
    values (s.schulname, s.ort, s.website_url, 'Deutschland', 'prospect', 'werteraum_import',
            false, 'Schule/Kita - kein Sponsoring-Ziel', 'pending')
    returning id into v_comp;
    v_neu := true;
  end if;

  -- Verknuepfung ist der Kern des Fixes. Ohne sie ist der Kontakt fuer den Versand unsichtbar.
  insert into company_contacts (company_id, contact_id, is_primary, relationship_type)
  select v_comp, p_contact_id, true, 'mitarbeiter'
  where not exists (select 1 from company_contacts
                     where company_id = v_comp and contact_id = p_contact_id);

  insert into deals (title, company_id, primary_contact_id, pipeline_id, pipeline_stage_id,
                     status, priority, currency, value_amount, probability_percent, source)
  values (s.schulname || coalesce(' (' || nullif(btrim(s.ort),'') || ')', ''),
          v_comp, p_contact_id,
          '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid,
          coalesce(p_stage_id, 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid),
          'open', 'medium', 'EUR', 0, 0, 'werteraum_import')
  returning id into v_deal;

  return query select v_comp, v_deal, v_neu;
end $$;

revoke all on function public.werteraum_import_company_deal(uuid, uuid, uuid) from public, anon;
grant execute on function public.werteraum_import_company_deal(uuid, uuid, uuid) to service_role;
