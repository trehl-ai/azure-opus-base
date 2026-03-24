
CREATE TABLE public.deal_roadshow_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  
  -- Bereich 1: Schul-Basisdaten
  region text,
  aufmerksam_geworden_durch text,
  potential_notizen text,
  erstkontakt_datum date,
  
  -- Bereich 2: Roadshow-Checkliste
  hort_ganztag text NOT NULL DEFAULT 'tbd',
  schueler_kl23_ausreichend text NOT NULL DEFAULT 'tbd',
  schueler_kl234_ausreichend text NOT NULL DEFAULT 'tbd',
  ausweichen_turnhalle text NOT NULL DEFAULT 'tbd',
  ausweichen_turnhalle_notiz text,
  platzbedarf_erfuellt text NOT NULL DEFAULT 'tbd',
  platzbedarf_details text,
  untergrund text NOT NULL DEFAULT 'tbd',
  untergrund_notiz text,
  umzaeunung_aktionsflaeche text NOT NULL DEFAULT 'tbd',
  baustelle_aktionszeitraum text NOT NULL DEFAULT 'tbd',
  stromanschluss_230v text NOT NULL DEFAULT 'tbd',
  zufahrt_fahrzeuge text NOT NULL DEFAULT 'tbd',
  zufahrt_notiz text,
  
  -- Bereich 3: Interne Bewertung
  intern_tempo_kommunikation text,
  intern_attraktivitaet_score integer,
  intern_checkliste_ausgefuellt text NOT NULL DEFAULT 'tbd',
  
  -- Computed
  roadshow_eignung text NOT NULL DEFAULT 'grau',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(deal_id)
);

ALTER TABLE public.deal_roadshow_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drd_select" ON public.deal_roadshow_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "drd_insert" ON public.deal_roadshow_details FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text]));
CREATE POLICY "drd_update" ON public.deal_roadshow_details FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text])) WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text]));
CREATE POLICY "drd_delete" ON public.deal_roadshow_details FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text]));

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_deal_roadshow_details
  BEFORE UPDATE ON public.deal_roadshow_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to compute roadshow_eignung
CREATE OR REPLACE FUNCTION public.compute_roadshow_eignung()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  pflicht_ok boolean;
  pflicht_eingeschraenkt boolean;
  has_tbd boolean;
  bonus_count integer;
BEGIN
  -- Check for TBD in mandatory fields
  has_tbd := (
    NEW.platzbedarf_erfuellt = 'tbd' OR
    NEW.stromanschluss_230v = 'tbd' OR
    NEW.zufahrt_fahrzeuge = 'tbd' OR
    NEW.untergrund = 'tbd' OR
    NEW.baustelle_aktionszeitraum = 'tbd'
  );

  IF has_tbd THEN
    NEW.roadshow_eignung := 'grau';
    RETURN NEW;
  END IF;

  -- Check mandatory criteria
  pflicht_ok := (
    NEW.platzbedarf_erfuellt = 'ja' AND
    NEW.stromanschluss_230v = 'ja' AND
    (NEW.zufahrt_fahrzeuge = 'ja' OR NEW.zufahrt_fahrzeuge = 'eingeschraenkt') AND
    NEW.untergrund != 'rasen_problematisch' AND
    (NEW.baustelle_aktionszeitraum = 'keine' OR NEW.baustelle_aktionszeitraum = 'kleine_baustelle')
  );

  -- Any mandatory = nein?
  IF NOT pflicht_ok THEN
    NEW.roadshow_eignung := 'rot';
    RETURN NEW;
  END IF;

  -- Check if any mandatory is "eingeschraenkt" variant
  pflicht_eingeschraenkt := (
    NEW.zufahrt_fahrzeuge = 'eingeschraenkt' OR
    NEW.untergrund = 'teils_teils'
  );

  -- Count bonus
  bonus_count := 0;
  IF NEW.hort_ganztag IN ('ja', 'angeschlossen') THEN bonus_count := bonus_count + 1; END IF;
  IF NEW.ausweichen_turnhalle = 'ja' THEN bonus_count := bonus_count + 1; END IF;
  IF NEW.umzaeunung_aktionsflaeche = 'ja' THEN bonus_count := bonus_count + 1; END IF;

  IF pflicht_eingeschraenkt OR bonus_count < 2 THEN
    NEW.roadshow_eignung := 'gelb';
  ELSE
    NEW.roadshow_eignung := 'gruen';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER compute_roadshow_eignung_trigger
  BEFORE INSERT OR UPDATE ON public.deal_roadshow_details
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_roadshow_eignung();
