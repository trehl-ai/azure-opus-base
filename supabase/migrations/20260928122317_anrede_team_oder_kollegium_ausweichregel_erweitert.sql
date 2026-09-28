-- 28.09.2026: "Liebes Team der OBS am Sonnenhügel im Verbund mit 43497 HS Felix-Nussbaum" ging so raus (Nachfass 10:01).
-- Bisher wich die Anrede nur beim NRW-Listenmuster "Ort, Kuerzel Name" aus. Jetzt zusaetzlich bei Listen-Artefakten im Namen:
-- Schulnummern (3+ Ziffern am Stueck; "6. Grundschule Dresden" bleibt), "im Verbund"/"Schulverbund"/"Verbundschule",
-- Komma, Klammern, Schraegstrich, Doppel-Leerzeichen und Laenge ueber 50 Zeichen. Der NAME bleibt unangetastet (Listenreferenz).
CREATE OR REPLACE FUNCTION public.anrede_team_oder_kollegium(p_firmenname text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(p_firmenname,'') ~ ', (GH|GE|RS|BK|KH|SK|PS|EH|FS|Gym|HS|GS) '  THEN 'Liebes Kollegium'
    WHEN coalesce(p_firmenname,'') ~ '\d{3,}'                                      THEN 'Liebes Kollegium'
    WHEN coalesce(p_firmenname,'') ~* '(im verbund|schulverbund|verbundschule)'     THEN 'Liebes Kollegium'
    WHEN coalesce(p_firmenname,'') ~ '[,()/]'                                       THEN 'Liebes Kollegium'
    WHEN coalesce(p_firmenname,'') ~ '  '                                           THEN 'Liebes Kollegium'
    WHEN length(coalesce(p_firmenname,'')) > 50                                     THEN 'Liebes Kollegium'
    ELSE 'Liebes Team der ' || p_firmenname
  END;
$function$;