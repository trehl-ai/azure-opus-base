-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260526192239].statements[1]

-- ════════════════════════════════════════
-- RPC 1: Score + Cluster + Hook schreiben
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION score_werteraum_contact(
  p_contact_id             uuid,
  p_thematischer_fit       int DEFAULT 0,
  p_sozialer_kontext       int DEFAULT 0,
  p_entscheiderfaehigkeit  int DEFAULT 0,
  p_pers_engagement        int DEFAULT 0,
  p_regionaler_proof       int DEFAULT 0,
  p_schulgroesse           int DEFAULT 0,
  p_bisherige_interaktion  int DEFAULT 0,
  p_email_qualitaet        int DEFAULT 0,
  p_foerderzugang          int DEFAULT 0,
  p_timing                 int DEFAULT 0,
  p_cluster                text DEFAULT 'D',
  p_hook                   text DEFAULT '',
  p_email_draft            text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score   int;
  v_details jsonb;
BEGIN
  v_score := (
    p_thematischer_fit      * 20 +
    p_sozialer_kontext      * 15 +
    p_entscheiderfaehigkeit * 15 +
    p_pers_engagement       * 10 +
    p_regionaler_proof      * 10 +
    p_schulgroesse          * 10 +
    p_bisherige_interaktion * 10 +
    p_email_qualitaet       *  5 +
    p_foerderzugang         *  5 +
    p_timing                *  5
  ) / 10;

  v_details := jsonb_build_object(
    'thematischer_fit',      p_thematischer_fit,
    'sozialer_kontext',      p_sozialer_kontext,
    'entscheiderfaehigkeit', p_entscheiderfaehigkeit,
    'pers_engagement',       p_pers_engagement,
    'regionaler_proof',      p_regionaler_proof,
    'schulgroesse',          p_schulgroesse,
    'bisherige_interaktion', p_bisherige_interaktion,
    'email_qualitaet',       p_email_qualitaet,
    'foerderzugang',         p_foerderzugang,
    'timing',                p_timing,
    'scored_at',             now()
  );

  UPDATE contacts SET
    lead_score           = v_score,
    lead_score_details   = v_details,
    outreach_cluster     = p_cluster,
    outreach_hook        = p_hook,
    outreach_email_draft = p_email_draft,
    updated_at           = now()
  WHERE id = p_contact_id;

  RETURN json_build_object(
    'contact_id', p_contact_id,
    'score',      v_score,
    'cluster',    p_cluster
  );
END;
$$;

-- ════════════════════════════════════════
-- RPC 2: Outreach-Aktivität loggen
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION log_outreach_activity(
  p_deal_id     uuid,
  p_contact_id  uuid,
  p_type        text,
  p_title       text,
  p_description text  DEFAULT '',
  p_metadata    jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO deal_activities (
    deal_id, contact_id, activity_type,
    title, description, metadata,
    auto_generated, status, created_at, updated_at
  ) VALUES (
    p_deal_id, p_contact_id, p_type,
    p_title, p_description, p_metadata,
    true, 'completed', now(), now()
  ) RETURNING id INTO v_id;

  UPDATE contacts SET
    outreach_status = CASE
      WHEN p_type = 'email' THEN 'email_sent'
      WHEN p_type = 'call'  THEN 'called'
      WHEN p_type = 'note' AND p_title ILIKE '%Brief%' THEN 'brief_sent'
      WHEN p_type = 'note' AND p_title ILIKE '%Webinar%' THEN 'webinar_invited'
      WHEN p_type = 'note' AND p_title ILIKE '%Camp%'    THEN 'camp_invited'
      WHEN p_type = 'note' AND p_title ILIKE '%Schneeball%' THEN 'schneeball_sent'
      ELSE outreach_status
    END,
    last_contact_at = now(),
    updated_at      = now()
  WHERE id = p_contact_id;

  RETURN v_id;
END;
$$;

-- ════════════════════════════════════════
-- RPC 3: Schneeball-Empfehlung loggen
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION log_schneeball_referral(
  p_source_contact_id uuid,
  p_target_school     text,
  p_target_contact    text,
  p_intro_sent        boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE contacts SET
    schneeball_referrals = COALESCE(schneeball_referrals, '[]'::jsonb) || jsonb_build_object(
      'target_school',   p_target_school,
      'target_contact',  p_target_contact,
      'intro_sent',      p_intro_sent,
      'logged_at',       now()
    ),
    updated_at = now()
  WHERE id = p_source_contact_id;
END;
$$;

-- ════════════════════════════════════════
-- VIEW: Werteraum Outreach Arbeitsliste
-- ════════════════════════════════════════
CREATE OR REPLACE VIEW v_werteraum_outreach AS
SELECT
  c.id                    AS contact_id,
  c.first_name,
  c.last_name,
  c.anrede,
  c.email,
  c.phone,
  c.job_title,
  co.name                 AS company_name,
  ps.name                 AS stage,
  c.lead_score            AS outreach_score,
  c.outreach_cluster,
  c.outreach_hook,
  c.outreach_email_draft,
  c.outreach_status,
  c.lead_score_details,
  c.schneeball_asked_at,
  c.schneeball_referrals,
  c.webinar_invited_at,
  c.webinar_attended_at,
  d.id                    AS deal_id,
  d.value_amount
FROM contacts c
JOIN company_contacts cc  ON cc.contact_id = c.id
JOIN companies co         ON co.id = cc.company_id
JOIN deals d              ON d.company_id = co.id
JOIN pipelines p          ON p.id = d.pipeline_id
JOIN pipeline_stages ps   ON ps.id = d.pipeline_stage_id
WHERE p.name ILIKE '%werteraum%'
  AND d.deleted_at IS NULL
  AND c.email IS NOT NULL
ORDER BY c.lead_score DESC NULLS LAST, ps.name;

-- VIEW: Gewonnen-Schulen als Schneeball-Quelle
CREATE OR REPLACE VIEW v_schneeball_sources AS
SELECT
  c.id                    AS contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.job_title,
  co.name                 AS company_name,
  c.schneeball_asked_at,
  c.schneeball_testimonial_at,
  c.schneeball_referrals,
  c.webinar_attended_at,
  d.id                    AS deal_id,
  d.won_at
FROM contacts c
JOIN company_contacts cc  ON cc.contact_id = c.id
JOIN companies co         ON co.id = cc.company_id
JOIN deals d              ON d.company_id = co.id
JOIN pipelines p          ON p.id = d.pipeline_id
JOIN pipeline_stages ps   ON ps.id = d.pipeline_stage_id
WHERE p.name ILIKE '%werteraum%'
  AND ps.name ILIKE '%gewonnen%'
  AND d.deleted_at IS NULL
  AND c.email IS NOT NULL
ORDER BY d.won_at DESC NULLS LAST;
