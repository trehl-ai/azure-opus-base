# Architektur — Modularer Monolith (verbindlicher Bauplan)

> Status: **verbindlich**. Jede neue Fähigkeit wird als _Modul_ nach diesem Dokument
> gebaut. Abweichungen brauchen eine bewusste Entscheidung (ADR), keinen stillen Bypass.
> CI erzwingt die hier beschriebenen Grenzen (`Typecheck`, `Schema Drift Check`,
> `Module Contracts` → POLICY-LINT + CONTRACT-LINT).

## 1. Leitprinzip

**Ein modularer Monolith. Eine Datenbank. Harte interne Grenzen.**

- Ein Deploy, ein Repo, eine Supabase-DB (`ttgvhqygmgtnjgwunuwz`) — kein verteiltes System.
- Die Stärke liegt nicht in getrennten Servern, sondern in **erzwungenen Grenzen** innerhalb
  desselben Prozesses/derselben DB. Module sind voneinander isoliert wie Microservices,
  ohne deren Betriebskosten.
- **Einbahn-Abhängigkeit: Core ⟵ Module.** Der Core kennt **kein** Modul. Abhängigkeiten und
  Fremdschlüssel zeigen **immer** vom Modul zum Core (`Modul → Core`), nie umgekehrt.
  Ein Modul darf entfernt werden, ohne dass der Core oder ein anderes Modul bricht.

```
        ┌───────────────────────────────────────────────┐
        │                    CORE                        │
        │  contacts companies deals pipelines tasks ...  │
        │  core.events  core.capabilities  core-RPCs     │
        └───────────────────────────────────────────────┘
              ▲              ▲               ▲
              │ FK / RPC     │ RPC           │ Events
        ┌─────┴─────┐  ┌─────┴─────┐   ┌─────┴─────┐
        │ marketing │  │  service  │   │   …       │   ← Module kennen Core,
        └───────────┘  └───────────┘   └───────────┘     Core kennt sie NICHT
              └──────── koppeln NUR über core.events ────────┘
```

## 2. Die 5 Isolations-Grenzen

Jedes Modul ist auf **fünf** Ebenen vom Rest getrennt:

| # | Grenze | Regel |
|---|---|---|
| 1 | **DB-Schema pro Modul** | Eigenes Postgres-Schema (`marketing.`, `service.`, …). Keine Modul-Tabelle in `public`. RLS auf jeder Tabelle an. |
| 2 | **Migrations-Namenskonvention** | Physisch **flach** in `supabase/migrations/<14-stellig>_<modul>_<zweck>.sql` (drift-check matcht den Versions-Prefix). Die `core/<modul>`-Ordnung ist konzeptionell, **kein** physischer Unterordner. |
| 3 | **`src/modules/<name>/` lazy-loaded** | Frontend pro Modul in eigenem Verzeichnis, Default-Export-Manifest, Routen via `React.lazy()` → eigener Bundle-Chunk, **nicht** im Haupt-Bundle. |
| 4 | **n8n-Workflows pro Modul** | Automationen mit Modul-Präfix/Tag (`<modul>__*`). Kein Modul fasst die WFs eines anderen an. |
| 5 | **Tests pro Modul** | RLS-Smoke + Contract-Tests liegen im Modul (`modules/<modul>/tests/`), laufen gegen die 4 Rollen. |

## 3. Der Vertrag — die **3 erlaubten Berührungspunkte** mit Core

Alles andere ist verboten (und wird von CI/Review abgelehnt):

**(a) Core LESEN — nur über stabile `core`-Views/RPCs, nie Raw-Core-Tabellen.**
Module lesen Deal-/Kontakt-/Firmendaten über vom Core bereitgestellte, stabile Views
(`core.v_*`) oder Read-RPCs. Direkter `SELECT` auf `public.deals` etc. aus Modul-Code ist
zu vermeiden — die View ist der Vertrag, die Tabelle ist Implementierung.

**(b) Core SCHREIBEN — nur über Core-RPCs (`SECURITY DEFINER`, pinned `search_path`).**
Ein Modul mutiert **nie** direkt `deals/contacts/companies/pipelines/deal_activities/tasks/users`.
Jede Core-Mutation läuft durch einen Core-RPC, der die Autorisierung selbst prüft.
CONTRACT-LINT macht den PR rot, wenn ein Modul-Frontend `.from('deals').insert/update/delete/upsert(...)`
o. Ä. nutzt. Lesendes `.select` ist erlaubt; Schreiben nur via `.rpc(...)`.

