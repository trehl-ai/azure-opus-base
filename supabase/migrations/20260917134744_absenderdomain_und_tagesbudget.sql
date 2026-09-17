-- 17.09.2026: Die Absenderdomain wird zur Groesse, die man messen und deckeln kann.
--
-- BEFUND: Drei WerteRaum-Strecken (l5oY Erstversand, kgFT Nachfass, eCgl
-- Erneutes Mailing) senden alle ueber schwirkmann@werteraum-schule.de, jede
-- mit eigenem Limit von 50 — und alle um 08:00.
-- GEMESSEN, Mails je Minute:
--   15.09. 08:00  120 Mails
--   16.09. 08:00   96
--   14.09. 08:00   90
-- ⚠ HUNDERTZWANZIG MAILS VON EINER DOMAIN IN EINER MINUTE. Fuer die
-- Zustellbarkeit ist die Spitze schaedlicher als das Tagesvolumen.
-- Die Bounce-Quote auf dieser Domain liegt bei 6,2 Prozent; ueber 5 Prozent
-- gilt als kritisch. Viktoria auf eigener Domain: 0 Prozent bei 100 Mails.
--
-- ⚠ DIE PIPELINE TAUGT NICHT ALS TRENNUNG: WerteRaum und Fit & Aktiv liegen
-- beide in 61b1b7e2, senden aber ueber verschiedene Domains. Die Domain
-- gehoert deshalb an die KAMPAGNE.
--
-- NEU: campaigns.absender_domain, gefuellt aus dem gemessenen Stand.
-- NEU: get_domain_tagesbudget(domain) — wie viele Mails sind heute ueber
-- diese Domain raus, wie viele bleiben. Jeder Versandworkflow kann das vor
-- dem Senden fragen, statt sein eigenes Limit fuer die Wahrheit zu halten.
--
-- ⚠ DAS LIMIT IST HIER NUR EINE ZAHL, KEINE SPERRE. Die Workflows muessen sie
-- lesen und sich daran halten — das ist der naechste Schritt und gehoert in
-- den Code, nicht in diese Funktion.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS absender_domain text,
  ADD COLUMN IF NOT EXISTS tageslimit integer;

COMMENT ON COLUMN public.campaigns.absender_domain IS
  'Die Domain, ueber die diese Kampagne versendet. Nicht die Pipeline: WerteRaum und Fit & Aktiv teilen sich eine Pipeline, senden aber ueber verschiedene Domains. Fuer die Zustellbarkeit zaehlt die Domain.';
COMMENT ON COLUMN public.campaigns.tageslimit IS
  'Obergrenze der Mails je Tag fuer die Absenderdomain dieser Kampagne. Gilt fuer ALLE Strecken derselben Domain zusammen, nicht je Workflow.';

UPDATE campaigns SET absender_domain = 'werteraum-schule.de', tageslimit = 50
WHERE name LIKE 'WerteRaum%';

UPDATE campaigns SET absender_domain = 'viktoria-roadshow.com', tageslimit = 50
WHERE utm_praefix LIKE 'vr-%';

CREATE OR REPLACE FUNCTION public.get_domain_tagesbudget(p_domain text DEFAULT NULL)
 RETURNS TABLE(absender_domain text, tageslimit integer, heute_versendet bigint,
               rest bigint, kampagnen text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT k.absender_domain,
         max(k.tageslimit) AS tageslimit,
         (SELECT count(*) FROM deal_activities a
          JOIN campaigns k2 ON k2.id = a.campaign_id
          WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
            AND a.created_at::date = CURRENT_DATE
            AND k2.absender_domain = k.absender_domain) AS heute_versendet,
         greatest(0, max(k.tageslimit) -
           (SELECT count(*) FROM deal_activities a
            JOIN campaigns k2 ON k2.id = a.campaign_id
            WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
              AND a.created_at::date = CURRENT_DATE
              AND k2.absender_domain = k.absender_domain)) AS rest,
         string_agg(k.name, ' | ' ORDER BY k.sortierung) AS kampagnen
  FROM campaigns k
  WHERE k.aktiv AND k.absender_domain IS NOT NULL
    AND (p_domain IS NULL OR k.absender_domain = p_domain)
  GROUP BY k.absender_domain
  ORDER BY k.absender_domain;
$function$;

COMMENT ON FUNCTION public.get_domain_tagesbudget(text) IS
  'Wie viele Mails sind heute ueber eine Absenderdomain schon raus und wie viele bleiben. Zaehlt ueber ALLE Strecken derselben Domain — genau das fehlte, als drei WerteRaum-Workflows mit je eigenem 50er-Limit zusammen 120 Mails in einer Minute verschickten. ⚠ Die Funktion MISST nur; sperren muss der Workflow, der sie liest.';

GRANT EXECUTE ON FUNCTION public.get_domain_tagesbudget(text) TO anon, authenticated, service_role;