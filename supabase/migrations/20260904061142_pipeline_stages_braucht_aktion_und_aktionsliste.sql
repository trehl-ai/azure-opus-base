-- 03.09.2026: Aktionsliste — welche Vorgaenge warten auf einen Menschen.
--
-- ANLASS, gemessen: In den waermsten Stufen liegen 18 offene Deals unbewegt.
--   Antwort erhalten   5 Deals, aelteste Bewegung 28.07.
--   Terminiert         6 Deals, aelteste Bewegung 06.05. — 121 TAGE
--   Angebot erstellt   7 Deals, aelteste Bewegung 25.06. —  71 TAGE
-- Zwei Schulen haben am 12.06. geantwortet und bis heute keine Reaktion bekommen.
-- Ein Termin liegt seit vier Monaten, ein Angebot seit zehn Wochen.
--
-- DAS IST KEIN DISZIPLINPROBLEM, SONDERN EIN OBERFLAECHENPROBLEM.
-- Es gibt im CRM keine Ansicht, die offene Vorgaenge nach Liegezeit zeigt.
-- Eine Antwort landet in einer Pipeline-Stufe und verschwindet dort. Bei 0,6 %
-- Antwortquote ist jede Antwort der Ertrag von rund 160 Mails.
--
-- WARUM EINE SPALTE UND KEINE LISTE IM CODE:
-- Welche Stufe Handlung erfordert, ist eine fachliche Aussage und je Pipeline
-- verschieden. Haerte man die Namen im Frontend ein, gaelte die Liste nur fuer
-- WerteRaum und briche beim naechsten Stufennamen. Die Stufen tragen es selbst.
--
-- BEWUSST NICHT markiert: Massenstufen wie "Qualifiziert — NRW" (735 Deals),
-- "Identifiziert" (891), "Mailing erhalten" (897), "Infomaterial erhalten" (241),
-- "Blocked" (39). Dort ist Liegezeit normal, nicht auffaellig. Eine Aktionsliste
-- mit 3.000 Eintraegen ist keine.

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS braucht_aktion boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipeline_stages.braucht_aktion IS
  'Stufe erfordert eine menschliche Reaktion. Speist die Aktionsliste. Bewusst NICHT gesetzt bei Massenstufen wie Identifiziert oder Mailing erhalten — dort ist Liegezeit normal.';

-- Die warmen Stufen aller Pipelines: jemand hat reagiert, zugesagt oder ein
-- Angebot bekommen. Hier kostet Stillstand Geld.
UPDATE public.pipeline_stages
SET braucht_aktion = true
WHERE name IN (
  'Antwort erhalten', 'Terminiert', 'Terminier', 'Termin mit Amelie',
  'Angebot erstellt', 'Angebot', 'Verhandlung', 'Verhandeln',
  'In Bearbeitung', 'Eingereicht', 'Hot Leads VR'
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_aktion
  ON public.pipeline_stages (pipeline_id) WHERE braucht_aktion;

-- Die Aktionsliste. Ein Aufruf, alle Pipelines, nach Liegezeit sortiert.
CREATE OR REPLACE FUNCTION public.get_aktionsliste(p_limit integer DEFAULT 100)
 RETURNS TABLE(
   deal_id uuid, deal_title text, company_id uuid, company_name text,
   pipeline_id uuid, pipeline_name text, stage_name text, stage_position integer,
   owner_user_id uuid, owner_name text,
   value_amount numeric, letzte_bewegung date, liegetage integer,
   letzte_antwort date, antwort_text text,
   contact_id uuid, kontakt_name text, kontakt_email text, bundesland text
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    d.id, d.title, co.id, co.name,
    p.id, p.name, ps.name, ps.position,
    d.owner_user_id,
    btrim(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),
    d.value_amount,
    d.updated_at::date,
    (CURRENT_DATE - d.updated_at::date)::integer,
    (SELECT max(a.created_at)::date FROM deal_activities a
      WHERE a.deal_id = d.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL),
    (SELECT left(a.description, 400) FROM deal_activities a
      WHERE a.deal_id = d.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC LIMIT 1),
    c.id,
    btrim(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')),
    c.email,
    c.bundesland
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id AND ps.braucht_aktion
  JOIN pipelines p ON p.id = d.pipeline_id
  LEFT JOIN companies co ON co.id = d.company_id AND co.deleted_at IS NULL
  LEFT JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
  LEFT JOIN users u ON u.id = d.owner_user_id
  WHERE d.deleted_at IS NULL
    AND d.status = 'open'
    -- Umuts Pipelinebeschraenkung gilt auch hier. Ohne diese Zeile waere die
    -- Aktionsliste ein Umweg um user_can_access_pipeline().
    AND public.user_can_access_pipeline(d.pipeline_id)
  ORDER BY (CURRENT_DATE - d.updated_at::date) DESC, d.updated_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_aktionsliste(integer) IS
  'Offene Vorgaenge in Stufen mit braucht_aktion, nach Liegezeit absteigend. Respektiert user_can_access_pipeline() — die Liste ist kein Umweg um Umuts Beschraenkung. liegetage zaehlt ab deals.updated_at, nicht ab der Antwort: es geht um Stillstand, nicht um Alter.';