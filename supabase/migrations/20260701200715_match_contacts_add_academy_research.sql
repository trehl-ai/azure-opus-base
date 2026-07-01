-- match_contacts: academy_research (konzeptspezifisches Deep-Research-Dossier) in Return-Table + SELECT ergaenzen.
-- Wird vom Ideas.tsx "Deep Research"-CTA konsumiert (Edge Function match-ideas reicht RPC-Daten 1:1 durch).
-- Return-Type-Drift => DROP vor CREATE (42P13). Grants nach DROP wiederherstellen. NOTIFY pgrst danach.
DROP FUNCTION IF EXISTS public.match_contacts(vector, double precision, integer);

CREATE OR REPLACE FUNCTION public.match_contacts(query_embedding vector, match_threshold double precision DEFAULT 0.3, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, first_name text, last_name text, job_title text, company text, notes text, pitch_text text, event_pitch_text text, research_dossier text, academy_research text, werteraum_potential boolean, plsc_kampagne boolean, smm_2025 boolean, markenfestival boolean, similarity double precision)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.job_title,
    c.company,
    c.notes,
    c.pitch_text,
    c.event_pitch_text,
    c.research_dossier,
    c.academy_research,
    c.werteraum_potential,
    c.plsc_kampagne,
    c.smm_2025,
    c.markenfestival,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM contacts c
  WHERE c.embedding IS NOT NULL
    AND c.deleted_at IS NULL
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$function$;

GRANT EXECUTE ON FUNCTION public.match_contacts(vector, double precision, integer) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
