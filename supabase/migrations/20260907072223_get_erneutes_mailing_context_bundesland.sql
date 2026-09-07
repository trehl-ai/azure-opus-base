-- 07.09.2026: bundesland und campaign_id in get_erneutes_mailing_context.
--
-- ANLASS: Seit dem 04.09. tragen versendete Mails keine campaign_id — der
-- Backfill vom 03.09. hat 1.715 Aktivitaeten EINMALIG gestempelt, die Workflows
-- selbst setzen das Feld nicht. Am 07.09. wurden zwei der drei
-- WerteRaum-Workflows gepatcht (l5oYTyjUlmQvisfz, kgFT8aGHP7tOjsQP).
--
-- Der dritte, eCglxZGdJbJ1dMZW "EIC — Erneutes Mailing WerteRaum", konnte NICHT
-- gepatcht werden: diese RPC liefert neun Felder und KEIN bundesland. Der
-- Webhook nimmt nur deal_id entgegen, kein anderer Node im Workflow traegt das
-- Feld. Claude Code hat das gemeldet, statt einen festen Wert zu raten —
-- richtig, denn ein fester Wert waere bei jedem bayerischen Deal falsch gewesen.
--
-- NEU ZWEI FELDER:
--   bundesland   aus contacts, fuer Anzeige und Nachvollziehbarkeit
--   campaign_id  DIE ZUORDNUNG SELBST, in der Datenbank entschieden statt im
--                Workflow. Grund: dieselbe Fallunterscheidung steht seit heute
--                in zwei jsCode-Nodes. Eine dritte Kopie waere die dritte
--                Stelle, an der sie beim naechsten Bundesland nachgezogen
--                werden muss.
--                Der Workflow schreibt sie nur noch durch.
--
-- Die Fallunterscheidung ist wortgleich zu dem UPDATE, mit dem am 07.09. die
-- 149 ungestempelten Mails nachgetragen wurden:
--   bundesland = 'Bayern' -> WerteRaum 1.0 Bayern
--   sonst, auch NULL      -> WerteRaum 2.0 Bundesweit
--
-- ⚠ NICHT geloest, bewusst: der Workflow hat einen ZWEITEN Schreib-Node,
-- "CRM: remail_skipped loggen" mit activity_type 'note'. Der protokolliert
-- einen NICHT erfolgten Versand und gehoert nicht in die Kampagnenzaehlung —
-- er bleibt ungestempelt. Sonst zaehlte die Kachel uebersprungene Mails als
-- versendete.

CREATE OR REPLACE FUNCTION public.get_erneutes_mailing_context(p_deal_id uuid)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ctx AS (
    SELECT
      d.id            AS deal_id,
      d.title         AS deal_title,
      c.id            AS contact_id,
      CONCAT(c.first_name,' ',c.last_name) AS contact_name,
      c.email         AS contact_email,
      c.outreach_email_draft AS email_draft,
      c.bundesland    AS bundesland,
      (SELECT da.description
         FROM deal_activities da
        WHERE da.deal_id = d.id
          AND da.activity_type = 'note'
          AND (da.description ILIKE 'NA:%' OR da.description ILIKE 'UA:%')
          AND da.deleted_at IS NULL
        ORDER BY da.created_at DESC
        LIMIT 1) AS na_notiz
    FROM deals d
    JOIN contacts c ON c.id = d.primary_contact_id
    WHERE d.id = p_deal_id AND d.deleted_at IS NULL
  ),
  parsed AS (
    SELECT *,
      lower((regexp_match(na_notiz,'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'))[1]) AS notiz_email
    FROM ctx
  )
  SELECT json_build_object(
    'deal_id',         deal_id,
    'deal_title',      deal_title,
    'contact_id',      contact_id,
    'contact_name',    contact_name,
    'contact_email',   contact_email,
    'email_draft',     email_draft,
    'na_notiz',        na_notiz,
    'to_email',        COALESCE(notiz_email, lower(contact_email)),
    'to_email_source', CASE WHEN notiz_email IS NOT NULL THEN 'notiz' ELSE 'kontakt' END,
    'bundesland',      bundesland,
    'campaign_id',     CASE WHEN bundesland = 'Bayern'
                            THEN '8c51eca8-8e2b-480d-8825-7329d57d166a'
                            ELSE '34c7d3ee-a90f-4d74-86f9-006579cc4e55' END
  )
  FROM parsed;
$function$;

COMMENT ON FUNCTION public.get_erneutes_mailing_context(uuid) IS
  'Kontext fuer das erneute Mailing. Liefert seit 07.09.2026 zusaetzlich bundesland und campaign_id — die Kampagnenzuordnung wird in der DATENBANK entschieden, nicht im Workflow, weil dieselbe Fallunterscheidung sonst an einer dritten Stelle stuende. Der Workflow schreibt campaign_id nur durch. Der Skip-Node (activity_type note) bleibt bewusst ungestempelt: uebersprungene Mails sind keine versendeten.';