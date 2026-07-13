-- Backup-Tabelle für Rollback (Titel + company_id vor Änderung)
CREATE TABLE IF NOT EXISTS public.deal_title_city_backup_20260713 (
  deal_id uuid PRIMARY KEY,
  old_title text NOT NULL,
  old_company_id uuid,
  new_title text,
  new_company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Schritt 1: eindeutig matchbare Companies ermitteln und sichern
WITH linkable AS (
  SELECT d.id AS deal_id, m.co_id, m.city
  FROM deals d
  JOIN LATERAL (
    SELECT (array_agg(co.id))[1] AS co_id, (array_agg(co.city))[1] AS city, count(*) AS n
    FROM companies co
    WHERE lower(trim(co.name)) = lower(trim(d.title))
      AND co.city IS NOT NULL AND btrim(co.city) <> ''
  ) m ON m.n = 1
  WHERE d.deleted_at IS NULL
    AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
    AND d.company_id IS NULL
),
eff AS (
  SELECT d.id AS deal_id, d.title AS old_title, d.company_id AS old_company_id,
         COALESCE(NULLIF(btrim(co.city),''), l.city) AS city,
         COALESCE(d.company_id, l.co_id) AS new_company_id
  FROM deals d
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN linkable l ON l.deal_id = d.id
  WHERE d.deleted_at IS NULL
    AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
)
INSERT INTO public.deal_title_city_backup_20260713 (deal_id, old_title, old_company_id, new_title, new_company_id)
SELECT e.deal_id, e.old_title, e.old_company_id,
       e.old_title || ' (' || e.city || ')' AS new_title,
       e.new_company_id
FROM eff e
WHERE e.city IS NOT NULL
  AND e.old_title NOT ILIKE '%(' || e.city || ')%'   -- idempotent: nie doppelt anhängen
ON CONFLICT (deal_id) DO NOTHING;

-- Schritt 2: company_id nachziehen (nur wo bisher NULL, eindeutig gematcht)
UPDATE deals d
SET company_id = b.new_company_id
FROM public.deal_title_city_backup_20260713 b
WHERE d.id = b.deal_id
  AND d.company_id IS NULL
  AND b.new_company_id IS NOT NULL;

-- Schritt 3: Titel um Stadt ergänzen
UPDATE deals d
SET title = b.new_title,
    updated_at = now()
FROM public.deal_title_city_backup_20260713 b
WHERE d.id = b.deal_id
  AND d.title = b.old_title;   -- Schutz: nur wenn Titel unverändert seit Backup
