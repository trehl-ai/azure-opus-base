-- =====================================================================
-- Report ueber den jeweils letzten Scrape-Lauf, fuer den Telegram-Ping.
-- Ein Lauf gilt als zusammenhaengend, wenn zwischen zwei Zeilen weniger
-- als 30 Minuten liegen. Referenzwerte aus der Historie: 80 Zeilen in
-- 10 bis 15 Minuten, rund 8 bis 12 Sekunden je Zeile.
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
  -- Qualitaetskontrolle: was der neue Filter eigentlich verhindern soll
  (SELECT count(*) FROM letzter WHERE email IS NOT NULL
     AND email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$')     AS DURCHGERUTSCHT,
  -- Gesamtbestand
  (SELECT count(*) FROM werteraum_school_queue WHERE email IS NOT NULL) AS bestand_mit_email,
  (SELECT count(*) FROM werteraum_school_queue WHERE email IS NOT NULL
     AND email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$')     AS bestand_ungueltig,
  (SELECT count(*) FROM werteraum_school_queue
     WHERE scrape_status = 'found' AND scraped_at IS NULL)             AS queue_wartend,
  (SELECT count(*) FROM werteraum_school_queue
     WHERE scrape_status = 'email_unklar')                             AS gesamt_email_unklar;

COMMENT ON VIEW werteraum_lauf_report IS
 'Eine Zeile mit der Bilanz des letzten Scrape-Laufs, gedacht fuer den Telegram-Ping am Ende des Workflows tTlVV8i9IYG9tqaI. Laufgrenze ist eine Luecke von mehr als 30 Minuten zwischen zwei scraped_at. Die Spalte durchgerutscht ist der eigentliche Waechter: Sie zaehlt Adressen, die der neue Plausibilitaetsfilter haette abfangen muessen. Steht sie ueber 0, ist der Filter luecken~haft - dann NICHT die Daten reparieren, sondern den Filter.';
