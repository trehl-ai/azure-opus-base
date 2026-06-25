-- Core read-contract views for the billing module.
-- Einbahn: Module lesen ausschliesslich core.v_* statt public-Basistabellen.
-- security_invoker=true => RLS der Basistabellen gilt fuer den Aufrufer (kein RLS-Bypass).

GRANT USAGE ON SCHEMA core TO authenticated, service_role;

CREATE OR REPLACE VIEW core.v_company
WITH (security_invoker = true) AS
SELECT
  c.id          AS company_id,
  c.name        AS name,
  c.street      AS street,
  c.postal_code AS postal_code,
  c.city        AS city,
  c.country     AS country,
  c.updated_at  AS updated_at
FROM public.companies c
WHERE c.deleted_at IS NULL;

CREATE OR REPLACE VIEW core.v_contact
WITH (security_invoker = true) AS
SELECT
  c.id         AS contact_id,
  c.anrede     AS salutation,
  c.first_name AS first_name,
  c.last_name  AS last_name,
  c.job_title  AS job_title,
  c.email      AS email,
  c.phone      AS phone,
  c.mobile     AS mobile,
  c.updated_at AS updated_at
FROM public.contacts c
WHERE c.deleted_at IS NULL;

CREATE OR REPLACE VIEW core.v_deal
WITH (security_invoker = true) AS
SELECT
  d.id                  AS deal_id,
  d.title               AS title,
  d.company_id          AS company_id,
  d.primary_contact_id  AS primary_contact_id,
  d.value_amount        AS value_amount,
  d.currency            AS currency,
  d.status              AS status,
  d.description         AS description,
  d.expected_close_date AS expected_close_date,
  d.won_at              AS won_at,
  d.updated_at          AS updated_at
FROM public.deals d
WHERE d.deleted_at IS NULL;

COMMENT ON VIEW core.v_company IS 'Core read-contract: company as billing customer (sevDesk Organisation). Stable, minimal. Additive-only changes.';
COMMENT ON VIEW core.v_contact IS 'Core read-contract: contact as Ansprechpartner (sevDesk Person). Org via deal.company_id, not contact.';
COMMENT ON VIEW core.v_deal   IS 'Core read-contract: deal header for sevDesk Order(AN)->Invoice. Line-items + tax live in billing schema.';

GRANT SELECT ON core.v_company, core.v_contact, core.v_deal TO authenticated, service_role;
