-- 20260730124114_norm_company_name_und_eis_promotion_rpc
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 72fe6292a4396b59f9a94103b0e08737 verifiziert.
-- Firmennamen-Normalisierung fuer Dublettenvermeidung.
-- Reines Entfernen von Sonderzeichen reicht nicht: "Deutsche Telekom" vs "Deutsche Telekom AG",
-- "LEGO GmbH Germany" vs "LEGO", "PUMA Group" vs "Puma SE" wuerden als verschieden gelten
-- und drei Dubletten erzeugen. Deshalb erst Rechtsformen und Laender-/Gruppensuffixe entfernen.
CREATE OR REPLACE FUNCTION public.norm_company_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT regexp_replace(
           regexp_replace(
             lower(coalesce(p_name,'')),
             -- Rechtsformen und Suffixe, nur am Wortende bzw. als eigenes Wort
             '(\s|^)(gmbh\s*&\s*co\.?\s*kgaa?|gmbh\s*&\s*co\.?\s*kg|ag\s*&\s*co\.?\s*kg|
               gmbh|mbh|ag|se|kgaa|kg|ohg|ug|e\.?\s*v\.?|gag|ggmbh|
               holding|group|gruppe|deutschland|germany|international|
               inc\.?|corp\.?|ltd\.?|llc|plc|s\.?a\.?|n\.?v\.?|b\.?v\.?|
               a\.?\s*g\.?)(\s|$)',
             ' ', 'gx'),
           '[^a-z0-9]', '', 'g')
$function$;

COMMENT ON FUNCTION public.norm_company_name(text) IS
'Normalisiert Firmennamen fuer Dublettenabgleich: entfernt Rechtsformen (GmbH, AG, SE, KG, e.V., Inc, Ltd), Gruppen- und Landessuffixe (Group, Holding, Deutschland, Germany, International), danach alles ausser a-z0-9. "PUMA Group" und "Puma SE" ergeben beide "puma".';

