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

---

## Stand 2026-05-11 (Pre-Onboarding-Sweep)

### Aktive User (4)
| Email | Rolle | UUID |
|---|---|---|
| tomaschwirkmann@gmail.com | admin | `81de2da3-eef1-4b20-955f-09aed66bc1a3` |
| w.berchtold@eo-ipso.com | admin | `bbef0cd5-a83b-47cc-b5fa-119101b272cb` |
| t.timmer@eo-ipso.com | sales | — |
| a.schuster@eo-ipso.com | sales | — |
| riachaas@gmail.com | sales | — |

Dorian Maierhofer (ehem. dactadorian@gmail.com) komplett entfernt — 24 Records auf Tomas umgehängt vor DELETE auth.users.

### Heute deployed (apply_migration via MCP)
- `set_deal_reopen(p_deal_id, p_target_stage_id) → json` (SECURITY DEFINER) — Reopen-Feature im Frontend war Runtime-Error wegen fehlender RPC
- `users` RLS-Härtung: Policy `users_self_or_admin_update` (UPDATE für self ODER admin) + Policy `users_self_insert` (für OAuth-Bootstrap) + Trigger `prevent_role_escalation` (Non-Admin kann role/is_active/email nicht ändern)

### Signatur (Single-Tenant Hardcode)
Firma+Adresse sind als `COMPANY`-Konstante in `src/lib/signature.ts` hardcoded (eo ipso Marke & Erlebnis GmbH / Talangerstraße 7, 82152 Krailling-München). Keine per-User-Inputs mehr für Unternehmen/Adresse. PR `feature/hardcode-signature-company` (Commit `ec71cdc`).

### Migration-Drift-Check vor Deploy
Vor GF-Demos: lokale Files in `supabase/migrations/` gegen `supabase_migrations.schema_migrations` und gegen Frontend-RPC-Calls abgleichen. Idempotente Migrations (CREATE OR REPLACE) sind nachträglich safe; obsolete Files aus dem Repo entfernen damit `db push` nicht alte Konflikte aufmacht. Siehe Memory `supabase_migration_drift_detection.md`.

### Bekannte System-Sicherheits-Note
Alle `set_deal_*` Functions haben `EXECUTE` auf `anon` (Postgres-Default `PUBLIC=EXECUTE`). Als SECURITY DEFINER bypassen sie RLS — unauthenticated Calls könnten Deal-Status-Transitions triggern. Konsistent über alle 4 Functions (kein neues Risk), aber latenter Härtungs-Kandidat (`REVOKE EXECUTE FROM PUBLIC, anon` in separater Security-Migration).

