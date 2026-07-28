-- Backfill. Applied out-of-band via MCP am 2026-07-28.
-- Diese Datei re-applied nichts Neues; sie holt die bereits live in ttgvhqygmgtnjgwunuwz
-- angewendete Migration in das Repo nach, damit CI drift-check gruen bleibt.
-- Quelle: supabase_migrations.schema_migrations, version 20260728174944 (verbatim).

-- Neue Stage "Antwort erhalten" in der WerteRaum-Pipeline, Position 7 (vor "Terminiert").
-- Grund: "Terminiert" enthielt bisher jede Reaktion statt echter Terminbuchungen.
-- Von 13 Deals dort hatte keiner einen Terminbeleg, 6 waren blosse Mail-Antworten.
-- Damit wird "Terminiert" zur harten Kennzahl (nur Cal.com-Buchung, siehe Folgeschritt).

-- 1. Nachfolgende Stages um eine Position nach hinten schieben
UPDATE public.pipeline_stages
SET position = position + 1
WHERE pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
  AND position >= 7;

-- 2. Neue Stage einfuegen
INSERT INTO public.pipeline_stages (pipeline_id, name, position, is_hidden)
VALUES ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Antwort erhalten', 7, false);