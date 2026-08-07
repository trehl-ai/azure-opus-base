CREATE OR REPLACE VIEW public.v_werteraum_readiness AS
SELECT
  q.id,
  q.schulname,
  q.bundesland,
  q.schulstufe,
  CASE q.schulstufe
    WHEN 'grundschule'   THEN 'Grundschule'
    WHEN 'weiterfuehrend' THEN 'Weiterführend'
    WHEN 'beruflich'     THEN 'Beruflich'
    WHEN 'foerderschule' THEN 'Förderschule'
    ELSE 'Sonstige'
  END AS segment_label,
  q.bereitschaft,
  q.anrede_final,
  q.email,
  q.rektor_name,
  q.website_url,
  q.scrape_status,
  q.scraped_at,
  q.deal_id,
  p.start_datum AS versandstart,
  (p.start_datum - CURRENT_DATE) AS tage_bis_versand,
  p.utm_campaign,
  p.aktiv AS kampagne_aktiv,
  CASE
    WHEN q.bereitschaft = 'keine_email'
         AND p.start_datum IS NOT NULL
         AND p.start_datum <= CURRENT_DATE + 21 THEN 1
    WHEN q.bereitschaft = 'keine_email' THEN 2
    WHEN q.bereitschaft = 'email_ohne_name' THEN 3
    ELSE 4
  END AS recherche_prio
FROM public.werteraum_school_queue q
LEFT JOIN public.werteraum_kampagnen_plan p
  ON p.bundesland = q.bundesland
 AND p.segment    = COALESCE(q.schulstufe, 'grundschule');

GRANT SELECT ON public.v_werteraum_readiness TO authenticated;
GRANT SELECT ON public.v_werteraum_readiness TO service_role;
