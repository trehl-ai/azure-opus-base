ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bundesland text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_test_contact boolean DEFAULT false;

INSERT INTO pipeline_stages (pipeline_id, name, position)
VALUES
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Importiert — NRW',            0),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Importiert — BW',             0),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Importiert — Niedersachsen',  0),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Importiert — RLP',            0),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Qualifiziert — NRW',          1),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Qualifiziert — BW',           1),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Qualifiziert — Niedersachsen',1),
  ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Qualifiziert — RLP',          1);

UPDATE contacts SET bundesland = 'Bayern'
WHERE bundesland IS NULL
AND id IN (
  SELECT DISTINCT c.id FROM contacts c
  JOIN deals d ON d.primary_contact_id = c.id
  JOIN pipelines p ON p.id = d.pipeline_id
  WHERE p.name ILIKE '%werteraum%'
);

CREATE TABLE IF NOT EXISTS werteraum_school_queue (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schulname              text NOT NULL,
  schulform              text,
  bundesland             text NOT NULL,
  ort                    text,
  plz                    text,
  schulnummer            text,
  website_url            text,
  scraped_at             timestamptz,
  scrape_status          text DEFAULT 'pending',
  rektor_name            text,
  rektor_anrede          text,
  email                  text,
  email_quality          text,
  raw_impressum          text,
  ganztag                boolean DEFAULT false,
  deutschplus            boolean DEFAULT false,
  werte_projekt          text,
  schule_groesse_hinweis text,
  scored_at              timestamptz,
  score_status           text DEFAULT 'pending',
  contact_id             uuid REFERENCES contacts(id),
  deal_id                uuid,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsq_scrape_status ON werteraum_school_queue(scrape_status);
CREATE INDEX IF NOT EXISTS idx_wsq_score_status  ON werteraum_school_queue(score_status);
CREATE INDEX IF NOT EXISTS idx_wsq_bundesland    ON werteraum_school_queue(bundesland);

CREATE OR REPLACE FUNCTION get_scrape_queue(p_limit int DEFAULT 10, p_bundesland text DEFAULT NULL)
RETURNS SETOF werteraum_school_queue
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  UPDATE werteraum_school_queue
  SET scrape_status = 'processing'
  WHERE id IN (
    SELECT id FROM werteraum_school_queue
    WHERE scrape_status = 'pending'
    AND (p_bundesland IS NULL OR bundesland = p_bundesland)
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION get_scoring_queue(p_limit int DEFAULT 10)
RETURNS SETOF werteraum_school_queue
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  UPDATE werteraum_school_queue
  SET score_status = 'processing'
  WHERE id IN (
    SELECT id FROM werteraum_school_queue
    WHERE scrape_status IN ('scraped', 'found')
    AND score_status = 'pending'
    AND email IS NOT NULL
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION get_werteraum_candidates(
  p_limit int DEFAULT 30,
  p_bundesland text DEFAULT NULL
)
RETURNS TABLE(
  contact_id uuid, deal_id uuid, first_name text, last_name text,
  email text, company_name text, outreach_cluster text,
  outreach_hook text, outreach_email_draft text, lead_score int,
  pipeline_stage_id uuid, bundesland text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, d.id, c.first_name, c.last_name,
    c.email, c.company_name, c.outreach_cluster,
    c.outreach_hook, c.outreach_email_draft, c.lead_score,
    d.pipeline_stage_id, c.bundesland
  FROM contacts c
  JOIN deals d ON d.primary_contact_id = c.id
  JOIN pipelines p ON p.id = d.pipeline_id
  WHERE p.name ILIKE '%werteraum%'
    AND c.outreach_cluster IS NOT NULL
    AND c.outreach_cluster != 'A'
    AND c.lead_score >= 30
    AND c.outreach_status NOT IN ('email_sent','terminated')
    AND c.email IS NOT NULL
    AND (p_bundesland IS NULL OR c.bundesland = p_bundesland)
    AND d.pipeline_stage_id NOT IN (
      'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid,
      '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6'::uuid,
      'b088d711-a37b-4b00-abde-57f504567775'::uuid,
      'ab0253f5-e40b-4ea9-89f8-a9edc668c350'::uuid
    )
  ORDER BY c.lead_score DESC
  LIMIT p_limit;
END;
$$;
