-- 03.09.2026, Anforderung Thomas Timmer: beim Anlegen einer neuen Company sollen
-- eine allgemeine E-Mail-Adresse und eine Telefonnummer erfasst werden koennen.
-- Beide Spalten fehlten bisher komplett — companies hatte 34 Spalten, aber nur
-- website als Kontaktweg.
--
-- ABGRENZUNG, die den Unterschied ausmacht und in die Spaltenkommentare gehoert:
--   companies.email / phone  = die ALLGEMEINE Adresse der Organisation
--                              (info@, sekretariat@, Zentrale)
--   contacts.email  / phone  = die Adresse einer PERSON
--
-- ⚠ FUER KAMPAGNEN WIRD AUSSCHLIESSLICH contacts VERWENDET.
-- get_werteraum_candidates zieht aus contacts. companies.email darf dort NICHT
-- einfliessen — sonst schreibt die Kampagne an Zentraladressen, die nie fuer
-- Outreach geprueft wurden. Wer das aendern will, aendert eine Kampagnenregel,
-- nicht ein Datenfeld.
--
-- Die Alternative waere ein Pseudo-Kontakt "Zentrale" gewesen. Verworfen: im
-- Alltag mehr Reibung als Nutzen, TT muesste ihn bei jeder Neuanlage mitanlegen.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.companies.email IS
  'Allgemeine E-Mail-Adresse der Organisation (info@, sekretariat@). NICHT fuer Kampagnen verwenden — Outreach laeuft ausschliesslich ueber contacts.email.';
COMMENT ON COLUMN public.companies.phone IS
  'Allgemeine Telefonnummer der Organisation (Zentrale, Sekretariat). Personenbezogene Nummern gehoeren an contacts.phone.';

-- Plausibilitaet, damit kein "keine", "-" oder "n/a" hineinrutscht.
-- Dasselbe Muster wie in get_werteraum_candidates, damit beide Stellen dieselbe
-- Vorstellung von einer gueltigen Adresse haben.
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_email_plausibel;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_email_plausibel
  CHECK (
    email IS NULL
    OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
  );

-- Telefon bewusst OHNE CHECK: Schreibweisen sind zu vielfaeltig
-- (+49 89 1234, 089/1234-0, 0049-89-1234). Ein Regex wuerde hier mehr gueltige
-- Eingaben ablehnen als ungueltige abfangen. Leerstring wird im Frontend zu NULL.

CREATE INDEX IF NOT EXISTS idx_companies_email
  ON public.companies (lower(btrim(email)))
  WHERE deleted_at IS NULL AND email IS NOT NULL;