-- 20260807105515_werteraum_segment_schema
-- Out-of-band angewendet, hier als Datei nachgezogen (Schema Drift Check).
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz).
-- Inhalt aus dem Live-Schema rekonstruiert (pg_constraint / pg_indexes /
-- pg_attribute), damit die Datei exakt den Stand erzeugt, der in der DB steht.
-- Kein "NOTIFY pgrst" - gehoert nicht in eine Migrationsdatei.
--
-- Segment ist die Kampagnen-Dimension neben dem Bundesland: derselbe Ort wird
-- fuer Grundschule und Berufskolleg unterschiedlich angesprochen. 'schulstufe'
-- traegt das Label an der Firma, 'segment' an Deal und Kampagnenplan.

-- ---------------------------------------------------------------------
-- deals.segment + CHECK + Index
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists segment text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_segment_check') then
    alter table public.deals add constraint deals_segment_check
      check (segment is null or segment in
             ('grundschule','weiterfuehrend','beruflich','foerderschule','sonstige'));
  end if;
end $$;

comment on column public.deals.segment is
  'Kampagnen-Dimension des Deals: grundschule | weiterfuehrend | beruflich | foerderschule | sonstige. NULL = noch nicht eingeordnet.';

create index if not exists idx_deals_pipeline_segment
  on public.deals (pipeline_id, segment)
  where deleted_at is null;

-- ---------------------------------------------------------------------
-- companies_schulstufe_check
-- ---------------------------------------------------------------------
-- Anmerkung: 20260730071958_schulstufe_label hat dieselbe Pruefung bereits
-- unter dem Namen 'companies_schulstufe_chk' angelegt. Live existieren beide
-- Constraints nebeneinander; die Datei bildet den Ist-Stand ab und legt
-- deshalb auch die zweite an. Die Dublette ist fachlich folgenlos (identische
-- Bedingung), aber redundant - siehe PR-Beschreibung.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_schulstufe_check') then
    alter table public.companies add constraint companies_schulstufe_check
      check (schulstufe is null or schulstufe in
             ('grundschule','weiterfuehrend','beruflich','foerderschule','sonstige'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- werteraum_kampagnen_plan.segment + CHECK + Unique-Index
-- ---------------------------------------------------------------------
alter table public.werteraum_kampagnen_plan
  add column if not exists segment text not null default 'grundschule';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wr_plan_segment_check') then
    alter table public.werteraum_kampagnen_plan add constraint wr_plan_segment_check
      check (segment in
             ('grundschule','weiterfuehrend','beruflich','foerderschule','sonstige'));
  end if;
end $$;

comment on column public.werteraum_kampagnen_plan.segment is
  'Kampagnen-Dimension des Plans. Default grundschule, weil der Bestand vor dieser Migration ausschliesslich Primarstufe war.';

create unique index if not exists ux_wr_plan_bl_segment
  on public.werteraum_kampagnen_plan (bundesland, segment);
