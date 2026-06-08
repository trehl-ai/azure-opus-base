-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE OR REPLACE FUNCTION match_eis_knowledge(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.65,
  match_count     int   DEFAULT 5,
  filter_type     text  DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  type       text,
  title      text,
  content    text,
  summary    text,
  tags       text[],
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.type,
    k.title,
    k.content,
    k.summary,
    k.tags,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM eis_knowledge_entries k
  WHERE
    k.embedding IS NOT NULL
    AND (filter_type IS NULL OR k.type = filter_type)
    AND 1 - (k.embedding <=> query_embedding) >= match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RPC: get_eis_connect_queue — gibt 25 Leads aus und setzt abgeholt = true
CREATE OR REPLACE FUNCTION get_eis_connect_queue(p_limit int DEFAULT 25)
RETURNS TABLE (
  id               uuid,
  full_name        text,
  title            text,
  linkedin_url     text,
  company_name     text,
  industry         text,
  company_hq_country text,
  final_score      int,
  score_reasoning  text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- IDs holen
  SELECT array_agg(q.id)
  INTO v_ids
  FROM (
    SELECT lq.id
    FROM eis_lead_queue lq
    WHERE lq.score_verified = true
      AND lq.abgeholt = false
      AND lq.linkedin_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM eis_contacts c
        WHERE c.linkedin_url = lq.linkedin_url
          AND c.outreach_status != 'pending'
      )
    ORDER BY lq.final_score DESC, lq.created_at ASC
    LIMIT p_limit
  ) q;

  -- Sofort als abgeholt markieren
  IF v_ids IS NOT NULL THEN
    UPDATE eis_lead_queue
    SET abgeholt = true, abgeholt_at = now()
    WHERE id = ANY(v_ids);
  END IF;

  -- Zurückgeben
  RETURN QUERY
  SELECT
    lq.id,
    lq.full_name,
    lq.title,
    lq.linkedin_url,
    lq.company_name,
    lq.industry,
    lq.company_hq_country,
    lq.final_score,
    lq.score_reasoning
  FROM eis_lead_queue lq
  WHERE lq.id = ANY(v_ids)
  ORDER BY lq.final_score DESC;
END;
$$;

-- RPC: promote_eis_lead — lead_queue → eis_contacts bei erstem Connect
CREATE OR REPLACE FUNCTION promote_eis_lead(
  p_lead_queue_id uuid,
  p_connected_on  date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contact_id uuid;
  v_lead       eis_lead_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM eis_lead_queue WHERE id = p_lead_queue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_queue_id % not found', p_lead_queue_id;
  END IF;

  -- Duplikat-Check via linkedin_url
  SELECT id INTO v_contact_id
  FROM eis_contacts
  WHERE linkedin_url = v_lead.linkedin_url
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    -- Bereits vorhanden → nur Status updaten
    UPDATE eis_contacts
    SET outreach_status = 'connected',
        connected_on    = p_connected_on,
        updated_at      = now()
    WHERE id = v_contact_id;
  ELSE
    INSERT INTO eis_contacts (
      first_name, last_name, title, linkedin_url, email, phone,
      company_name, industry, company_hq_country, company_hq_city,
      final_score, outreach_status, connected_on, lead_queue_id
    ) VALUES (
      v_lead.first_name, v_lead.last_name, v_lead.title, v_lead.linkedin_url,
      v_lead.email, v_lead.phone,
      v_lead.company_name, v_lead.industry,
      v_lead.company_hq_country, v_lead.company_hq_city,
      v_lead.final_score, 'connected', p_connected_on, p_lead_queue_id
    )
    RETURNING id INTO v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$$;
