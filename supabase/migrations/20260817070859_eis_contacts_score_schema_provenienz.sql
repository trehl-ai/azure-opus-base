-- 17.08.2026 — Score-Provenienz auf eis_contacts.
-- Befund: die beiden Kohorten in eis_contacts tragen final_score und lead_tier
-- auf zwei unvereinbaren Skalen. LinkedIn-Kohorte (114) wurde gegen eine
-- diskrete Rubrik gescort (company_size {5,10,18,25}, decision_maker {3,12,20},
-- csr_signal {5,10,15,20,25}). Die ssteo-Kohorte (102, Nachlauf vom 16.08.)
-- bekam im Prompt nur Wertebereiche 0-25 vorgegeben und liefert quasi-stetige
-- Werte (decision_maker 9 verschiedene, csr_signal 12 verschiedene).
-- Die Tier-Labels sehen dadurch vergleichbar aus, sind es aber nicht:
-- 39 ssteo-Kontakte tragen Tier A aus einem Scoring ohne Rubrik.
-- Eine Umrechnung ist ausgeschlossen: alle 102 ssteo-Zeilen haben
-- lead_queue_id IS NULL, also keine company_size_raw-Quelle, und nur 59
-- haben ueberhaupt einen Titel. Daher Provenienz markieren, nicht rechnen.

ALTER TABLE public.eis_contacts
  ADD COLUMN IF NOT EXISTS score_schema text;

ALTER TABLE public.eis_contacts DROP CONSTRAINT IF EXISTS eis_contacts_score_schema_check;
ALTER TABLE public.eis_contacts ADD CONSTRAINT eis_contacts_score_schema_check
  CHECK (score_schema IS NULL OR score_schema IN ('rubrik_v1','ssteo_freihand','ungeprueft'));

COMMENT ON COLUMN public.eis_contacts.score_schema IS
  'Herkunft der Teilscores. rubrik_v1 = gegen diskrete Rubrik gescort (vergleichbar). ssteo_freihand = Nachlauf 16.08. ohne Rubrik, NICHT gegen rubrik_v1 sortierbar. ungeprueft = Provenienz unbekannt.';

UPDATE public.eis_contacts
SET score_schema = CASE
      WHEN herkunft LIKE '%ssteo%' THEN 'ssteo_freihand'
      WHEN herkunft LIKE '%LinkedIn-Kaltkontakt%' THEN 'rubrik_v1'
      ELSE 'ungeprueft'
    END
WHERE score_schema IS NULL;

CREATE INDEX IF NOT EXISTS idx_eis_contacts_score_schema
  ON public.eis_contacts (score_schema);