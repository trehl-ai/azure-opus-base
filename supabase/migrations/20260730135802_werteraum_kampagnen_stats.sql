-- 20260730135802_werteraum_kampagnen_stats
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 663238219a325113c9835d3138a38db5 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Tagesreihe je Landeskampagne. Plausible liefert mit period=day den Tagesstand,
-- der Sync laeuft alle 30 Minuten -> Upsert auf (utm_campaign, stat_datum), letzter
-- Lauf gewinnt. Damit ist der Eintrag idempotent und am Tagesende der Tagesendstand.
create table if not exists public.werteraum_kampagnen_stats (
  id              uuid primary key default gen_random_uuid(),
  utm_campaign    text        not null,
  stat_datum      date        not null,
  visitors        integer     not null default 0,
  pageviews       integer     not null default 0,
  aktualisiert_at timestamptz not null default now(),
  constraint werteraum_kampagnen_stats_uniq unique (utm_campaign, stat_datum)
);

create index if not exists werteraum_kampagnen_stats_kampagne_idx
  on public.werteraum_kampagnen_stats (utm_campaign, stat_datum desc);

-- Lehre aus academy_intel: RLS sofort an, anon nichts.
alter table public.werteraum_kampagnen_stats enable row level security;
revoke all on public.werteraum_kampagnen_stats from anon;
revoke insert, update, delete, truncate on public.werteraum_kampagnen_stats from authenticated;
