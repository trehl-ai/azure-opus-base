ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS external_ref       text,
  ADD COLUMN IF NOT EXISTS fulfillment_status text;

CREATE UNIQUE INDEX IF NOT EXISTS deals_external_ref_uidx
  ON public.deals (external_ref)
  WHERE external_ref IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_fulfillment_status_chk') THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_fulfillment_status_chk
      CHECK (fulfillment_status IS NULL
             OR fulfillment_status IN ('beauftragt','in_umsetzung','abgerechnet','bezahlt'));
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.deal_finance (
  deal_id           uuid PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  angebotspreis     numeric,
  bestellpreis      numeric,
  fremdkosten_plan  numeric,
  fremdkosten_ist   numeric,
  fk_anteil_plan    numeric GENERATED ALWAYS AS
                    (CASE WHEN angebotspreis IS NULL OR angebotspreis = 0
                          THEN NULL ELSE round(fremdkosten_plan / angebotspreis, 4) END) STORED,
  fk_anteil_ist     numeric GENERATED ALWAYS AS
                    (CASE WHEN bestellpreis IS NULL OR bestellpreis = 0
                          THEN NULL ELSE round(fremdkosten_ist / bestellpreis, 4) END) STORED,
  kalk_nr           text,
  bestellnr         text,
  kostencode        text,
  angebots_datum    date,
  bestell_datum     date,
  leistungszeitraum text,
  rechnungs_datum   date,
  zahlung_status    text,
  anmerkung         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.deal_finance IS
  'EIC-001: PL-Controlling je Deal (Angebot/Bestellpreis, Fremdkosten/Marge, Kalk-/Bestellnr, Daten). 1:1 zu deals.';

ALTER TABLE public.deal_finance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_finance_select ON public.deal_finance;
CREATE POLICY deal_finance_select ON public.deal_finance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_finance.deal_id));

DROP POLICY IF EXISTS deal_finance_write ON public.deal_finance;
CREATE POLICY deal_finance_write ON public.deal_finance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_finance.deal_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_finance.deal_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_finance TO authenticated;
