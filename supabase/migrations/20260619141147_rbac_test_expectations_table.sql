-- Test-Erwartungstabelle: Single Source of Truth für die Rechtematrix
CREATE TABLE IF NOT EXISTS rbac_test_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rolle text NOT NULL,
  tabelle text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('select','insert','update','delete')),
  erwartung text NOT NULL CHECK (erwartung IN ('allow','deny','restricted')),
  notiz text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rolle, tabelle, operation)
);
COMMENT ON TABLE rbac_test_expectations IS 'RBAC Soll-Matrix für automatisierte Smoke-Tests. restricted = teilweise (z.B. sales sieht nur eigene Pipeline)';
