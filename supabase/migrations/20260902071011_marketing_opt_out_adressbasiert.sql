-- 02.09.2026: Dauerhafte Werbesperre auf ADRESSEBENE.
--
-- ANLASS: Widerspruch der Margaretenschule Muehlhausen ("Kein Interesse.", 02.09.2026).
-- Die Sperre hing bis jetzt allein an contacts.outreach_status = 'blocked_widerspruch'.
-- Dasselbe Feld schreibt der Versand-Workflow mit 'email_sent' zurueck. Ein Widerspruch
-- stand damit mitten in der FIELDS-Liste des Prozesses, der ihn verletzen wuerde.
-- Praezedenzfall 25.08.2026: der Dispatch ueberschrieb Hard-Bounce-Status, drei Kontakte
-- betroffen. trg_wr_bounce_status_schutz deckt nur Bounces ab (bounce_at NOT NULL) —
-- ein Widerspruch ist kein Bounce und war ungeschuetzt.
--
-- WARUM EIGENE TABELLE statt Spalte auf contacts:
-- Die Sperre gehoert der ADRESSE, nicht dem Kontaktsatz. Belegt im Bestand:
-- sekretariat@grundschule.muenchberg.de existiert als ZWEI getrennte Kontaktsaetze.
-- Eine Spalte auf contacts wuerde ein Reimport aushebeln, weil der neue Satz sie leer
-- traegt. Die Adressliste ueberlebt Reimporte, Dubletten und Loeschungen.
--
-- Art. 21 DSGVO verlangt dauerhafte Wirkung. Was garantiert sein muss, gehoert in Code.

CREATE TABLE IF NOT EXISTS public.marketing_opt_out (
  email_normalized text PRIMARY KEY,
  erfasst_am       timestamptz NOT NULL DEFAULT now(),
  quelle           text NOT NULL DEFAULT 'widerspruch',
  notiz            text,
  contact_id       uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id          uuid REFERENCES public.deals(id)    ON DELETE SET NULL,
  erfasst_von      uuid,
  CONSTRAINT marketing_opt_out_email_normalisiert
    CHECK (email_normalized = lower(btrim(email_normalized))),
  CONSTRAINT marketing_opt_out_quelle_gueltig
    CHECK (quelle IN ('widerspruch','abmeldung_link','manuell','beschwerde','behoerde'))
);

COMMENT ON TABLE public.marketing_opt_out IS
  'Dauerhafte Werbesperre auf Adressebene (Art. 21 DSGVO). Wird von KEINEM Versand-Workflow beschrieben. Eintraege werden nicht geloescht.';
COMMENT ON COLUMN public.marketing_opt_out.email_normalized IS
  'lower(btrim(email)). Sperrt jeden Kontaktsatz mit dieser Adresse, auch kuenftig importierte.';

ALTER TABLE public.marketing_opt_out ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_opt_out FROM PUBLIC;
REVOKE ALL ON public.marketing_opt_out FROM anon;
GRANT SELECT, INSERT ON public.marketing_opt_out TO authenticated;

DROP POLICY IF EXISTS marketing_opt_out_select ON public.marketing_opt_out;
CREATE POLICY marketing_opt_out_select ON public.marketing_opt_out
  FOR SELECT TO authenticated USING (public.can_write_deals());

DROP POLICY IF EXISTS marketing_opt_out_insert ON public.marketing_opt_out;
CREATE POLICY marketing_opt_out_insert ON public.marketing_opt_out
  FOR INSERT TO authenticated WITH CHECK (public.can_write_deals());

-- Kein UPDATE, kein DELETE. Ein Widerspruch wird nicht zurueckgenommen.
-- Eine Loeschung erfordert bewusst einen Eingriff mit erhoehten Rechten.

CREATE INDEX IF NOT EXISTS idx_marketing_opt_out_erfasst_am
  ON public.marketing_opt_out (erfasst_am DESC);