-- Backfill. Applied out-of-band via MCP am 2026-07-27.
-- Diese Datei re-applied nichts Neues; sie holt die bereits live in ttgvhqygmgtnjgwunuwz
-- angewendete Migration in das Repo nach, damit CI drift-check gruen bleibt.
-- Quelle: supabase_migrations.schema_migrations, version 20260727180457 (verbatim).
--
-- Inhalt: ersetzt den company_contacts-INNER-JOIN durch ein OR-Praedikat
-- (Primaerkontakt eines WerteRaum-Deals ODER ueber company_contacts an einer Firma
-- mit WerteRaum-Deal) und schliesst damit eine Untererfassung von 554 Kontakten.
-- Baut auf 20260727174257 auf.

-- Untererfassung beheben: der INNER JOIN auf company_contacts warf 554 Kontakte raus,
-- weil der Import weder company_contacts-Zeilen noch deals.company_id anlegt
-- (496 von 1185 WerteRaum-Deals haben company_id IS NULL -> Backfill nur bei 67 von 554 moeglich).
-- Zugehoerigkeit ist daher ein OR-Praedikat: Primaerkontakt eines WR-Deals ODER ueber
-- company_contacts an einer Firma mit WR-Deal. Reines Umstellen auf primary_contact_id
-- haette 9 angemailte Zweitkontakte verloren.
-- Deal-Attribute per LATERAL, Primaerkontakt-Deal bevorzugt. Fanout bleibt 0.
-- Spaltenreihenfolge unveraendert -> CREATE OR REPLACE VIEW zulaessig.
CREATE OR REPLACE VIEW public.v_werteraum_outreach AS
SELECT
  c.id AS contact_id,
  c.first_name,
  c.last_name,
  c.anrede,
  c.email,
  c.phone,
  c.job_title,
  COALESCE(wd.company_name, cl.company_name) AS company_name,
  wd.stage_name AS stage,
  c.lead_score AS outreach_score,
  c.outreach_cluster,
  c.outreach_hook,
  c.outreach_email_draft,
  c.outreach_status,
  c.lead_score_details,
  c.schneeball_asked_at,
  c.schneeball_referrals,
  c.webinar_invited_at,
  c.webinar_attended_at,
  wd.deal_id,
  wd.value_amount,
  c.bundesland
FROM contacts c
LEFT JOIN LATERAL (
  SELECT d.id AS deal_id,
         d.value_amount,
         ps.name AS stage_name,
         co.name AS company_name
  FROM deals d
  JOIN pipelines p ON p.id = d.pipeline_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  LEFT JOIN companies co ON co.id = d.company_id
  WHERE d.deleted_at IS NULL
    AND p.name ILIKE '%werteraum%'
    AND (
      d.primary_contact_id = c.id
      OR d.company_id IN (SELECT cc.company_id FROM company_contacts cc WHERE cc.contact_id = c.id)
    )
  ORDER BY (d.primary_contact_id = c.id) DESC, d.created_at, d.id
  LIMIT 1
) wd ON true
LEFT JOIN LATERAL (
  SELECT co2.name AS company_name
  FROM company_contacts cc2
  JOIN companies co2 ON co2.id = cc2.company_id
  WHERE cc2.contact_id = c.id
  ORDER BY co2.name
  LIMIT 1
) cl ON true
WHERE c.deleted_at IS NULL
  AND c.email IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM deals d1
      JOIN pipelines p1 ON p1.id = d1.pipeline_id
      WHERE d1.primary_contact_id = c.id
        AND d1.deleted_at IS NULL
        AND p1.name ILIKE '%werteraum%'
    )
    OR EXISTS (
      SELECT 1 FROM company_contacts cc3
      JOIN deals d2 ON d2.company_id = cc3.company_id
      JOIN pipelines p2 ON p2.id = d2.pipeline_id
      WHERE cc3.contact_id = c.id
        AND d2.deleted_at IS NULL
        AND p2.name ILIKE '%werteraum%'
    )
  )
ORDER BY c.lead_score DESC NULLS LAST, wd.stage_name;