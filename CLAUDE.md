# EO IPSO CRM — Claude Code Context

## Stack
- Frontend: React + TypeScript (Lovable Pro)
- Backend: Supabase ttgvhqygmgtnjgwunuwz (Frankfurt eu-central-1)
- URL: https://crm.ts-connect.cloud
- Repo: trehl-ai/azure-opus-base

## Supabase Tabellen
companies, contacts, company_contacts, deals, deal_activities,
pipelines, pipeline_stages, entity_tags, tags, audit_log,
webhook_log, intake_messages

## Auth
Email Magic Link + Google OAuth
site_url: https://crm.ts-connect.cloud

## Bug-Fix Regeln (KRITISCH)
- NIEMALS direkt auf main committen
- Immer Branch: fix/bug-[issue-nummer]
- NIEMALS Supabase Service Role Key in Code
- NIEMALS andere Supabase Projekte als ttgvhqygmgtnjgwunuwz
- Minimale Änderungen — kein Refactoring
- Nach Fix: npx tsc --noEmit ausführen
- Nur betroffene Files ändern

## Häufige Bug-Pattern (Lovable)
- undefined is not a function → null-check vor Array-Operation fehlt
- Button reagiert nicht → onClick Handler fehlt
- Formular speichert nicht → Supabase INSERT fehlt required field oder RLS blockiert
- Filter funktioniert nicht → Query-Parameter falsch übergeben
- Auth-Loop → redirectTo URL nicht in Supabase allowlist

## Commit-Format
fix: [kurze Beschreibung] (fixes #[issue-nummer])
