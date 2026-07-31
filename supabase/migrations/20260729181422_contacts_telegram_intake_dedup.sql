-- 20260729181422_contacts_telegram_intake_dedup
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 1ca36194fa5b7855deb99ac713d898a7 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Dublettenschutz fuer den Visitenkarten-Zweig des Telegram-Intake
-- (WF DZDA9abY5hcF1kgW, Node 'Upsert Contact' -> contacts, source='telegram-intake').
-- Bisher ein reiner POST-Insert ohne on_conflict: jedes erneute Senden desselben
-- Fotos legte eine neue Zeile an. Der vorhandene Index idx_contacts_linkedin_url_unique
-- greift hier nie, weil aus einem Visitenkartenfoto keine Profil-URL ablesbar ist.
--
-- Beide Indexe sind BEWUSST auf source='telegram-intake' begrenzt:
--  - global auf E-Mail unmoeglich: der Bestand hat 139 Dublettengruppen (Stand 29.07.2026)
--  - global auf Name+Firma gefaehrlich: cal_booking_intake legt Kontakte mit dem
--    Platzhalter first_name='Cal.com', last_name='Gast' an - ein globaler Namensindex
--    braeche ab der zweiten solchen Buchung.

create unique index if not exists contacts_telegram_intake_email_uidx
  on public.contacts (lower(btrim(email)))
  where source = 'telegram-intake'
    and deleted_at is null
    and coalesce(btrim(email), '') <> '';

create unique index if not exists contacts_telegram_intake_name_company_uidx
  on public.contacts (
    regexp_replace(lower(coalesce(first_name,'') || coalesce(last_name,'')), '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(company,'')), '[^a-z0-9]', '', 'g'))
  where source = 'telegram-intake'
    and deleted_at is null
    and coalesce(btrim(first_name), '') || coalesce(btrim(last_name), '') <> '';

-- PostgREST kann Ausdrucks-Indexe nicht als on_conflict-Ziel nutzen, deshalb muss der
-- Node ueber eine RPC gehen (gleiches Muster wie eis_contacts_insert).
-- Rueckgabe ist IMMER die Zeile - bei einer Dublette die BESTEHENDE. Damit bleibt der
-- Downstream (Resolve Contact ID -> Link Contact-Company -> Create Task) funktionsfaehig
-- und ein erneutes Senden wirkt idempotent statt fehlerhaft.
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
  -- 1. E-Mail wird QUELLENUEBERGREIFEND gesucht: existiert die Person schon aus dem CRM
  --    oder aus Cal.com, soll der Intake sie nicht erneut anlegen. E-Mail ist dafuer ein
  --    starker Schluessel.
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

  -- Kein v_id heisst: paralleler Lauf war schneller (Index hat gegriffen). Dann die
  -- Zeile des Gewinners nachschlagen, damit der Downstream trotzdem eine id bekommt.
  if v_id is null then
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
