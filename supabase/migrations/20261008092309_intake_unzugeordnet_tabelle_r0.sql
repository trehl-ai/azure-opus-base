-- R0: Ablage fuer eingehende Mails, die wr_mail_event keinem Kontakt zuordnen kann.
--
-- ANLASS (gemessen 06.10.2026): Von 12 echten Schulantworten seit dem 22.09.
-- wurden nur 3 automatisch zugeordnet. Ursache: wr_mail_event vergleicht
-- ausschliesslich die exakte Absenderadresse, Schulen antworten aber von einer
-- anderen Adresse als der angeschriebenen. Der Workflow MELDET das zuverlaessig
-- per Telegram — es gab zwoelf Alarme —, aber es gibt keinen Ort, an dem der
-- Fall liegen bleibt, bis ihn jemand schliesst. Deshalb lag der Werbewiderspruch
-- der Stadt Giessen 14 Tage unbearbeitet.
--
-- DATENSPARSAM, bewusst: KEIN Mailtext, kein HTML. Nur die Metadaten, die zum
-- Wiederfinden noetig sind. Der Volltext bleibt im Postfach, die message_id
-- fuehrt dorthin zurueck. Begruendung: Leck vom 29.09.2026 (vier Views mit
-- Personendaten und anon-Grants).
--
-- NICHT intake_messages verwenden: Die Tabelle ist fuer den Lead-Import mit
-- KI-Extraktion gebaut, get_health_check_stats wuerde Zeilen ohne
-- parsed_payload_json nach 24 h als intake_stau melden, und es fehlen die
-- Spalten fuer message_id, Typ und Deal.

CREATE TABLE IF NOT EXISTS public.intake_unzugeordnet (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Zeitpunkt des Mail-Eingangs, NICHT der Schreibzeitpunkt.
  -- Lehre aus "Log Activity": Schreibzeit und Ereigniszeit auseinanderzuhalten
  -- ist der Unterschied zwischen einer Messung und einem Artefakt.
  eingang_at            timestamptz NOT NULL,

  absender              text NOT NULL,
  betreff               text,

  -- Klassifikation aus dem Node "Klassifizieren": reply, hard_bounce,
  -- soft_bounce, ooo. Frei gelassen, falls der Workflow spaeter weitere Typen
  -- kennt — ein CHECK waere hier eine Wette auf fremden Code.
  typ                   text,

  -- Der Fehlertext aus wr_mail_event, heute durchgaengig "kontakt nicht gefunden".
  grund                 text,

  message_id            text,
  in_reply_to           text,

  status                text NOT NULL DEFAULT 'offen',

  -- Beim Schliessen gesetzt, damit nachvollziehbar bleibt, wohin der Fall ging.
  zugeordnet_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  zugeordnet_deal_id    uuid REFERENCES public.deals(id)    ON DELETE SET NULL,

  notiz                 text,
  erledigt_at           timestamptz,
  erledigt_von          uuid,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT intake_unzugeordnet_status_check
    CHECK (status IN ('offen','zugeordnet','erledigt_ohne_zuordnung')),

  -- Wer schliesst, muss sagen womit oder warum.
  CONSTRAINT intake_unzugeordnet_abschluss_check
    CHECK (
      status = 'offen'
      OR (status = 'zugeordnet' AND zugeordnet_contact_id IS NOT NULL)
      OR (status = 'erledigt_ohne_zuordnung' AND notiz IS NOT NULL)
    )
);

-- Verhindert Dubletten, wenn der Intake-Workflow eine Mail erneut verarbeitet.
-- Partiell, weil message_id fehlen kann (gemessen: 3 der 12 Faelle ohne).
CREATE UNIQUE INDEX IF NOT EXISTS intake_unzugeordnet_message_id_uniq
  ON public.intake_unzugeordnet (message_id)
  WHERE message_id IS NOT NULL;

-- Die Abfrage, die der Waechter und die Durchsicht brauchen: was ist offen.
CREATE INDEX IF NOT EXISTS intake_unzugeordnet_offen_idx
  ON public.intake_unzugeordnet (eingang_at DESC)
  WHERE status = 'offen';

-- ANON AUSDRUECKLICH ENTZIEHEN. Per pg_default_acl im Schema public bekommt
-- JEDE neue Tabelle volle anon-Rechte (arwdDxtm) — dieselbe Ursache wie beim
-- Leck vom 29.09.2026. RLS allein ist nur eine Sicherung; hier sind es zwei.
-- Vorbild: marketing_opt_out, die einzige Tabelle im Bestand ohne anon in relacl.
REVOKE ALL ON public.intake_unzugeordnet FROM anon;

ALTER TABLE public.intake_unzugeordnet ENABLE ROW LEVEL SECURITY;

-- Hausmuster wie deal_activities und marketing_opt_out: authenticated darf
-- lesen und schreiben, service_role umgeht RLS ohnehin (der Intake-Workflow
-- schreibt mit dem Secret Key). Fuer anon gibt es bewusst KEINE Policy.
CREATE POLICY intake_unzugeordnet_select ON public.intake_unzugeordnet
  FOR SELECT TO authenticated USING (true);

CREATE POLICY intake_unzugeordnet_insert ON public.intake_unzugeordnet
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY intake_unzugeordnet_update ON public.intake_unzugeordnet
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.intake_unzugeordnet IS
  'R0: eingehende Mails, die wr_mail_event keinem Kontakt zuordnen konnte. Geschrieben vom false-Zweig des Workflows PWkkJ6CaX0jK4C3V. Datensparsam: kein Mailtext, der Volltext bleibt im Postfach.';