**(c) Eigene Moduldaten im eigenen Schema — FK auf Core erlaubt.**
Das Modul besitzt seine Tabellen in seinem Schema und darf FKs auf Core-Tabellen legen
(`<modul>.widget.deal_id → public.deals.id`). Das ist die einzige erlaubte „harte" Kopplung
und sie zeigt in die richtige Richtung (Modul → Core).

## 4. Event-Spine — Module koppeln NUR über Events

Module reden **nicht** miteinander über fremde Tabellen. Querkopplung läuft ausschließlich
über den zentralen Event-Spine im Core:

- **`core.events`** — append-only Ereignis-Log (Schreiben nur via Funktion, kein INSERT-Policy).
- **`core.emit_event(p_entity_type text, p_entity_id uuid, p_module text, p_event_type text, p_payload jsonb)`**
  — `SECURITY DEFINER`, der einzige Schreibpfad in `core.events`.

```sql
PERFORM core.emit_event('widget', v_id, 'marketing', 'widget.created',
                        jsonb_build_object('deal_id', p_deal_id));
```

Ein konsumierendes Modul reagiert auf Events (Trigger/Worker/n8n), **nie** durch direkten
Zugriff auf die Tabellen des emittierenden Moduls. So bleibt jedes Modul einzeln entfernbar.

## 5. Capability-Modell — Berechtigungen deklarativ

Sichtbarkeit und Schreibrechte hängen an **Capabilities**, nicht an hartkodierten Rollen-Checks
im Modul:

- **`core.capabilities`** — deklarative Map `(modul, capability) → Rollen`.
- **`core.has_capability(p_module text, p_capability text)`** — `SECURITY DEFINER`, in RLS-Policies
  und RPCs der einzige Capability-Check.
- RLS-Policies nutzen ausschließlich die stabilen Core-Helfer:
  `public.is_admin()`, `public.can_write_deals()`, `public.can_manage_all_tasks()`,
  `core.has_capability('<modul>','<cap>')`. **Nie** `TO anon`/`TO public`, **nie** `USING (true)`
  als Schreibrecht, **kein** Catch-all `all_auth`. POLICY-LINT erzwingt das.

Die Rollen sind weiterhin `admin / management / projektmanager / sales`; die RLS bleibt die
Durchsetzungsschicht, die Capability-Map die deklarative Quelle der Wahrheit.

## 6. n8n bleibt die Automations-Engine

n8n ist die Workflow-/Automations-Engine — das bleibt so. Ein etwaiges `workflows`-Modul ist
**nur** Trigger-Registrierung und Status-Spiegel (welche WFs gehören zu welchem Modul, laufen sie),
**kein** eigener Workflow-Builder im Produkt. Automationslogik lebt in n8n, nicht in einem Modul.

## 7. Abgrenzung — was ist (k)ein Modul?

> **Modul = eigenständige Fähigkeit mit eigenen Tabellen + eigenem Lebenszyklus.**

- ✅ Modul: „Marketing-Kampagnen", „Service-Tickets", „Investor-Intelligence" — eigene Tabellen,
  eigene Routen, eigene Capabilities, einzeln installier-/entfernbar.
- ❌ **Kein** Modul: ein neues Feld auf `deals`, eine zusätzliche Spalte, ein Report über
  bestehende Core-Daten. Das ist Core-Arbeit (Migration + ggf. View), kein Modul.

Faustregel: Braucht die Fähigkeit **eigene Tabellen + eigenen Lebenszyklus**? Dann Modul.
Sonst Core.

## 8. Verwandte Dokumente

- **[docs/MODULE_GUIDE.md](MODULE_GUIDE.md)** — Schritt-für-Schritt „neues Modul anlegen" + Definition of Done.
- **[modules/_TEMPLATE/](../modules/_TEMPLATE/)** — kopierbares Gerüst (Schema, RPC, Frontend, Tests, Manifest).
- CI-Gates: `.github/workflows/` → `typecheck.yml`, `schema-drift-check.yml`, `module-contracts.yml`.
