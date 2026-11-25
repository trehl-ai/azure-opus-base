-- Zu erledigen: get_aktionsliste nur eigene Vorgaenge + Wartezeit in Wiedervorlage (go Zu erledigen, Tomi 25.11.2026).
-- Quelle: ~/eic-001/work/aktionsliste_entwurf_v2_20261125.sql.
-- Rollback-Test 25.11.: Tomi 48 (p_alle 71), TT 11, Armin 8, Conny Thalheim 4, Wolfgang 0, Umut 0;
-- Nicht-Admins mit p_alle = ohne; 53 Wiedervorlage-Deals ausgeblendet; service_role 0.
-- Signatur neu: get_aktionsliste(p_limit int DEFAULT 100, p_alle boolean DEFAULT false).
-- Die alte Signatur (integer) wird GEDROPPT, sonst entstuende ein Overload und PostgREST
-- koennte {p_limit} nicht eindeutig zuordnen. Einziger Verbraucher: CRM (useAktionsliste.ts,
-- Seite /aktionen und Zaehler in AppSidebar ueber denselben queryKey); 0 n8n-Workflows, 0 DB-Aufrufer (25.11.).
-- (a) Zustaendig = coalesce(projektleiter_user_id, owner_user_id) = auth.uid(); p_alle nur fuer is_admin().
--     Folge: service_role (auth.uid() NULL) bekommt 0 Zeilen.
-- (b) Wartezeit nach ausgehender Mail (nur Wiedervorlage), siehe Kommentar im Rumpf. Alles Uebrige (Pipeline-Rechte, Sortierung, Spalten) unveraendert.

DROP FUNCTION IF EXISTS public.get_aktionsliste(integer);

CREATE OR REPLACE FUNCTION public.get_aktionsliste(p_limit integer DEFAULT 100, p_alle boolean DEFAULT false)
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
      -- (a) Zustaendig = Projektleitung, sonst Owner. p_alle hebt das nur fuer admin auf.
      AND ((p_alle AND public.is_admin())
           OR coalesce(d.projektleiter_user_id, d.owner_user_id) = auth.uid())
      -- (b) Ausblenden, solange eine ausgehende Mail auf Antwort wartet: nur in der Stufe
      --     Wiedervorlage (Werteraum - Schulen), die letzte ausgehende Mail ist hoechstens
      --     14 Tage alt und danach kam keine email_reply. Ausgehend = JEDE email-Aktivitaet
      --     (Automatik, Einzelmail, Handmail).
      AND NOT (
        d.pipeline_stage_id = 'e152c133-d3c2-43f8-8e46-792933734fe3'::uuid  -- Werteraum - Schulen: Wiedervorlage
        AND EXISTS (
          SELECT 1
            FROM (SELECT max(o.created_at) AS letzte FROM deal_activities o
                   WHERE o.deal_id = d.id AND o.deleted_at IS NULL AND o.activity_type = 'email') lo
           WHERE lo.letzte >= now() - interval '14 days'
             AND NOT EXISTS (SELECT 1 FROM deal_activities r
                              WHERE r.deal_id = d.id AND r.deleted_at IS NULL AND r.activity_type = 'email_reply'
                                AND r.created_at > lo.letzte))
      )
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

REVOKE ALL ON FUNCTION public.get_aktionsliste(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_aktionsliste(integer, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