-- Promotion eines eis_contacts-Leads ins CRM: Firma anlegen oder finden, Kontakt anlegen
-- oder finden, verknuepfen, Rueckverweis setzen. Idempotent ueber contacts.eis_contact_id.
CREATE OR REPLACE FUNCTION public.promote_eis_contact(
  p_eis_id  uuid,
  p_website text DEFAULT NULL,
  p_owner   uuid DEFAULT '47a6442b-6840-4787-bae3-477a90490c1c'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  e            record;
  v_company_id uuid;
  v_contact_id uuid;
  v_new_company boolean := false;
  v_new_contact boolean := false;
  v_first text; v_last text;
BEGIN
  SELECT * INTO e FROM eis_contacts WHERE id = p_eis_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'grund','eis_lead_nicht_gefunden');
  END IF;

  -- Bereits promoviert?
  SELECT id INTO v_contact_id FROM contacts
   WHERE eis_contact_id = p_eis_id AND deleted_at IS NULL LIMIT 1;
  IF v_contact_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'grund','bereits_promoviert','contact_id',v_contact_id);
  END IF;

  IF coalesce(btrim(e.company_name),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'grund','keine_firma','eis_id',p_eis_id,'name',e.full_name);
  END IF;

  -- Firma: normalisiert suchen, sonst anlegen
  SELECT co.id INTO v_company_id
  FROM companies co
  WHERE co.deleted_at IS NULL
    AND norm_company_name(co.name) = norm_company_name(e.company_name)
    AND norm_company_name(co.name) <> ''
  ORDER BY (coalesce(btrim(co.website),'') <> '') DESC, co.created_at
  LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO companies(name, website, source, created_by_user_id)
    VALUES (btrim(e.company_name),
            nullif(btrim(coalesce(p_website,'')),''),
            'eis-bridge',
            '81de2da3-eef1-4b20-955f-09aed66bc1a3'::uuid)
    RETURNING id INTO v_company_id;
    v_new_company := true;
  ELSIF p_website IS NOT NULL AND btrim(p_website) <> '' THEN
    -- vorhandene Website nie ueberschreiben, nur fuellen
    UPDATE companies SET website = btrim(p_website), updated_at = now()
    WHERE id = v_company_id AND coalesce(btrim(website),'') = '';
  END IF;

  -- Kontakt: per E-Mail, sonst per normalisiertem Namen + Firma
  IF e.email IS NOT NULL AND btrim(e.email) <> '' THEN
    SELECT id INTO v_contact_id FROM contacts
     WHERE deleted_at IS NULL AND lower(email) = lower(btrim(e.email)) LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    SELECT c.id INTO v_contact_id
    FROM contacts c
    JOIN company_contacts cc ON cc.contact_id = c.id
    WHERE c.deleted_at IS NULL AND cc.company_id = v_company_id
      AND regexp_replace(lower(coalesce(c.last_name,'')),'[^a-z0-9]','','g')
        = regexp_replace(lower(coalesce(e.last_name,'')),'[^a-z0-9]','','g')
      AND regexp_replace(lower(coalesce(c.last_name,'')),'[^a-z0-9]','','g') <> ''
    LIMIT 1;
  END IF;

  v_first := nullif(btrim(coalesce(e.first_name, split_part(coalesce(e.full_name,''),' ',1))),'');
  v_last  := nullif(btrim(coalesce(e.last_name,
               nullif(trim(substr(coalesce(e.full_name,''),
                 length(split_part(coalesce(e.full_name,''),' ',1))+1)),''))),'');
  IF v_first IS NULL THEN v_first := '-'; END IF;
  IF v_last  IS NULL THEN v_last  := coalesce(nullif(btrim(e.full_name),''),'(ohne Namen)'); END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts(first_name,last_name,email,job_title,company,linkedin_url,
                         lead_score,notes,owner_user_id,created_by_user_id,source,status,
                         eis_contact_id,tags)
    VALUES (v_first, v_last, nullif(btrim(coalesce(e.email,'')),''), nullif(btrim(coalesce(e.title,'')),''),
            btrim(e.company_name), nullif(btrim(coalesce(e.linkedin_url,'')),''),
            e.final_score,
            nullif(concat_ws(E'\n\n',
              nullif('HOOK: '||coalesce(e.outreach_hook,''),'HOOK: '),
              nullif('DOSSIER: '||coalesce(e.research_dossier,''),'DOSSIER: '),
              'QUELLE: LinkedIn-Connection via Telegram-Intake, eis_contacts '||p_eis_id::text),''),
            p_owner, '81de2da3-eef1-4b20-955f-09aed66bc1a3'::uuid, 'eis-bridge','lead',
            p_eis_id, ARRAY['LinkedIn-Lead'])
    RETURNING id INTO v_contact_id;
    v_new_contact := true;
  ELSE
    UPDATE contacts SET
      eis_contact_id = coalesce(eis_contact_id, p_eis_id),
      linkedin_url   = coalesce(linkedin_url, nullif(btrim(coalesce(e.linkedin_url,'')),'')),
      job_title      = coalesce(nullif(job_title,''), nullif(btrim(coalesce(e.title,'')),'')),
      lead_score     = greatest(coalesce(lead_score,0), coalesce(e.final_score,0)),
      tags           = CASE WHEN 'LinkedIn-Lead' = ANY(tags) THEN tags ELSE array_append(tags,'LinkedIn-Lead') END,
      updated_at     = now()
    WHERE id = v_contact_id;
  END IF;

  INSERT INTO company_contacts(contact_id, company_id, relationship_type)
  SELECT v_contact_id, v_company_id, 'main_contact'
  WHERE NOT EXISTS (SELECT 1 FROM company_contacts
                     WHERE contact_id = v_contact_id AND company_id = v_company_id);

  RETURN jsonb_build_object('ok', true, 'contact_id', v_contact_id, 'company_id', v_company_id,
    'new_contact', v_new_contact, 'new_company', v_new_company,
    'firma', btrim(e.company_name), 'person', e.full_name, 'score', e.final_score);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.promote_eis_contact(uuid,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.norm_company_name(text) TO authenticated, service_role;
