DROP FUNCTION IF EXISTS public.get_werteraum_bundesland_stats();
CREATE OR REPLACE FUNCTION public.get_werteraum_bundesland_stats()
RETURNS TABLE(bundesland text, recherchiert bigint, outreach bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(r.bl, o.bl) AS bundesland,
         COALESCE(r.recherchiert,0)::bigint,
         COALESCE(o.outreach,0)::bigint
  FROM (SELECT bundesland AS bl, count(*) FILTER (WHERE scrape_status='success' OR scraped_at IS NOT NULL) AS recherchiert
        FROM werteraum_school_queue WHERE bundesland IS NOT NULL GROUP BY bundesland) r
  FULL OUTER JOIN (SELECT bundesland AS bl, count(*) AS outreach
        FROM v_werteraum_outreach WHERE bundesland IS NOT NULL GROUP BY bundesland) o
    ON r.bl = o.bl
  ORDER BY GREATEST(COALESCE(r.recherchiert,0), COALESCE(o.outreach,0)) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_werteraum_bundesland_stats() TO anon, authenticated, service_role;
