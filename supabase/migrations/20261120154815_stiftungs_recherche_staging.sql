-- Zielbild 2 (20.11.2026): Ablage fuer die Cloud-Recherche neuer Foerderer. Reine Staging-Tabelle,
-- kein Bezug zu contacts/deals, kein Versand. Import nur nach Entscheidung.
CREATE TABLE public.stiftungs_recherche (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lauf          text NOT NULL,
  block         text NOT NULL,
  name          text NOT NULL,
  typ           text,
  sitz          text,
  bundesland    text,
  zweck         text,
  website       text,
  email         text,
  adresstyp     text,
  quelle_url    text,
  zitat         text,
  entscheidung  text NOT NULL CHECK (entscheidung IN ('SENDEN','RAUS','ZURUECKSTELLEN')),
  begruendung   text,
  crm_dublette  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX stiftungs_recherche_name_sitz_uidx
  ON public.stiftungs_recherche (lower(name), lower(coalesce(sitz, '')));
CREATE INDEX stiftungs_recherche_block_idx ON public.stiftungs_recherche (block);
CREATE INDEX stiftungs_recherche_email_idx ON public.stiftungs_recherche (lower(email));

COMMENT ON TABLE public.stiftungs_recherche IS
  'Staging der Foerderer-Recherche aus der Cloud (Wochenendlaeufe ab 21.11.2026). Kein Import ohne Entscheidung.';

ALTER TABLE public.stiftungs_recherche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stiftungs_recherche FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.stiftungs_recherche TO service_role;