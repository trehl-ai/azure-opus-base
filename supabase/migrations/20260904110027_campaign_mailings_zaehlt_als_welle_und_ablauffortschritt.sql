-- 04.09.2026: Ablauffortschritt je Kampagne — wie weit sind die geplanten
-- Wellen versendet.
--
-- ANLASS: Der bisherige Fortschritt maß die REICHWEITE (welcher Anteil der
-- Adressen wurde erreicht). Tomi will den ABLAUF: eine Kampagne aus zwei
-- Mailings ist zu 100 Prozent durch, wenn beide gelaufen sind — unabhaengig
-- davon, wie viele Adressen die einzelne Welle tatsaechlich erreicht hat.
-- Die Reichweiten- und Erfolgsauswertung folgt in einem zweiten Schritt.
--
-- WARUM EIN KENNZEICHEN UND KEIN ZAEHLEN DER ZEILEN:
-- Zwei der acht Mailings sind KEINE eigenen Wellen:
--   Bayern Nr. 2  "Erneutes Mailing (Korrekturversand)" — Nachversand innerhalb
--                 der ersten Welle, lief zeitgleich mit Nr. 1 und Nr. 3
--   Bundesweit Nr. 3 "Erstmailing Fassung 2" — reine Textaenderung derselben
--                 Welle wie Nr. 1, von TT am 04.09. freigegeben
-- Wer Zeilen zaehlt, gibt Bayern vier und bundesweit drei Wellen und kommt auf
-- falsche Nenner.
--
-- REGEL FUER DEN NENNER: entwurf zaehlt NICHT mit.
-- Ein Mailing im Entwurf ist noch nicht beschlossen — das November-Mailing in
-- Bayern ist ein Vorhaben, kein Plan. Sonst faellt Bayern von 100 auf 67 Prozent,
-- nur weil jemand eine Idee eingetragen hat. Sobald es freigegeben wird, zaehlt es.
--
-- ERGEBNIS, gemessen 04.09.:
--   Bayern       2 von 2 Wellen versendet -> 100 %
--   Bundesweit   1 von 2                  ->  50 %   (zweite Welle startet 15.09.)
--   Stiftungen   1 von 1                  -> 100 %
--   drei in Vorbereitung: keine Mailings   -> NULL, kein Ring

ALTER TABLE public.campaign_mailings
  ADD COLUMN IF NOT EXISTS zaehlt_als_welle boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.campaign_mailings.zaehlt_als_welle IS
  'Zaehlt dieses Mailing als eigene Welle im Ablauffortschritt? false bei Nachversand oder reiner Textaenderung derselben Welle. Wer Zeilen zaehlt statt Wellen, bekommt falsche Nenner.';

UPDATE public.campaign_mailings m
SET zaehlt_als_welle = false
FROM public.campaigns c
WHERE c.id = m.campaign_id
  AND (
    (c.name = 'WerteRaum 1.0 — Bayern'     AND m.nummer = 2)
    OR (c.name = 'WerteRaum 2.0 — Bundesweit' AND m.nummer = 3)
  );

CREATE INDEX IF NOT EXISTS idx_campaign_mailings_welle
  ON public.campaign_mailings (campaign_id, status) WHERE zaehlt_als_welle;