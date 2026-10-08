-- Korrektur zu 20261008092309. Die dort angelegten Policies waren zu weit:
-- INSERT und UPDATE "TO authenticated USING (true)" haetten JEDEM angemeldeten
-- Nutzer erlaubt, Intake-Faelle anzulegen und zu aendern — auch Umut, der
-- ausdruecklich auf die WerteRaum-Pipeline beschraenkt ist.
-- Der CI-Check policy-lint hat das gefangen (B2, Blanket-Schreibpolicy ohne
-- Rollen-Helper). Der Lint hatte recht.
--
-- Neue Aufteilung:
--   SELECT  -> can_write_deals()  (admin, management, projektmanager)
--   UPDATE  -> can_write_deals()  (Faelle schliessen und zuordnen)
--   INSERT  -> gar keine Policy. Geschrieben wird ausschliesslich vom
--              Intake-Workflow PWkkJ6CaX0jK4C3V als service_role, und
--              service_role umgeht RLS ohnehin. Eine Policy fuer einen
--              Schreibweg, den es nicht gibt, ist Angriffsflaeche ohne Nutzen.
--   DELETE  -> weiterhin keine. Intake-Faelle werden geschlossen, nicht geloescht.

DROP POLICY IF EXISTS intake_unzugeordnet_select ON public.intake_unzugeordnet;
DROP POLICY IF EXISTS intake_unzugeordnet_insert ON public.intake_unzugeordnet;
DROP POLICY IF EXISTS intake_unzugeordnet_update ON public.intake_unzugeordnet;

CREATE POLICY intake_unzugeordnet_select ON public.intake_unzugeordnet
  FOR SELECT TO authenticated
  USING (can_write_deals());

CREATE POLICY intake_unzugeordnet_update ON public.intake_unzugeordnet
  FOR UPDATE TO authenticated
  USING (can_write_deals())
  WITH CHECK (can_write_deals());