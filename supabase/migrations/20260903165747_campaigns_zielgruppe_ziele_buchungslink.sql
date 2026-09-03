-- 03.09.2026: Fuenf Felder an campaigns, damit die Kachel das zeigt, was in TTs
-- Vertriebsboost-Masterliste steht, und der Buchungslink aus den Daten kommt.
--
-- ANLASS: Abgleich der Masterliste gegen das CRM. Kampagnenname, Phase,
-- Verantwortlicher, Zielgruppenregel und Konzept waren da. Es fehlten:
-- Jahrgangsstufe, Themen, ZIEL 2026, ZIEL 2027 und die naechsten Schritte.
-- Die Zielspalten sind der Kern der Liste — daran wird gemessen.
--
-- zielgruppe_text ist bewusst FREITEXT, keine strukturierte Jahrgangsstufe.
-- Entscheidung Tomi: nice to have, reine Abbildung auf der Kachel, keine
-- Auswertung darueber. Eine strukturierte Klassenstufe waere teurer und wuerde
-- nichts beantworten, was heute jemand fragt.
--
-- ⚠ buchungslink ist der wichtigste der fuenf.
-- Der cal.com-Link steht heute HART im jsCode von l5oYTyjUlmQvisfz und
-- kgFT8aGHP7tOjsQP (cal.com/thomas-timmer/15-min-erstgesprach-werteraum).
-- Armin als Buchungspartner fuer die Viktoria-Linien anzulegen bedeutet damit:
-- Workflow patchen, sichern, PUT, deactivate/activate. Steht der Link an der
-- Kampagne, liest der Versand ihn von dort und der naechste Partner ist ein Feld.
-- Der Workflow-Umbau folgt separat — diese Migration schafft nur den Ort.
--
-- ziel_2026 / ziel_2027 sind ebenfalls Freitext. In TTs Liste stehen dort Saetze
-- wie "noch max. 2 Wochen" oder "bis zu 30 Wochen (Wachstum)", keine Zahlen.
-- Sie in eine Zahl zu zwingen wuerde die Aussage verlieren.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS zielgruppe_text text,
  ADD COLUMN IF NOT EXISTS themen         text,
  ADD COLUMN IF NOT EXISTS ziel_2026      text,
  ADD COLUMN IF NOT EXISTS ziel_2027      text,
  ADD COLUMN IF NOT EXISTS buchungslink   text;

COMMENT ON COLUMN public.campaigns.zielgruppe_text IS
  'Freitext fuer die Kachel, z.B. "Grundschulen Klasse 3-4, Startchancen". Bewusst keine strukturierte Jahrgangsstufe — reine Anzeige, keine Auswertung.';
COMMENT ON COLUMN public.campaigns.themen IS
  'Inhalte der Kampagne, z.B. "Werte, Demokratie, Respekt". Freitext, aus der Vertriebsboost-Masterliste.';
COMMENT ON COLUMN public.campaigns.ziel_2026 IS
  'Ziel bis Ende 2026, Freitext wie in der Masterliste ("noch max. 2 Wochen"). Bewusst keine Zahl.';
COMMENT ON COLUMN public.campaigns.ziel_2027 IS
  'Ziel 2027, Freitext ("bis zu 30 Wochen"). Bewusst keine Zahl.';
COMMENT ON COLUMN public.campaigns.buchungslink IS
  'Buchungslink dieser Kampagne, z.B. cal.com/thomas-timmer/... oder cal.com/armin-schuster/... Ersetzt den hart einkodierten Link im n8n-Workflow. Bis der Versand ihn liest, ist er nur Anzeige.';

-- Plausibilitaet: wenn ein Link gesetzt ist, muss er wie eine URL aussehen.
-- Kein Zwang auf cal.com — es koennte spaeter ein anderer Anbieter sein.
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_buchungslink_plausibel;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_buchungslink_plausibel
  CHECK (
    buchungslink IS NULL
    OR buchungslink ~* '^https?://[^[:space:]]+\.[a-z]{2,}(/[^[:space:]]*)?$'
  );