-- 20260729192052_contacts_intake_insert_fallback_haerten
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 8eb86117f293fa20e1c455f6db23316d verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Haertung: der Rueckfall nach 'on conflict do nothing' suchte nur ueber Name+Firma.
-- Griff aber der E-Mail-Index (gleiche E-Mail, abweichend geschriebener Name, beide
-- telegram-intake), blieb v_id null -> die Funktion gab 0 Zeilen zurueck -> PostgREST
-- liefert [] -> n8n erzeugt 0 Items -> 'Resolve Contact ID' und alles dahinter laeuft
-- nicht mehr an, ohne Fehlermeldung. Der Rueckfall prueft jetzt zuerst die E-Mail.
create or replace function public.contacts_intake_insert(p_row jsonb)
returns setof public.contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := nullif(btrim(p_row->>'first_name'), '');
  v_last  text := nullif(btrim(p_row->>'last_name'), '');
  v_email text := nullif(btrim(p_row->>'email'), '');
  v_comp  text := p_row->>'company';
  v_id    uuid;
  v_nkey  text := regexp_replace(lower(coalesce(v_first,'') || coalesce(v_last,'')), '[^a-z0-9]', '', 'g');
  v_ckey  text := regexp_replace(lower(coalesce(v_comp,'')), '[^a-z0-9]', '', 'g');
begin
  -- 1. E-Mail QUELLENUEBERGREIFEND: existiert die Person schon aus CRM oder Cal.com,
  --    soll der Intake sie nicht erneut anlegen.
  if v_email is not null then
    select id into v_id from contacts
     where deleted_at is null and lower(btrim(email)) = lower(v_email)
     order by created_at limit 1;
  end if;

  -- 2. Name+Firma nur INNERHALB des Intakes - quellenuebergreifend waeren Namensvettern
  --    ein zu hohes Risiko.
  if v_id is null and v_nkey <> '' then
    select id into v_id from contacts
     where source = 'telegram-intake' and deleted_at is null
       and regexp_replace(lower(coalesce(first_name,'') || coalesce(last_name,'')), '[^a-z0-9]', '', 'g') = v_nkey
       and regexp_replace(lower(coalesce(company,'')), '[^a-z0-9]', '', 'g') = v_ckey
     order by created_at limit 1;
  end if;

  if v_id is null then
    insert into contacts (first_name, last_name, job_title, company, email, phone, source)
    values (v_first, v_last, nullif(btrim(p_row->>'job_title'), ''), v_comp, v_email,
            nullif(btrim(p_row->>'phone'), ''), 'telegram-intake')
    on conflict do nothing
    returning id into v_id;
  end if;

  -- Rueckfall bei Konflikt/Race: BEIDE Schluessel probieren, sonst kaeme die Funktion
  -- leer zurueck und wuerde den Downstream stilllegen.
  if v_id is null and v_email is not null then
    select id into v_id from contacts
     where deleted_at is null and lower(btrim(email)) = lower(v_email)
     order by created_at limit 1;
  end if;
  if v_id is null and v_nkey <> '' then
    select id into v_id from contacts
     where source = 'telegram-intake' and deleted_at is null
       and regexp_replace(lower(coalesce(first_name,'') || coalesce(last_name,'')), '[^a-z0-9]', '', 'g') = v_nkey
       and regexp_replace(lower(coalesce(company,'')), '[^a-z0-9]', '', 'g') = v_ckey
     order by created_at limit 1;
  end if;

  return query select * from contacts where id = v_id;
end $$;

revoke all on function public.contacts_intake_insert(jsonb) from public, anon;
grant execute on function public.contacts_intake_insert(jsonb) to service_role;
