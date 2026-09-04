-- 04.09.2026: get_campaign_overview rechnet auf ADRESSEBENE und kennt Fortschritt.
--
-- ANLASS: Die Kachel zeigte fuer Bayern 63 Prozent, obwohl die Kampagne
-- weitgehend durch ist. Drei Ursachen, alle im Zaehlmodell:
--
-- 1. GEZAEHLT WURDEN DEALS, NICHT ADRESSEN.
--    In Bayern stehen 318 Deals auf 269 distinkten Mailadressen. Der Versand
--    dedupliziert ueber lower(btrim(email)) und schreibt eine Adresse nur einmal
--    an; die Kachel zaehlte jeden Deal einzeln. 40 der 126 vermeintlich
--    unangeschriebenen Deals waren Dubletten von Adressen, die laengst Post hatten.
--
-- 2. GEWONNENE UND VERLORENE STANDEN IN "AUSSTEHEND".
--    In Bayern sind 66 Adressen aus einem Excel-Import von Bestandsvorgaengen —
--    12 gewonnen, 17 verloren, dazu weitere. Sie sollen nicht angeschrieben
--    werden und gelten jetzt als ERLEDIGT, nicht als offen. Damit steigt der
--    Fortschritt bei jedem Abschluss, statt zu sinken (Entscheidung Tomi).
--
-- 3. BRIEFVERSAND GALT ALS NICHT ANGESCHRIEBEN.
--    Ein Brief ist eine Ansprache, auch ohne deal_activities-Zeile.
--
-- WIRKUNG, gemessen: Bayern 63 -> 82 Prozent, Bundesweit 43 -> 60 Prozent.
-- Bayern hat damit 49 offene Adressen statt 115. Davon laufen 40 ab dem
-- 30.09. automatisch mit, 8 sind blockiert, 1 ist ein Excel-Termin ohne Mail.
--
-- VERWORFEN: "Deals mit TT als Owner zaehlen als erledigt". Gemessen bewegt die
-- Regel 0 Adressen in Bayern und 2 bundesweit — sie ueberschneidet sich
-- vollstaendig mit den anderen beiden und waere die schwerste der drei Regeln
-- zu erklaeren.
--
-- NEUE SPALTEN: abgeschlossen (gewonnen oder verloren) und fortschritt_prozent.
-- fortschritt = (angeschrieben + abgeschlossen) / zielgruppe.
-- nicht_erreichbar bleibt als eigene Zahl erhalten, faellt aber NICHT aus dem
-- Nenner: eine Adresse ohne brauchbare Mailadresse ist offen, nicht erledigt.
--
-- Signaturwechsel: RETURNS TABLE aendert sich, deshalb DROP und Neuanlage.
-- HINWEIS: min(uuid) gibt es in Postgres nicht — der Ersatzschluessel fuer
-- Deals ohne Mailadresse castet deshalb auf text.

DROP FUNCTION IF EXISTS public.get_campaign_overview();

