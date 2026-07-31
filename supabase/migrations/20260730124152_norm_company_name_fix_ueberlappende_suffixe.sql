-- 20260730124152_norm_company_name_fix_ueberlappende_suffixe
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 292aa1381c8218befc9aa2174dd4aa0e verifiziert.
-- Fix: Bei aufeinanderfolgenden Suffixen ("GmbH Germany") verbraucht regexp_replace das
-- Trennzeichen des ersten Treffers, wodurch der zweite nicht mehr matcht.
-- "LEGO GmbH Germany" ergab legogermany statt lego. Loesung: Muster dreimal anwenden,
-- das deckt bis zu drei aufeinanderfolgende Suffixe ab (z.B. "X GmbH & Co. KG Deutschland").
CREATE OR REPLACE FUNCTION public.norm_company_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
WITH s0 AS (SELECT lower(coalesce(p_name,'')) AS v),
     s1 AS (SELECT regexp_replace(v, '(\s|^)(gmbh\s*&\s*co\.?\s*kgaa?|gmbh\s*&\s*co\.?\s*kg|ag\s*&\s*co\.?\s*kg|gmbh|mbh|ag|se|kgaa|kg|ohg|ug|e\.?\s*v\.?|ggmbh|holding|group|gruppe|deutschland|germany|international|inc\.?|corp\.?|ltd\.?|llc|plc|s\.?a\.?|n\.?v\.?|b\.?v\.?)(\s|$)', ' ', 'g') AS v FROM s0),
     s2 AS (SELECT regexp_replace(v, '(\s|^)(gmbh\s*&\s*co\.?\s*kgaa?|gmbh\s*&\s*co\.?\s*kg|ag\s*&\s*co\.?\s*kg|gmbh|mbh|ag|se|kgaa|kg|ohg|ug|e\.?\s*v\.?|ggmbh|holding|group|gruppe|deutschland|germany|international|inc\.?|corp\.?|ltd\.?|llc|plc|s\.?a\.?|n\.?v\.?|b\.?v\.?)(\s|$)', ' ', 'g') AS v FROM s1),
     s3 AS (SELECT regexp_replace(v, '(\s|^)(gmbh\s*&\s*co\.?\s*kgaa?|gmbh\s*&\s*co\.?\s*kg|ag\s*&\s*co\.?\s*kg|gmbh|mbh|ag|se|kgaa|kg|ohg|ug|e\.?\s*v\.?|ggmbh|holding|group|gruppe|deutschland|germany|international|inc\.?|corp\.?|ltd\.?|llc|plc|s\.?a\.?|n\.?v\.?|b\.?v\.?)(\s|$)', ' ', 'g') AS v FROM s2)
SELECT regexp_replace(v, '[^a-z0-9]', '', 'g') FROM s3;
$function$;
