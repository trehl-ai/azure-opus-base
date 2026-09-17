-- 17.09.2026: Die Anrede weicht nur bei den NRW-Kuerzelnamen aus, nicht bei jedem Komma.
--
-- ⚠ KORREKTUR MEINER EIGENEN AENDERUNG VON VORHIN. Ich hatte pauschal auf
-- "Firmenname enthaelt ein Komma" geprueft. Das war zu grob:
--   "Dortmund, Gym Helmholtz"              UNLESBAR — Ort zuerst
--   "Grundschule Muenchen, Menaristrasse"  LESBAR   — Schulform zuerst
--   "Grund-, Haupt- und Realschule ..."    LESBAR   — Bindestrich-Aufzaehlung
-- Von 329 Firmen mit Komma waeren 119 unnoetig entpersonalisiert worden.
--
-- DAS PRAEZISE MUSTER ist das Kuerzel der NRW-Landesliste nach dem Komma:
--   GH GE RS BK KH SK PS EH FS Gym HS GS
-- GEMESSEN: 210 Treffer im Bestand, davon NULL mit Schulform vor dem Komma.
-- Das Muster trennt sauber, ohne Fehlalarm — anders als die Komma-Regel und
-- anders als ein Wortschnitt auf Schulnamen, der diese Woche dreimal daneben
-- lag.
--
-- ⚠ ES BLEIBT EINE HEURISTIK. Sie ist nur gut belegt, nicht bewiesen. Kommt
-- eine Landesliste mit anderen Kuerzeln dazu, greift sie nicht mehr — dann
-- faellt es in der Anrede auf, nicht in den Daten.
--
-- Betroffen sind BEIDE Kandidaten-RPCs: Fit & Aktiv (weiterfuehrend,
-- beruflich, foerderschule) und WerteRaum (grundschule). 76 der 329 sind
-- Grundschulen, 18 davon stehen in der BW-Vorschau zum 29.09.

CREATE OR REPLACE FUNCTION public.anrede_team_oder_kollegium(p_firmenname text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- "Liebes Team der <Name>" wird unlesbar, wenn der Name im Muster
  -- "Ort, Kuerzel Schulname" steht — so liefert es die NRW-Landesliste.
  -- Dann weicht die Anrede aus; der NAME bleibt unangetastet, weil er die
  -- Referenz zur Liste ist und ein Umdrehen eine Heuristik auf Schulnamen
  -- waere.
  SELECT CASE
    WHEN coalesce(p_firmenname,'') ~ ', (GH|GE|RS|BK|KH|SK|PS|EH|FS|Gym|HS|GS) '
      THEN 'Liebes Kollegium'
    ELSE 'Liebes Team der ' || p_firmenname
  END;
$function$;

COMMENT ON FUNCTION public.anrede_team_oder_kollegium(text) IS
  'Baut die Team-Anrede und weicht auf "Liebes Kollegium" aus, wo der Firmenname das NRW-Muster "Ort, Kuerzel Name" traegt ("Dortmund, Gym Helmholtz"). Gemessen am 17.09.2026: 210 Treffer, null Fehlalarme — kein Name mit Schulform vor dem Komma traegt ein solches Kuerzel. Neue Landeslisten mit anderen Kuerzeln muessen hier ergaenzt werden.';

GRANT EXECUTE ON FUNCTION public.anrede_team_oder_kollegium(text) TO anon, authenticated, service_role;