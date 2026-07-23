ALTER TABLE public.deal_finance
  ADD COLUMN IF NOT EXISTS bezahlt_am date;

COMMENT ON COLUMN public.deal_finance.bezahlt_am IS
  'Excel-Spalte "Zahlung", sofern Datum (Zahlungseingang). zahlung_status = offen|bezahlt.';
