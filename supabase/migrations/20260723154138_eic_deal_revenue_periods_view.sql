DROP VIEW IF EXISTS public.deal_revenue_periods;

CREATE VIEW public.deal_revenue_periods
WITH (security_invoker = true) AS
WITH base AS (
  SELECT d.id, d.title, d.status, d.fulfillment_status, d.pipeline_id,
         p.name AS pipeline, d.company_id, d.won_at,
         COALESCE(f.bestellpreis, f.angebotspreis, d.value_amount) AS auftragswert,
         f.rechnungs_datum
  FROM public.deals d
  LEFT JOIN public.deal_finance f ON f.deal_id = d.id
  LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
  WHERE d.deleted_at IS NULL
),
inst AS (
  SELECT i.deal_id, i.id AS installment_id, i.position_nr, i.bezeichnung,
         i.betrag, i.status AS position_status,
         COALESCE(i.rechnungs_datum, i.faellig_am) AS umsatz_datum,
         CASE WHEN i.rechnungs_datum IS NOT NULL THEN 'rechnung' ELSE 'plan' END AS datum_typ
  FROM public.deal_installments i
  WHERE i.status <> 'storniert'
),
insum AS (SELECT deal_id, sum(betrag) AS summe FROM inst GROUP BY deal_id)
SELECT b.id AS deal_id, b.title, b.pipeline, b.company_id,
       b.status AS deal_status, b.fulfillment_status,
       'installment'::text AS quelle,
       i.installment_id, i.position_nr, i.bezeichnung AS position, i.position_status,
       i.betrag, i.umsatz_datum, i.datum_typ,
       EXTRACT(YEAR FROM i.umsatz_datum)::int AS jahr
FROM base b JOIN inst i ON i.deal_id = b.id
UNION ALL
SELECT b.id, b.title, b.pipeline, b.company_id, b.status, b.fulfillment_status,
       'deal', NULL::uuid, NULL::int, NULL::text, NULL::text,
       b.auftragswert,
       COALESCE(b.rechnungs_datum, b.won_at::date),
       CASE WHEN b.rechnungs_datum IS NOT NULL THEN 'rechnung'
            WHEN b.won_at IS NOT NULL THEN 'won_at' ELSE 'undatiert' END,
       EXTRACT(YEAR FROM COALESCE(b.rechnungs_datum, b.won_at::date))::int
FROM base b LEFT JOIN insum s ON s.deal_id = b.id
WHERE s.deal_id IS NULL
UNION ALL
SELECT b.id, b.title, b.pipeline, b.company_id, b.status, b.fulfillment_status,
       'nicht_verplant', NULL::uuid, NULL::int, NULL::text, NULL::text,
       round(b.auftragswert - s.summe, 2),
       NULL::date, 'undatiert', NULL::int
FROM base b JOIN insum s ON s.deal_id = b.id
WHERE b.auftragswert IS NOT NULL AND abs(b.auftragswert - s.summe) > 0.5;

COMMENT ON VIEW public.deal_revenue_periods IS
  'EIC-001: Periodenumsatz. Regel: Umsatz = Rechnungsstellung. Datum = installment.rechnungs_datum, sonst installment.faellig_am; Deals ohne Zahlungsplan = deal_finance.rechnungs_datum, sonst won_at. jahr IS NULL = noch undatiert (faellig_am setzen). deal_status=won fuer Umsatz, open fuer Forecast. security_invoker: RLS von deals greift.';

GRANT SELECT ON public.deal_revenue_periods TO authenticated;
