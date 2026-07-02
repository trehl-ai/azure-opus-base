# EO IPSO CRM — Claude Code Context

## Stack
- Frontend: React + TypeScript (Lovable Pro)
- Backend: Supabase ttgvhqygmgtnjgwunuwz (Frankfurt eu-central-1)
- URL: https://ts-connect.cloud  (Prod-Domain; NICHT crm.ts-connect.cloud — das ist ein separates Vercel-Projekt: stellar-react-stack / "TomI CRM")
- Repo: trehl-ai/azure-opus-base

## Supabase Tabellen
companies, contacts, company_contacts, deals, deal_activities,
pipelines, pipeline_stages, entity_tags, tags, audit_log,
webhook_log, intake_messages

## Auth
Email Magic Link + Google OAuth
site_url: https://ts-connect.cloud

## Modulare Architektur — Core-Schema (Phase 2, ab #159)
Verbindlicher Bauplan: `docs/ARCHITECTURE.md` + `docs/MODULE_GUIDE.md`. Modularer Monolith, eine DB (ttgv), Einbahn-Abhängigkeit **Core ⟵ Module** (Core kennt kein Modul). CI erzwingt die Grenzen: `typecheck` (required), `drift-check`, POLICY-LINT, CONTRACT-LINT.

**Core read-contract Views** (`core`-Schema, security_invoker=true → RLS der Basistabellen gilt, KEIN Bypass; soft-delete-aware `WHERE deleted_at IS NULL`):
- `core.v_company`, `core.v_contact`, `core.v_deal` — Migration `20260625130534_core_billing_read_contract_views.sql` (#160)
- Module lesen Core **ausschließlich** über `core.v_*` / Read-RPCs, nie Raw-`public`-Tabellen.

**Modul-Vertrag — 3 erlaubte Core-Berührungspunkte:**
- (a) LESEN nur via `core.v_*` / Read-RPC — `.select` auf Core erlaubt, aber View ist der Vertrag.
- (b) SCHREIBEN nur via Core-RPC (`SECURITY DEFINER`, pinned search_path). CONTRACT-LINT macht PR rot bei `.from('deals'|...).insert/update/delete/upsert(...)` aus Modul-Frontend — Mutation nur via `.rpc(...)`.
- (c) Eigene Moduldaten im eigenen Schema, FK Modul→Core erlaubt. Querkopplung NUR über `core.events` / `core.emit_event(...)`.

**Core-Typen:** `src/core/database.types.ts` (#161) — generiert via `supabase gen types typescript --project-id ttgvhqygmgtnjgwunuwz --schema core`. STRIKT getrennt von der Lovable-Datei `src/integrations/supabase/types.ts` — letztere **NIE** mit `gen types` überschreiben (korrumpiert den Lovable-Sync). Re-Gen der Core-Typen läuft in eigenem Worktree/Branch, kein `db push`.

`*.tsbuildinfo` ist gitignored (#162) — tsc-Build-Artefakte triggern keine Status-Checks.

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

## LOVABLE-FREEZE (absolut — nie abweichen)
- trehl-ai/azure-opus-base: KEINE Lovable-Prompts ausführen — nur Claude Code
- Lovable-Sync (types.ts von qgvedroebvmwhnjmeyip) bleibt aktiv — nur Prompts sind verboten
- Lovable nur für isolierte UI-Prototypen in separaten Projekten
- Begründung: Lovable regeneriert Code und überschreibt Claude-Code-Fixes (supabaseEIC-RLS-Bug 5x aufgetreten)

## STAGING-WORKFLOW (ab 11.06.2026)
- Feature Branch → PR auf staging → testen auf staging.ts-connect.cloud
- Erst nach Test: PR staging → main → Produktion ts-connect.cloud
- staging Branch: trehl-ai/azure-opus-base/tree/staging
