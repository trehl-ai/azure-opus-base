create schema if not exists _quarantine;

create table if not exists _quarantine.eis_knowledge_entries_20260728 as
  select *, now() as quarantaeniert_am from public.eis_knowledge_entries;

comment on table _quarantine.eis_knowledge_entries_20260728 is
  'Verschoben 2026-07-28. 13 Eintraege, alle angelegt 2026-05-30 13:57:36 in einem Batch, ohne source-Spalte und ohne Beleg. Inhalt widerspricht der massgeblichen Tabelle public.concepts: Philipp Lahm als Botschafter, Porsche 4Kids / BMW Junior Campus / MSD als Referenzkunden sowie eine Preisliste (50K/75-100K/100-150K) existieren dort nicht; alle drei echten Konzepte haben sponsoring_pakete=null. Rebensburg ist dort Gesundheitspraevention (Fit & Aktiv), nicht MINT. WerteRaum fehlte vollstaendig. Kein Workflow hat diese Tabelle je gelesen. Aufbewahrt zur Pruefung, nicht geloescht.';;