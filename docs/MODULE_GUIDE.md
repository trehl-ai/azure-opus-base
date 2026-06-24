# Modul-Guide — ein neues Modul anlegen

> Praktische Schritt-für-Schritt-Anleitung. Der **verbindliche** Vertrag steht in
> [docs/ARCHITECTURE.md](ARCHITECTURE.md). Gerüst: [modules/_TEMPLATE/](../modules/_TEMPLATE/).

## 0. Vorab: Ist es überhaupt ein Modul?

Eine eigenständige Fähigkeit mit **eigenen Tabellen + eigenem Lebenszyklus** → Modul.
Ein neues Feld/Report auf bestehenden Core-Daten → **kein** Modul, sondern Core-Arbeit.
(Siehe ARCHITECTURE §7.)

## 1. Gerüst kopieren

```bash
cp -R modules/_TEMPLATE modules/<modul>
```

Ersetze in allen Dateien `<modul>` (Schema-/Codename, klein, snake_case), `<cap>`,
`<Modul-Anzeigename>`. Fülle `modules/<modul>/MODULE.md` aus (Identität, Core-Deps,
exponierte RPCs, Events, Capability→Rollen-Map).

## 2. Schema + RLS (`modules/<modul>/schema/001_init.sql`)

Aus `schema/001_init.sql.example`:
- `CREATE SCHEMA <modul>;` + `GRANT USAGE … TO authenticated, service_role`.
- Tabellen im **eigenen** Schema, **RLS an**, FK auf Core erlaubt (`Modul → Core`).
- **Genau 4** command-spezifische Policies (SELECT/INSERT/UPDATE/DELETE), je `TO authenticated`,
  Prädikate **nur** aus `public.is_admin()` / `public.can_write_deals()` /
  `public.can_manage_all_tasks()` / `core.has_capability('<modul>','<cap>')`.
- Verboten: `TO anon`/`TO public`, `USING (true)`/`WITH CHECK (true)` als Schreibrecht, `all_auth`.

## 3. RPCs / API (`modules/<modul>/rpc/001_api.sql`)

Aus `rpc/001_api.sql.example`:
- Jede `SECURITY DEFINER`-Funktion **muss** `SET search_path = '<modul>','core','public','auth'` pinnen.
- Autorisierung **explizit** im RPC prüfen (SECURITY DEFINER umgeht RLS!).
- Core-Mutationen nur über **Core-RPCs**; Querkopplung nur über `core.emit_event(...)`.

## 4. Als flache Migration ablegen + auf ttgv anwenden

Die Modul-SQL wird zusätzlich als **flache** Migration registriert (drift-check-Konvention):

```bash
# Reihenfolge im Dateinamen = Anwendungsreihenfolge:
supabase/migrations/<version>_<modul>_init.sql      # = schema/001_init.sql
supabase/migrations/<version>_<modul>_api.sql       # = rpc/001_api.sql
```

`<version>` = 14-stelliger UTC-Zeitstempel (`YYYYMMDDhhmmss`). Migration anwenden
(über den etablierten Weg — **kein** ad-hoc `db push` aus Feature-Branches), Modul in
`core.module_registry` registrieren und Capabilities in `core.capabilities` eintragen.
Backfill-Disziplin bei out-of-band angewandten Migrationen: Datei = autoritativer DB-Inhalt
(`schema_migrations.statements`), damit `Schema Drift Check` grün bleibt.

## 5. Frontend (`src/modules/<modul>/`)

Aus `frontend/index.ts.example` → `src/modules/<modul>/index.ts`:
- Default-Export-Manifest mit `requiredCapabilities` + `routes` (`React.lazy()` → eigener Chunk).
- Core nur **lesend** (`.select`) oder via `.rpc(...)`. **Nie** `.insert/.update/.delete/.upsert`
  auf Raw-Core-Tabellen — sonst CONTRACT-LINT rot.

## 6. Tests (`modules/<modul>/tests/`)

- `rbac_smoke.sql` (aus Template): impersoniert je User, zählt sichtbare Modul-Zeilen, ROLLBACK.
  Gegen die **4 Rollen-User** laufen lassen und Counts gegen die Capability-Map prüfen:

```bash
for uid in "$ADMIN_UID" "$MGMT_UID" "$PM_UID" "$SALES_UID"; do
  psql "$DATABASE_URL" -v uid="'$uid'" -f modules/<modul>/tests/rbac_smoke.sql
done
```

## 7. CI lokal gegenchecken

```bash
npm run typecheck
bash scripts/lint-policies.sh   supabase/migrations/<version>_<modul>_*.sql \
                                modules/<modul>/schema/* modules/<modul>/rpc/*
bash scripts/lint-contracts.sh
```

## Definition of Done

Ein Modul ist **fertig**, wenn alle vier grün sind:

- [ ] **RLS-Smoke grün (4 Rollen)** — sichtbare Zeilen je Rolle == erwartete Capability-Map.
- [ ] **Contract-Test grün** — kein Raw-Core-Write aus `src/modules/<modul>/**` (CONTRACT-LINT).
- [ ] **Policy-Lint grün** — RLS an, 4 cmd-Policies, keine `anon/public`+`true`, kein `all_auth`,
      jede `SECURITY DEFINER` pinnt `search_path` (POLICY-LINT).
- [ ] **drift-check grün** — Migration(en) flach abgelegt, Repo == `schema_migrations` auf ttgv,
      Modul in `core.module_registry` registriert.

## CI-Gates (Übersicht)

| Gate | Workflow | Prüft |
|---|---|---|
| Typecheck | `typecheck.yml` | `tsc -b --noEmit` |
| Schema Drift | `schema-drift-check.yml` | Repo-Migrationen == ttgv `schema_migrations` |
| POLICY-LINT | `module-contracts.yml` | RLS-/SECURITY-DEFINER-Hygiene (geänderte SQL) |
| CONTRACT-LINT | `module-contracts.yml` | kein Raw-Core-Write in `src/modules/**` |
