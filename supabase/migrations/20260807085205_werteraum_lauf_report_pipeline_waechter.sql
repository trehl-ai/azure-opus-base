-- 20260807085205_werteraum_lauf_report_pipeline_waechter
-- Out-of-band angewendet, hier als Datei nachgezogen (Schema Drift Check).
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz).
-- Inhalt aus pg_get_viewdef der Live-View rekonstruiert und in die
-- Handschrift der Vorgaengerdatei zurueckgeschrieben.
-- Kein "NOTIFY pgrst" - gehoert nicht in eine Migrationsdatei.
--
-- BEFUND 07.08.2026: Ein leerer Batch ist von einem erfolgreichen nicht zu
-- unterscheiden. Fuenf Discovery-Laeufe in Folge haben nichts getan und alle
-- 'success' gemeldet. Der bisherige Report konnte das nicht zeigen: er zaehlte
-- mit queue_wartend nur EINE Stufe und warf hold/pending in denselben Topf.
--
-- Diese Fassung ersetzt queue_wartend/gesamt_email_unklar durch die
-- Zustandszaehler beider Eingangsstufen (discovery_wartend, scraper_wartend,
-- zurueckgestellt, geparkt, fertig) und leitet daraus eine zweite Waechter-
-- spalte ab, die Leerlauf benennt statt ihn zu verschweigen.

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
), bestand AS (
  SELECT
    count(*) FILTER (WHERE scrape_status = 'pending')                        AS discovery_wartend,
    count(*) FILTER (WHERE scrape_status = 'found' AND scraped_at IS NULL)   AS scraper_wartend,
    count(*) FILTER (WHERE scrape_status = 'hold')                           AS zurueckgestellt,
    count(*) FILTER (WHERE scrape_status = 'email_unklar')                   AS geparkt,
    count(*) FILTER (WHERE scrape_status = 'scraped')                        AS fertig,
    count(*) FILTER (WHERE email IS NOT NULL)                                AS bestand_mit_email,
    count(*) FILTER (WHERE email IS NOT NULL
      AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')       AS bestand_ungueltig
  FROM werteraum_school_queue
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
  bestand_mit_email,
  bestand_ungueltig,
  discovery_wartend,
  scraper_wartend,
  zurueckgestellt,
  geparkt,
  fertig,
  CASE
    WHEN discovery_wartend = 0 AND zurueckgestellt > 0
      THEN 'LEERLAUF Discovery - nichts auf pending, aber ' || zurueckgestellt
           || ' auf hold. Der Refill zieht aus hold ohne Berlin; liegt dort nur noch Berlin, laeuft er still leer und meldet trotzdem success.'
    WHEN scraper_wartend = 0 AND discovery_wartend > 0
      THEN 'LEERLAUF Scraper - nichts auf found, aber ' || discovery_wartend
           || ' warten auf Discovery. Der Scraper laeuft leer, bis die Discovery URLs geliefert hat.'
    WHEN scraper_wartend = 0 AND discovery_wartend = 0
      THEN 'PIPELINE LEER - beide Eingangsstufen ohne Ziele. Entweder alles abgearbeitet oder die Discovery bringt keinen Nachschub mehr.'
    ELSE 'ok'
  END AS waechter
FROM bestand b;

COMMENT ON VIEW werteraum_lauf_report IS
 'Bilanz des letzten Scrape-Laufs plus Zustand beider Pipeline-Stufen, fuer den Telegram-Ping des Workflows tTlVV8i9IYG9tqaI.
ZWEI WAECHTER:
durchgerutscht zaehlt Adressen, die der Plausibilitaetsfilter haette abfangen muessen. Ueber 0 heisst: den FILTER reparieren, nicht die Daten.
waechter meldet Leerlauf. Ein leerer Batch ist von einem erfolgreichen nicht zu unterscheiden - am 07.08.2026 haben fuenf Discovery-Laeufe in Folge nichts getan und alle success gemeldet. Steht hier etwas anderes als ok, laeuft eine Stufe ins Nichts.
EINSCHRAENKUNG: Die Laufbilanz rechnet aus scraped_at. Wird der Zeitstempel nachtraeglich geleert, etwa beim Umparken von Zeilen, aendert sich rueckwirkend die Bilanz eines abgeschlossenen Laufs. Am 07.08.2026 verlor der 07:00-Lauf so 16 seiner 80 Zeilen.';
