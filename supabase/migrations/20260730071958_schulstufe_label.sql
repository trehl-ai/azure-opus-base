-- 20260730071958_schulstufe_label
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 f12f399bf0d9e1c21e79905739b7ba97 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Schulstufe als eigenes, normalisiertes Label. 'schulform' bleibt der amtliche Rohtext
-- ('Grund- und Werkrealschule', 'Berufskolleg', 'HSWRS' ...), 'schulstufe' ist die
-- Kampagnen-Dimension: WerteRaum ist auf Primarstufe zugeschnitten, ein Berufskolleg
-- braucht eine eigene Ansprache.
-- Kombiformen mit Grundschulanteil zaehlen als 'grundschule', weil dort Primarschueler sind.
alter table public.werteraum_school_queue
  add column if not exists schulstufe text;
alter table public.companies
  add column if not exists schulstufe text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='werteraum_school_queue_schulstufe_chk') then
    alter table public.werteraum_school_queue add constraint werteraum_school_queue_schulstufe_chk
      check (schulstufe is null or schulstufe in
             ('grundschule','weiterfuehrend','beruflich','foerderschule','sonstige'));
  end if;
  if not exists (select 1 from pg_constraint where conname='companies_schulstufe_chk') then
    alter table public.companies add constraint companies_schulstufe_chk
      check (schulstufe is null or schulstufe in
             ('grundschule','weiterfuehrend','beruflich','foerderschule','sonstige'));
  end if;
end $$;

comment on column public.companies.schulstufe is
  'Kampagnen-Dimension: grundschule | weiterfuehrend | beruflich | foerderschule | sonstige. Kombiformen mit Grundschulanteil zaehlen als grundschule.';

create index if not exists werteraum_school_queue_schulstufe_idx on public.werteraum_school_queue (schulstufe);
create index if not exists companies_schulstufe_idx on public.companies (schulstufe) where schulstufe is not null;

-- Bestand einordnen
update public.werteraum_school_queue set schulstufe =
  case
    when schulform ilike '%grund%'                                             then 'grundschule'
    when schulform ilike '%berufs%' or schulform ilike '%kolleg%'              then 'beruflich'
    when schulform ilike '%förder%' or schulform ilike '%foerder%'
      or schulform ilike '%sbbz%'                                              then 'foerderschule'
    when schulform ilike '%gymnas%' or schulform ilike '%real%'
      or schulform ilike '%haupt%'  or schulform ilike '%gesamt%'
      or schulform ilike '%sekundar%' or schulform ilike '%ober%'
      or schulform ilike '%werkreal%' or schulform ilike '%gemeinschaft%'
      or schulform ilike '%mittel%'                                            then 'weiterfuehrend'
    when schulform is null                                                     then null
    else 'sonstige'
  end
where schulstufe is null;

-- Auf die verknuepften Firmen durchreichen
update public.companies co set schulstufe = q.schulstufe
from public.werteraum_school_queue q
join public.company_contacts cc on cc.contact_id = q.contact_id
where co.id = cc.company_id and q.schulstufe is not null and co.schulstufe is null;
