-- Postfach-Spiegel: vollständige Kopie jeder eingehenden Mail der Kampagnenpostfächer (20.11.2026)
-- Schreiber: n8n-Intake-Workflows (DQWGTifQelJSEqcf viktoria, PWkkJ6CaX0jK4C3V werteraum) per REST mit service_role.
-- Leser: Claude (Supabase-MCP). Kein Frontend-Zugriff.
CREATE TABLE public.postfach_spiegel (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postfach        text NOT NULL,
  message_id      text,
  eingang_at      timestamptz,
  absender        text,
  absender_name   text,
  empfaenger      text,
  cc              text,
  betreff         text,
  in_reply_to     text,
  references_hdr  text,
  text_body       text,
  html_body       text,
  klasse          text,
  dsn             jsonb,
  kopfzeilen      jsonb,
  anhaenge        jsonb,
  quelle_workflow text,
  n8n_execution_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT postfach_spiegel_postfach_chk CHECK (postfach IN ('viktoria','werteraum','stiftungen')),
  CONSTRAINT postfach_spiegel_msgid_uniq UNIQUE (postfach, message_id)
);
COMMENT ON TABLE public.postfach_spiegel IS 'Vollständige Kopie eingehender Kampagnenmails (Kopf, Text, DSN). Personenbezogen: nur service_role. Quelle: n8n-Intake, Node "Spiegel ablegen".';
CREATE INDEX postfach_spiegel_eingang_idx ON public.postfach_spiegel (eingang_at DESC);
CREATE INDEX postfach_spiegel_absender_idx ON public.postfach_spiegel (lower(absender));
ALTER TABLE public.postfach_spiegel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.postfach_spiegel FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.postfach_spiegel TO service_role;
