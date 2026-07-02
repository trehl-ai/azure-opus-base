DROP FUNCTION IF EXISTS public.get_top_kunden_won(int);
CREATE OR REPLACE FUNCTION public.get_top_kunden_won(p_limit int DEFAULT 8)
RETURNS TABLE(company_id uuid, company_name text, won_revenue bigint, won_deals bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT d.company_id, co.name, SUM(d.value_amount)::bigint, COUNT(*)::bigint
  FROM deals d JOIN companies co ON co.id = d.company_id
  WHERE d.status = 'won' AND d.company_id IS NOT NULL
  GROUP BY d.company_id, co.name
  ORDER BY SUM(d.value_amount) DESC NULLS LAST
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_kunden_won(int) TO anon, authenticated, service_role;
