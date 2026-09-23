-- 23.09.2026: rpc/get_aktionsliste lief seit 22.09. 09:02 fuer die Rolle authenticated (statement_timeout 8 s)
-- in "canceling statement due to statement timeout" (57014): 20x HTTP 500 im CRM, Aktionsliste fuer TT/Umut unbenutzbar.
-- Gemessen: 6,8 s warm, 2,7 Mio. Buffer fuer 50 Zeilen. Ursachen:
--   (1) audit_log (74k Zeilen, 1,1 GB) hat KEINEN Index auf entity_id -> die korrelierte Unterabfrage "letzter Mensch am Deal"
--       scannt die Tabelle je Deal.
--   (2) Die CTE "basis" berechnet beide Unterabfragen fuer ALLE 3.862 offenen Deals, obwohl der Stufenfilter (braucht_aktion)
--       danach nur 98 uebrig laesst.
-- Fix: Index + Stufen- und Pipeline-Filter in die CTE vorziehen. Ausgabe und Sortierung unveraendert, Signatur unveraendert.

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_mensch
  ON public.audit_log (entity_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_type_created
  ON public.deal_activities (deal_id, activity_type, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_aktionsliste(p_limit integer DEFAULT 100)
 RETURNS TABLE(deal_id uuid, deal_title text, company_id uuid, company_name text, pipeline_id uuid, pipeline_name text, stage_name text, stage_position integer, owner_user_id uuid, owner_name text, value_amount numeric, wartet_seit date, liegetage integer, nie_bearbeitet boolean, letzte_antwort date, antwort_text text, contact_id uuid, kontakt_name text, kontakt_email text, bundesland text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH basis AS (
    SELECT
      d.id, d.title, d.company_id, d.pipeline_id, d.owner_user_id,
      d.value_amount, d.created_at, d.primary_contact_id, d.pipeline_stage_id,
      (SELECT max(a.created_at) FROM audit_log a
         WHERE a.entity_id = d.id AND a.user_id IS NOT NULL) AS mensch,
      (SELECT max(a.created_at) FROM deal_activities a
         WHERE a.deal_id = d.id AND a.deleted_at IS NULL
           AND a.activity_type IN ('email_reply','link_click')) AS eingang
    FROM deals d
    JOIN pipeline_stages ps0 ON ps0.id = d.pipeline_stage_id AND ps0.braucht_aktion
    WHERE d.deleted_at IS NULL AND d.status = 'open'
      AND public.user_can_access_pipeline(d.pipeline_id)
  )
  SELECT
    b.id, b.title, co.id, co.name,
    p.id, p.name, ps.name, ps.position,
    b.owner_user_id,
    btrim(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),
    b.value_amount,
    GREATEST(COALESCE(b.mensch, b.created_at), COALESCE(b.eingang, b.created_at))::date,
    (CURRENT_DATE - GREATEST(COALESCE(b.mensch, b.created_at), COALESCE(b.eingang, b.created_at))::date)::integer,
    (b.mensch IS NULL),
    (SELECT max(a.created_at)::date FROM deal_activities a
      WHERE a.deal_id = b.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL),
    (SELECT left(a.description, 400) FROM deal_activities a
      WHERE a.deal_id = b.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC LIMIT 1),
    c.id,
    btrim(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')),
    c.email,
    c.bundesland
  FROM basis b
  JOIN pipeline_stages ps ON ps.id = b.pipeline_stage_id
  JOIN pipelines p ON p.id = b.pipeline_id
  LEFT JOIN companies co ON co.id = b.company_id AND co.deleted_at IS NULL
  LEFT JOIN contacts c ON c.id = b.primary_contact_id AND c.deleted_at IS NULL
  LEFT JOIN users u ON u.id = b.owner_user_id
  ORDER BY (b.mensch IS NULL) DESC,
           GREATEST(COALESCE(b.mensch, b.created_at), COALESCE(b.eingang, b.created_at)) ASC
  LIMIT p_limit;
$function$;