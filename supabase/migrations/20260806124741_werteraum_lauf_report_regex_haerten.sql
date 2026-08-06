-- =====================================================================
-- BEFUND 06.08.2026: Die bisherige Regex des Waechters hatte einen
-- blinden Fleck. ^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$ akzeptiert
-- Klammer-Verschleierungen um das @: bei info[@]m-c-schule.de matcht
-- "info[" als lokaler Teil und "]m-c-schule" als Domain. Der Wert galt
-- als gueltig - ausgerechnet bei der Klasse, die der Waechter zuerst
-- haette melden muessen. Falsche Stille, keine Fehlalarme.
--
-- Ersetzt durch die Zeichenklassen-Regex, gegen die auch saubereEmail()
-- im Workflow geprueft wurde. Vorab gemessen: bei allen 1.721 aktuell
-- gueltigen Adressen erzeugt sie NULL zusaetzliche Treffer - kein
-- Fehlalarm, nur der blinde Fleck faellt weg.
-- =====================================================================

DROP VIEW IF EXISTS werteraum_lauf_report;
CREATE VIEW werteraum_lauf_report AS
WITH markiert AS (
  SELECT id, scraped_at, email, email_quality, email_raw_rejected, scrape_status,
         CASE WHEN scraped_at - lag(scraped_at) OVER (ORDER BY scraped_at)
                   > interval '30 minutes'
                OR lag(scraped_at) OVER (ORDER BY scraped_at) IS NULL
              THEN 1 ELSE 0 END AS neuer_lauf
  FROM werteraum_school_queue WHERE scraped_at IS NOT NULL
), gruppiert AS (
  SELECT *, sum(neuer_lauf) OVER (ORDER BY scraped_at) AS lauf_nr FROM markiert
), letzter AS (
  SELECT * FROM gruppiert WHERE lauf_nr = (SELECT max(lauf_nr) FROM gruppiert)
)
SELECT
  (SELECT min(scraped_at) FROM letzter)::timestamp(0)            AS lauf_start,
  (SELECT max(scraped_at) FROM letzter)::timestamp(0)            AS lauf_ende,
  round(extract(epoch FROM (SELECT max(scraped_at)-min(scraped_at) FROM letzter))/60.0,1) AS dauer_min,
  (SELECT count(*) FROM letzter)                                  AS verarbeitet,
  (SELECT count(*) FROM letzter WHERE email IS NOT NULL)          AS mit_adresse,
  (SELECT count(*) FROM letzter WHERE email IS NULL
     AND scrape_status <> 'email_unklar')                         AS ohne_adresse,
  (SELECT count(*) FROM letzter WHERE scrape_status = 'email_unklar') AS verworfen,
  (SELECT count(*) FROM letzter WHERE email_quality = 'fremd_domain')  AS fremd_domain,
  (SELECT count(*) FROM letzter WHERE email IS NOT NULL
     AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')  AS durchgerutscht,
  (SELECT count(*) FROM werteraum_school_queue WHERE email IS NOT NULL) AS bestand_mit_email,
  (SELECT count(*) FROM werteraum_school_queue WHERE email IS NOT NULL
     AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')  AS bestand_ungueltig,
  (SELECT count(*) FROM werteraum_school_queue
     WHERE scrape_status = 'found' AND scraped_at IS NULL)             AS queue_wartend,
  (SELECT count(*) FROM werteraum_school_queue
     WHERE scrape_status = 'email_unklar')                             AS gesamt_email_unklar;

COMMENT ON VIEW werteraum_lauf_report IS
 'Eine Zeile mit der Bilanz des letzten Scrape-Laufs, fuer den Telegram-Ping des Workflows tTlVV8i9IYG9tqaI. Laufgrenze ist eine Luecke von mehr als 30 Minuten zwischen zwei scraped_at. Die Spalte durchgerutscht ist der Waechter: Sie zaehlt Adressen, die der Plausibilitaetsfilter haette abfangen muessen. Steht sie ueber 0, ist der FILTER luecken~haft - dann nicht die Daten reparieren, sondern den Filter. Die Regex wurde am 06.08.2026 gehaertet: die vorherige Fassung akzeptierte Klammer-Verschleierungen wie info[@]domain.de, weil [^@[:space:]] die eckigen Klammern schluckt. Die jetzige Zeichenklassen-Regex ist dieselbe, gegen die saubereEmail() im Workflow geprueft wurde.';
