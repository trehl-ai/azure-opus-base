-- =====================================================================
-- Vorbereitung fuer die Reparatur der E-Mail-Extraktion, 06.08.2026
--
-- BEFUND: 56 von 1.773 erfassten Adressen sind unbrauchbar (Telefonnummern
-- im Mail-Feld, Fliesstext, Cloudflare- und Joomla-Platzhalter, verwuerfelte
-- Werte). ALLE 56 stammen von Gemini, der Regex-Fallback lief bei keinem.
--
-- URSACHE: Im Node "Parse Gemini" haengt der gesamte Fallback an der
-- Bedingung if(!parsed.email). Liefert Gemini einen truthy Wert wie
-- "Diese E-Mail-Adresse ist vor Spambots geschuetzt!", oeffnet sich das Gate
-- nie - und die bereits vorhandenen Decoder (Joomla-base64, Cloudflare-XOR,
-- TYPO3-Caesar, HTML-Entities, at-Klammern) werden nicht erreicht. Sie sind
-- da, nur unerreichbar.
--
-- FIX (im Workflow, nicht hier): Validierung von Geminis Ergebnis VOR das
-- bestehende Gate ziehen. Dann oeffnet es sich genau dann, wenn es soll.
-- =====================================================================

ALTER TABLE public.werteraum_school_queue
  ADD COLUMN IF NOT EXISTS email_raw_rejected text;

COMMENT ON COLUMN public.werteraum_school_queue.email_raw_rejected IS
 'Roher, von der Plausibilitaetspruefung verworfener E-Mail-Wert. Dient der Nachvollziehbarkeit: ohne ihn ist spaeter nicht mehr pruefbar, ob die Verwerfung richtig war, und der naechste Lauf koennte denselben Muell erneut schreiben. NICHT in raw_impressum ablegen - das Feld ist tag-gestrippt und zu kurz.';

COMMENT ON COLUMN public.werteraum_school_queue.scrape_status IS
 'found = wartet auf Scrape (Queue-RPC get_website_scrape_queue filtert auf found UND scraped_at IS NULL, LIMIT 80) | scraped = erledigt | hold = zurueckgestellt (180 Startchancen-Zeilen ohne URL, seit 30.07.2026) | no_url = keine Website bekannt | email_unklar = gescrapt, aber kein plausibler Wert gefunden; Rohwert steht in email_raw_rejected. Der Status email_unklar existiert bewusst statt einer Rueckkehr nach found: Eine Seite, die die Adresse nie im HTML ausliefert, stuende sonst bei jedem Lauf wieder oben und verbrauchte dauerhaft einen der 80 Plaetze. Reaktivierung gezielt per WHERE scrape_status = email_unklar.';

COMMENT ON COLUMN public.werteraum_school_queue.email_quality IS
 'direkt = personalisierte Adresse | sekretariat = Funktionsadresse der Schule | generisch = allgemeine Adresse | fremd_domain = plausible Adresse, deren Domain aber weder zur Website-Domain noch zu einer bekannten Behoerdendomain passt (Beispiel support@dieschulapp.de bei der Clarenhofschule - Dienstleister, nicht die Schule). Nicht verwerfen, aber filterbar halten. Bekannte Behoerdendomains: bsb.hamburg.de, schule.bwl.de, allgemein *.schule.*';