CREATE OR REPLACE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(
   campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe_text text, themen text, ziel_2026 text, ziel_2027 text, buchungslink text,
   zielgruppe bigint, angeschrieben bigint, abgeschlossen bigint, ausstehend bigint,
   nicht_erreichbar bigint, fortschritt_prozent integer,
   antworten bigint, klicks bigint, bounces bigint,
   auftraege bigint, auftraege_wert numeric, letzte_mail date,
   mailings_gesamt bigint, mailings_ohne_freigabe bigint, mailings_versendet bigint
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH deal_basis AS (
    SELECT k.id AS campaign_id, k.sortierung, d.id AS deal_id,
           COALESCE(lower(btrim(c.email)), 'kein-mail:' || d.id::text) AS schluessel,
           c.email, c.outreach_status, ps.name AS stage,
           d.status AS deal_status, d.value_amount
    FROM campaigns k
    JOIN deals d
      ON d.deleted_at IS NULL
     AND k.pipeline_id IS NOT NULL
     AND d.pipeline_id = k.pipeline_id
     AND (k.segmente IS NULL OR d.segment = ANY (k.segmente))
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    LEFT JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE k.aktiv
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND (
        k.bundesland_modus = 'alle'
        OR (k.bundesland_modus = 'nur'    AND c.bundesland = ANY (k.bundeslaender))
        OR (k.bundesland_modus = 'ausser' AND (c.bundesland IS NULL OR NOT (c.bundesland = ANY (k.bundeslaender))))
      )
  ),
  akt AS (
    SELECT da.campaign_id, da.deal_id, da.activity_type, da.created_at
    FROM deal_activities da
    WHERE da.campaign_id IS NOT NULL AND da.deleted_at IS NULL
  ),
  -- EINE ZEILE JE ADRESSE. Deals ohne Mailadresse behalten ueber den
  -- Ersatzschluessel ihre eigene Zeile, sonst fielen sie zusammen.
  adressen AS (
    SELECT b.campaign_id, b.schluessel,
           bool_or(EXISTS (SELECT 1 FROM akt a
                     WHERE a.campaign_id = b.campaign_id AND a.deal_id = b.deal_id
                       AND a.activity_type = 'email'))            AS hat_mail,
           bool_or(b.stage = 'Briefversand')                      AS hat_brief,
           bool_or(b.deal_status IN ('won','lost'))               AS abgeschlossen,
           bool_or(b.deal_status = 'won')                         AS gewonnen,
           max(b.value_amount) FILTER (WHERE b.deal_status='won') AS wert,
           bool_or(b.email IS NOT NULL AND btrim(b.email) <> ''
                   AND COALESCE(b.outreach_status,'') NOT IN
                       ('blocked_unklare_adresse','blocked_behoerde')) AS erreichbar,
           min(b.sortierung)                                      AS sortierung
    FROM deal_basis b
    GROUP BY b.campaign_id, b.schluessel
  ),
  -- Variante C bleibt: bei geteilter Zielgruppe zaehlt die niedrigere sortierung
  gewinn AS (
    SELECT DISTINCT ON (a.schluessel)
           a.schluessel, a.campaign_id, a.wert
    FROM adressen a WHERE a.gewonnen
    ORDER BY a.schluessel, a.sortierung
  )
  SELECT
    k.id, k.name, k.phase, k.sortierung,
    k.verantwortlich, k.konzept_slug, p.name, k.notiz,
    k.zielgruppe_text, k.themen, k.ziel_2026, k.ziel_2027, k.buchungslink,
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND (a.hat_mail OR a.hat_brief)),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND a.abgeschlossen),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id
       AND NOT (a.hat_mail OR a.hat_brief) AND NOT a.abgeschlossen AND a.erreichbar),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND NOT a.erreichbar),
    (SELECT CASE WHEN count(*) = 0 THEN NULL
                 ELSE round(100.0 * count(*) FILTER (WHERE a.hat_mail OR a.hat_brief OR a.abgeschlossen)
                            / count(*))::integer END
       FROM adressen a WHERE a.campaign_id = k.id),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email_reply'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'link_click'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'bounce'),
    (SELECT count(*) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT COALESCE(sum(g.wert),0) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT max(a.created_at)::date FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email'),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.status = 'entwurf'),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.status = 'versendet')
  FROM campaigns k
  LEFT JOIN pipelines p ON p.id = k.pipeline_id
  WHERE k.aktiv
  ORDER BY k.sortierung;
$function$;

COMMENT ON FUNCTION public.get_campaign_overview() IS
  'Kacheldaten je Kampagne, gezaehlt auf ADRESSEBENE (lower(btrim(email))), nicht auf Dealebene — der Versand dedupliziert ebenso. angeschrieben = Mail ODER Briefversand. abgeschlossen = gewonnen oder verloren, zaehlt als erledigt. fortschritt_prozent = (angeschrieben + abgeschlossen) / zielgruppe. nicht_erreichbar bleibt im Nenner: keine brauchbare Adresse ist offen, nicht erledigt. auftraege weiterhin ueber Zielgruppe, bei geteiltem Verteiler die niedrigere sortierung.';