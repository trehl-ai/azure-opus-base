ALTER TABLE public.deal_finance
  ADD COLUMN IF NOT EXISTS rechnungs_nr     text,
  ADD COLUMN IF NOT EXISTS leistung_details text,
  ADD COLUMN IF NOT EXISTS leistung_art     text,
  ADD COLUMN IF NOT EXISTS created_by       uuid,
  ADD COLUMN IF NOT EXISTS updated_by       uuid;

COMMENT ON COLUMN public.deal_finance.rechnungs_nr     IS 'Excel-Spalte "Rechnung" (z.B. RG260048)';
COMMENT ON COLUMN public.deal_finance.leistung_details IS 'Excel-Spalte "Details" (Leistungsbeschreibung)';
COMMENT ON COLUMN public.deal_finance.leistung_art     IS 'Excel-Spalte "Leistung" (Kuerzel K/VA/P)';

CREATE TABLE IF NOT EXISTS public.deal_installments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  position_nr     integer NOT NULL DEFAULT 1,
  bezeichnung     text,
  betrag          numeric,
  anteil_prozent  numeric,
  faellig_am      date,
  status          text NOT NULL DEFAULT 'geplant',
  rechnungs_nr    text,
  rechnungs_datum date,
  bezahlt_am      date,
  notiz           text,
  created_by      uuid DEFAULT auth.uid(),
  updated_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_installments_status_chk
    CHECK (status IN ('geplant','gestellt','bezahlt','storniert')),
  CONSTRAINT deal_installments_prozent_chk
    CHECK (anteil_prozent IS NULL OR (anteil_prozent >= 0 AND anteil_prozent <= 100)),
  CONSTRAINT deal_installments_pos_uidx UNIQUE (deal_id, position_nr)
);

COMMENT ON TABLE public.deal_installments IS
  'EIC-001: Zahlungsplan je Deal (Abschlags-/Teilrechnungen). faellig_am = geplantes Zahlungsziel. Quelle der Wahrheit fuer den Zahlungsverlauf.';

CREATE INDEX IF NOT EXISTS deal_installments_deal_idx    ON public.deal_installments (deal_id);
CREATE INDEX IF NOT EXISTS deal_installments_faellig_idx ON public.deal_installments (faellig_am) WHERE status <> 'bezahlt';

CREATE OR REPLACE FUNCTION public.eic_touch_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $fn$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END$fn$;

DROP TRIGGER IF EXISTS trg_touch_deal_installments ON public.deal_installments;
CREATE TRIGGER trg_touch_deal_installments BEFORE UPDATE ON public.deal_installments
  FOR EACH ROW EXECUTE FUNCTION public.eic_touch_row();

DROP TRIGGER IF EXISTS trg_touch_deal_finance ON public.deal_finance;
CREATE TRIGGER trg_touch_deal_finance BEFORE UPDATE ON public.deal_finance
  FOR EACH ROW EXECUTE FUNCTION public.eic_touch_row();

ALTER TABLE public.deal_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_installments_select ON public.deal_installments;
CREATE POLICY deal_installments_select ON public.deal_installments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id));

DROP POLICY IF EXISTS deal_installments_write ON public.deal_installments;
CREATE POLICY deal_installments_write ON public.deal_installments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_installments TO authenticated;
