-- 18.09.2026: Zwei Dinge an pipeline_stages festhalten, die sonst nur in der DB leben.
--
-- 1) "Wiedervorlage" (Werteraum - Schulen) braucht_aktion = true.
--    Am 18.09. per Datenzeile gesetzt (38 -> 82 Eintraege in der Aktionsliste, 43 davon
--    Wiedervorlage, 22 mit Klick, die vorher in KEINER Ansicht standen). Eine Datenzeile
--    ohne Migration geht beim Neuaufbau verloren — pipeline_stages wird sonst per
--    Migration gepflegt (20260904061142 braucht_aktion, 20260728174944, 20260612073542).
--    Idempotent: UPDATE auf die feste Stufen-ID, nur wenn noch false.
--
-- 2) Die BEDEUTUNG von "2. Mailing": Die Stufe heisst faktisch "Nachfass GEPLANT",
--    nicht "versendet". plane_zweitkontakte (O3hW, 07:00) setzt sie beim Planen und
--    loest ueber trg_second_mailing_scheduled den Scheduler aus; der Versand (kgFT,
--    10:00) setzt KEINE Stufe — bewusst, ein zweiter Setzer waere doppelt.
--    Folgen, die man kennen muss:
--      - Ein Deal in "2. Mailing" mit nur einer Mail ist normal, solange sein
--        scheduled_mailing pending ist.
--      - Wer einen Deal von Hand nach "2. Mailing" schiebt, loest den Scheduler aus:
--        Upsert mit resolution=merge-duplicates setzt ein bereits VERSENDETES
--        scheduled_mailing auf pending zurueck -> erneuter Versand am naechsten Lauf.
--        Deshalb wurden die 9 Rueckstellungs-Deals vom 17.09. am 18.09. mit
--        abgeschaltetem Trigger nachgezogen.
--    Es gibt keine Beschreibungsspalte; der Tabellenkommentar traegt die Wahrheit.

UPDATE public.pipeline_stages
   SET braucht_aktion = true
 WHERE id = 'e152c133-d3c2-43f8-8e46-792933734fe3'
   AND name = 'Wiedervorlage'
   AND braucht_aktion = false;

COMMENT ON TABLE public.pipeline_stages IS
  'Pipeline-Stufen. Werteraum - Schulen: Quellstufen (is_outreach_source) -> "Mailing erhalten" (Erstmail raus) -> "2. Mailing" = NACHFASS GEPLANT (setzt plane_zweitkontakte beim Planen, NICHT der Versand; ein Wechsel hierher loest den Scheduler aus und setzt ein versendetes scheduled_mailing per Upsert auf pending zurueck) -> "Wiedervorlage" = wartet auf einen MENSCHEN (braucht_aktion, keine Quelle fuer den Nachfass, Stufenwechsel hierher storniert pendings) -> Antwort erhalten / Terminiert / Angebot erstellt (braucht_aktion). Stand 18.09.2026.';