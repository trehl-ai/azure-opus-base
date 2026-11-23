-- Baustufe 1: eigene Pipeline "Viktoria Rebensburg - Schulen" fuer VR Fit & Aktiv Schulen.
-- Nur Struktur: kein Deal wird verschoben, keine Funktion geaendert.
-- Entscheidung Tomi 23.11.2026 14:41. Recon: ~/eic-001/work/fa_pipeline_recon_20261123.md
-- Stufen = gleichnamige Stufen aus "Werteraum - Schulen" (61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e), alle Spalten 1:1;
-- NICHT angelegt: Erneutes Mailing, Briefversand, Wiedervorlage.
-- deals.projektleiter_user_id: getrennt von owner_user_id (owner_user_id = Provisionsregel, unveraendert).
-- Pipeline wird mit is_active = false angelegt; Aktivierung erst in Baustufe 4 beim Umzug.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pipelines WHERE name = 'Viktoria Rebensburg - Schulen') THEN
    RAISE EXCEPTION 'Pipeline "Viktoria Rebensburg - Schulen" existiert bereits - Abbruch';
  END IF;
END
$guard$;

ALTER TABLE public.deals
  ADD COLUMN projektleiter_user_id uuid NULL
  REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deals.projektleiter_user_id IS
  'Projektleitung des Deals (wer das Projekt fuehrt). Getrennt von owner_user_id, das die Provisionszuordnung traegt.';

CREATE INDEX idx_deals_projektleiter_user_id
  ON public.deals USING btree (projektleiter_user_id);

INSERT INTO public.pipelines (id, name, is_default, is_active)
VALUES ('ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Viktoria Rebensburg - Schulen', false, false);

INSERT INTO public.pipeline_stages
  (id, pipeline_id, name, position, stage_type, probability_percent,
   is_won_stage, is_lost_stage, is_hidden, is_outreach_source, braucht_aktion)
VALUES
  ('e160d474-a1e3-41e6-abf4-417ea42a1f12', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Identifiziert', 1, 'open', 0, false, false, false, true, false),
  ('bad53a41-f66e-4bcd-b7c2-2ce7c1506805', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Qualifiziert — BW', 1, 'open', 0, false, false, true, true, false),
  ('423aa582-d8b6-45cb-abb7-b6bc2088633f', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Qualifiziert — Niedersachsen', 1, 'open', 0, false, false, true, true, false),
  ('751e5060-c265-42e6-8cc3-a0311441bb49', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Qualifiziert — NRW', 1, 'open', 0, false, false, true, true, false),
  ('ac671846-376d-4c34-be63-3ca12d573855', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Qualifiziert — RLP', 1, 'open', 0, false, false, true, true, false),
  ('4d19e9f0-5a92-4fda-aec5-4fa06dc2a4e2', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Mailing erhalten', 2, 'open', 0, false, false, false, false, false),
  ('cdef1f33-d27b-47ca-b353-8255eea92632', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', '2. Mailing', 4, 'open', 0, false, false, false, false, false),
  ('ae11b0dc-3319-45b4-b42c-c6a0edf93d53', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Antwort erhalten', 7, 'open', 0, false, false, false, false, true),
  ('7654b0bd-137d-48e5-bb0f-2e34419087d9', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Terminiert', 8, 'open', 30, false, false, false, false, true),
  ('23c2ab90-3f25-460d-a1d1-6ce6b66f1df3', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Angebot erstellt', 9, 'open', 50, false, false, false, false, true),
  ('0f967d6e-8521-428e-b8b3-bd46df621ff4', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Gewonnen', 10, 'won', 100, true, false, false, false, false),
  ('8d9119e0-1010-495a-90ef-3eaf84a0a0fc', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Verloren', 11, 'lost', 0, false, true, false, false, false),
  ('adafdb6e-fdc6-4150-bcb3-930a8d228ede', 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b', 'Blacklist', 12, 'open', 0, false, false, false, false, false);

-- Gegenprobe in der Migration: 13 Stufen, jede mit identischen Kennzeichen wie die gleichnamige WR-Stufe.
DO $check$
DECLARE
  v_anzahl int;
  v_abweichung int;
BEGIN
  SELECT count(*) INTO v_anzahl FROM public.pipeline_stages WHERE pipeline_id = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b';
  SELECT count(*) INTO v_abweichung
  FROM public.pipeline_stages n
  LEFT JOIN public.pipeline_stages w
    ON w.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e' AND w.name = n.name
  WHERE n.pipeline_id = 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'
    AND (w.id IS NULL
      OR (n.position, n.stage_type, n.probability_percent, n.is_won_stage, n.is_lost_stage,
          n.is_hidden, n.is_outreach_source, n.braucht_aktion)
         IS DISTINCT FROM
         (w.position, w.stage_type, w.probability_percent, w.is_won_stage, w.is_lost_stage,
          w.is_hidden, w.is_outreach_source, w.braucht_aktion));
  IF v_anzahl <> 13 OR v_abweichung <> 0 THEN
    RAISE EXCEPTION 'Stufen-Gegenprobe fehlgeschlagen: % Stufen (erwartet 13), % Abweichungen zu WR', v_anzahl, v_abweichung;
  END IF;
END
$check$;