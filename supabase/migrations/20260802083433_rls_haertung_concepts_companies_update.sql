-- RLS-Haertung 02.08.2026 (Befund: /ideas + /sponsoring ohne Guards, Datenebene offen)
--
-- concepts hatte KEIN RLS: jeder authentifizierte User las alle Angebotskonzepte
-- inkl. Versionierung. Ab jetzt: Lesen fuer Arbeitsrollen (admin/management/
-- projektmanager via can_write_deals()), Schreiben nur admin.
--
-- companies_update stand auf USING (true): jeder authentifizierte User konnte
-- jede Firma aendern (inkl. sales/restricted). Ab jetzt: can_write_deals().
-- companies_select bleibt bewusst offen — Umuts WerteRaum-Schulen sind companies;
-- der Sponsoring-Schutz haengt an concepts-RLS + Routing-Guards (Frontend, separat).
-- contacts_update bleibt vorerst offen (sales editiert legitim Ansprechpartner);
-- pipeline-scoping ist Folgethema.
--
-- Kein n8n-/RPC-Bruchrisiko: Workflows schreiben mit Service-Key (RLS-immun),
-- werteraum_import_company_deal ist SECURITY DEFINER.

alter table public.concepts enable row level security;

create policy concepts_select on public.concepts
  for select to authenticated
  using (can_write_deals());

create policy concepts_write on public.concepts
  for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy companies_update on public.companies;

create policy companies_update on public.companies
  for update to authenticated
  using (can_write_deals()) with check (can_write_deals());