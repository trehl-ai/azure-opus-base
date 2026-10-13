CREATE OR REPLACE FUNCTION public.cal_ist_werteraum_event(p_event_id text, p_title text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- ⚠ TROTZ DES NAMENS deckt diese Funktion ALLE Kampagnen ab, fuer die wir
  -- Deals in der Schulpipeline fuehren:
  --   5975343, 6023888  WerteRaum (Thomas Timmer)
  --   6945548           Fit & Aktiv Schulen (Armin Schuster)
  --   7457537           Fit & Aktiv (Thomas Timmer) — angelegt 13.10.2026
  -- Bis zum 17.09. fehlte Armins Event. Jede Fit-&-Aktiv-Buchung waere als
  -- kein_werteraum_event durchgefallen: Kontakt ja, Deal nein — im CRM
  -- vorhanden und trotzdem unsichtbar.
  -- Eine Event-ID ist ein stabiler Schluessel, ein Titel ist es nicht. Der
  -- Titel-Fallback faengt nur, was die Liste verpasst.
  -- NEUE EVENTS GEHOEREN HIER HINEIN.
  --
  -- 7457537 (13.10.2026): Uebergangsloesung, solange Armin im Urlaub ist und
  -- niemand Zugriff auf sein Cal-Konto hat. Gemessen am 13.10.: Armins Event
  -- hatte 3 freie Slots in 7 Tagen bei 48 h Vorlauf, TTs neues 40 bei 4 h.
  -- campaigns.buchungslink der drei VR-Kampagnen zeigt seitdem auf dieses
  -- Event. RUECKBAU nach Armins Rueckkehr: buchungslink zurueck auf 6945548.
  -- Diese ID bleibt dann trotzdem stehen — sie schadet nicht, und
  -- Altbuchungen muessen zuordenbar bleiben.
  SELECT coalesce(p_event_id,'') IN ('5975343','6023888','6945548','7457537')
      OR coalesce(p_title,'') ILIKE '%werteraum%'
      OR coalesce(p_title,'') ILIKE '%fit und aktiv%'
      OR coalesce(p_title,'') ILIKE '%fit & aktiv%';
$function$;