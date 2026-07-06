
-- concepts: Katalog fester Sponsoring-/Programm-Konzepte (loest Academy-Hardcoding ab)
-- Weicher Slug-Join zu academy_intel.concept_slug, KEIN FK (Bestands-Rows nicht gefaehrden)
CREATE TABLE IF NOT EXISTS concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  title text NOT NULL,
  description text,
  static_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(3072),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concepts_slug ON concepts(slug);
CREATE INDEX IF NOT EXISTS idx_concepts_active ON concepts(is_active);

-- Row 1: Academy of Stars (Bestandskonzept, static_facts aus Generator-Prompt)
INSERT INTO concepts (slug, version, title, description, static_facts)
VALUES (
  'academy-of-stars',
  'v1',
  'Academy of Stars',
  'MINT-Bildungsprogramm mit ESA-Reserve-Astronautin Amelie Schoenenwald als Testimonial, Schultouren an bayerischen Schulen, Traegerschaft eo ipso.',
  jsonb_build_object(
    'kurzbeschreibung', 'MINT-Bildungsprogramm mit ESA-Reserve-Astronautin Amelie Schoenenwald als Testimonial, Schultouren an bayerischen Schulen.',
    'zielgruppe', 'Schueler:innen, Fokus MINT + Luft-/Raumfahrt',
    'reichweite', 'Roadshow/Schultour an bayerischen Schulen',
    'sponsoring_pakete', null,
    'asset_oder_testimonial', 'Amelie Schoenenwald, ESA-Reserve-Astronautin, Botschafterin fuer MINT-Nachwuchs',
    'ideal_sponsor_profil', 'Marken mit MINT-/Bildungs-/Luft-und-Raumfahrt-Bezug, Technologie- und Zukunftsbranchen'
  )
)
ON CONFLICT (slug) DO NOTHING;

-- Row 2: Fit & Aktiv (erstes echtes Sponsoring-Konzept, Fakten von Tomi bestaetigt)
INSERT INTO concepts (slug, version, title, description, static_facts)
VALUES (
  'fit-und-aktiv',
  'v1',
  'Fit & Aktiv',
  'Mobile Lern-Erlebniswelt fuer spielerische Gesundheitspraevention bei Kindern. Roadshow an bayerischen Schulen (Klasse 5-6) und oeffentliche Events. Testimonial: Olympiasiegerin Viktoria Rebensburg.',
  jsonb_build_object(
    'kurzbeschreibung', 'Mobile Lern-Erlebniswelt, spielerische Gesundheitspraevention fuer Kinder. Roadshow an bayerischen Schulen (Klasse 5-6) und oeffentliche Events. Testimonial: Olympiasiegerin Viktoria Rebensburg.',
    'zielgruppe', 'Kinder 10-12 Jahre (Klassenstufe 5-6), Schulen in Bayern; oeffentliche Events fuer Jung bis Alt',
    'reichweite', 'Seit 2016 aktiv, mehrere hunderttausend Besucher/Teilnehmer, ganz Bayern, Praesenz auf reichweitenstarken Events (z.B. Corso Leopold Muenchen), medial begleitet (Print, Social, Pressekonferenzen)',
    'sponsoring_pakete', null,
    'asset_oder_testimonial', 'Viktoria Rebensburg (Riesenslalom-Olympiasiegerin). Fuenf Themenbloecke: Bewegung, Ernaehrung, Entspannung, (Digitale) Vorsorge, Selbstwirksamkeit',
    'ideal_sponsor_profil', 'Marken mit Kinder-/Familien-Gesundheitsbezug. Bestaetigte Partner: Molkerei Berchtesgadener Land (Bio-Alpenmilch/Ernaehrung), Bayerisches Staatsministerium fuer Gesundheit und Pflege. Fit: Bio-/regionale Food-Marken, Bewegung/Sport, Krankenkassen/Praevention, Digital-Health/Vorsorge, Entspannung/Wellness, mit Bayern-Bezug'
  )
)
ON CONFLICT (slug) DO NOTHING;

GRANT SELECT ON concepts TO authenticated;
