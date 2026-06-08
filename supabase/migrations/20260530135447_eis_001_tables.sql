-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE TABLE IF NOT EXISTS eis_lead_queue (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  first_name            text,
  last_name             text,
  full_name             text GENERATED ALWAYS AS (
                          trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
                        ) STORED,
  title                 text,
  linkedin_url          text,
  email                 text,
  phone                 text,
  company_name          text,
  company_size_raw      text,
  industry              text,
  company_linkedin_url  text,
  company_hq_country    text,
  company_hq_city       text,
  company_size_score    int DEFAULT 0,
  csr_signal_score      int DEFAULT 0,
  sponsor_affinity_score int DEFAULT 0,
  decision_maker_score  int DEFAULT 0,
  regional_fit_score    int DEFAULT 0,
  final_score           int GENERATED ALWAYS AS (
                          coalesce(company_size_score,0)
                          + coalesce(csr_signal_score,0)
                          + coalesce(sponsor_affinity_score,0)
                          + coalesce(decision_maker_score,0)
                          + coalesce(regional_fit_score,0)
                        ) STORED,
  score_reasoning       text,
  score_verified        boolean NOT NULL DEFAULT false,
  abgeholt              boolean NOT NULL DEFAULT false,
  abgeholt_at           timestamptz,
  import_batch          text,
  raw_csv_row           jsonb
);

CREATE TABLE IF NOT EXISTS eis_contacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  first_name            text,
  last_name             text,
  full_name             text GENERATED ALWAYS AS (
                          trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
                        ) STORED,
  title                 text,
  linkedin_url          text,
  email                 text,
  phone                 text,
  birthday              date,
  ansprache             text CHECK (ansprache IN ('Du','Sie')) DEFAULT 'Sie',
  company_name          text,
  industry              text,
  company_hq_country    text,
  company_hq_city       text,
  final_score           int DEFAULT 0,
  lead_tier             text GENERATED ALWAYS AS (
                          CASE
                            WHEN coalesce(final_score,0) >= 70 THEN 'A'
                            WHEN coalesce(final_score,0) >= 50 THEN 'B'
                            ELSE 'C'
                          END
                        ) STORED,
  outreach_status       text NOT NULL DEFAULT 'pending'
                          CHECK (outreach_status IN (
                            'pending','connected','queued','sent',
                            'replied','deal_closed','passed'
                          )),
  connected_on          date,
  last_contact_at       timestamptz,
  research_dossier      text,
  sponsor_match         text,
  pitch_text            text,
  lead_queue_id         uuid REFERENCES eis_lead_queue(id)
);

CREATE TABLE IF NOT EXISTS eis_knowledge_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  type                  text NOT NULL CHECK (type IN (
                          'roadshow_format','testimonial','thema',
                          'referenz_kunde','preisliste','pitch_baustein'
                        )),
  title                 text NOT NULL,
  content               text NOT NULL,
  summary               text,
  tags                  text[],
  embedding             vector(3072)
);

CREATE TABLE IF NOT EXISTS eis_activities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  contact_id            uuid NOT NULL REFERENCES eis_contacts(id),
  type                  text NOT NULL CHECK (type IN (
                          'note','connect_request','message_sent',
                          'reply_received','call','meeting','task'
                        )),
  title                 text NOT NULL,
  description           text,
  metadata              jsonb
);
