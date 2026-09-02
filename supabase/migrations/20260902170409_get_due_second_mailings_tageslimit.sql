-- 02.09.2026: Tageslimit fuer den Nachfassversand.
--
-- ANLASS: get_due_second_mailings() hatte KEIN LIMIT, und der Workflow
-- kgFT8aGHP7tOjsQP ("EIC — WerteRaum 2. Mailing Versand") hat ebenfalls keine
-- Deckelung: Get Due Mailings sendet {} ohne Parameter, Prep Mail mappt
-- $input.all() vollstaendig durch, ohne slice. Beim ersten Lauf nach dem
-- Einschalten waeren alle faelligen Datensaetze auf einmal rausgegangen.
--
-- Gemessen am 02.09.: 837 Deals waeren sauber nachfassbar. Zusammen mit den
-- 50 Erstmails ueber DIESELBE Absenderadresse schwirkmann@werteraum-schule.de
-- waere das der schnellste Weg, die Domain-Reputation zu verbrennen — und damit
-- auch den Erstversand mitzureissen.
--
-- Der Erstversand zieht sein Limit aus werteraum_kampagnen_plan. Die Nachfass-
-- strecke bekommt hier ihr eigenes, als Standardwert in der Funktion: der
-- Workflow sendet einen leeren Body, damit greift DEFAULT 50 ohne Workflow-Aenderung.
--
-- ACHTUNG Signaturwechsel: CREATE OR REPLACE wuerde eine Ueberladung erzeugen,
-- und zwei gleichnamige Funktionen machen den PostgREST-Aufruf mehrdeutig.
-- Deshalb DROP und Neuanlage in einer Migration.

DROP FUNCTION IF EXISTS public.get_due_second_mailings();

CREATE OR REPLACE FUNCTION public.get_due_second_mailings(p_limit integer DEFAULT 50)
 RETURNS TABLE(scheduled_mailing_id uuid, deal_id uuid, deal_title text, contact_id uuid, first_name text, last_name text, email text, outreach_hook text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    sm.id,
    d.id,
    d.title,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.outreach_hook
  FROM scheduled_mailings sm
  JOIN deals d ON d.id = sm.deal_id
  LEFT JOIN contacts c ON c.id = sm.contact_id
  WHERE sm.status = 'pending'
    AND sm.scheduled_at <= now()
    AND sm.mailing_type = '2nd_mailing'
    AND c.email IS NOT NULL
    AND c.email != ''
    -- Neu: dieselben Sperren wie im Erstversand. Ein Widerspruch oder ein
    -- Hard Bounce darf die Nachfassstrecke nicht passieren, nur weil der
    -- Datensatz vor der Sperre eingeplant wurde.
    AND c.deleted_at IS NULL
    AND d.deleted_at IS NULL
    AND c.bounce_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM marketing_opt_out mo
      WHERE mo.email_normalized = lower(btrim(c.email))
    )
  ORDER BY sm.scheduled_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_due_second_mailings(integer) IS
  'Faellige Nachfassmails, gedeckelt. DEFAULT 50 greift, weil der n8n-Workflow einen leeren Body sendet. Prueft zusaetzlich bounce_at, deleted_at und marketing_opt_out.';