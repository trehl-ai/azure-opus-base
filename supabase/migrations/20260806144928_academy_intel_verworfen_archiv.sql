CREATE TABLE public.academy_intel_verworfen (
  LIKE public.academy_intel INCLUDING DEFAULTS
);

ALTER TABLE public.academy_intel_verworfen
  ADD COLUMN verworfen_am    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN verworfen_grund text,
  ADD COLUMN website_alt     text,
  ADD COLUMN website_neu     text;

ALTER TABLE public.academy_intel_verworfen ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_intel_verworfen_select_admin
  ON public.academy_intel_verworfen FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.academy_intel_verworfen IS
  'Archiv verworfener academy_intel-Dossiers. Angelegt 06.08.2026 im Zuge des Domain-Audits: Dossiers, die auf einer falschen companies.website beruhten, werden hierher kopiert und aus academy_intel geloescht, damit die Paare fuer einen Neulauf wieder offen sind.';
