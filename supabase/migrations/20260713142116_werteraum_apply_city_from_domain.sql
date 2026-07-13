-- Backup für Rollback (Runde 2)
CREATE TABLE IF NOT EXISTS public.deal_title_city_backup2_20260713 (
  deal_id uuid PRIMARY KEY,
  old_title text NOT NULL,
  new_title text NOT NULL,
  city text NOT NULL,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.deal_title_city_backup2_20260713 (deal_id, old_title, new_title, city, domain)
SELECT d.id, d.title, d.title || ' (' || m.city || ')', m.city, m.domain
FROM deals d
JOIN contacts c ON c.id = d.primary_contact_id
JOIN school_domain_city_map m ON m.domain = split_part(lower(c.email),'@',2)
WHERE d.deleted_at IS NULL
  AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
  AND d.title !~ '\([^)]+\)$'
  AND d.title NOT ILIKE '%(' || m.city || ')%'
ON CONFLICT (deal_id) DO NOTHING;

-- Titel setzen
UPDATE deals d
SET title = b.new_title, updated_at = now()
FROM public.deal_title_city_backup2_20260713 b
WHERE d.id = b.deal_id AND d.title = b.old_title;

-- companies.city nachziehen, wo Company existiert und city leer ist
UPDATE companies co
SET city = b.city, updated_at = now()
FROM deals d
JOIN public.deal_title_city_backup2_20260713 b ON b.deal_id = d.id
WHERE co.id = d.company_id
  AND (co.city IS NULL OR btrim(co.city) = '');
