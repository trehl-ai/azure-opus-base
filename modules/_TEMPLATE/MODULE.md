# Modul: `<modul>`

> Manifest-Vorlage. Kopiere `modules/_TEMPLATE/` nach `modules/<modul>/`, ersetze alle
> `<modul>` / `<cap>` / `<Modul-Anzeigename>` und fülle die Tabellen unten aus.
> Siehe [docs/MODULE_GUIDE.md](../../docs/MODULE_GUIDE.md) für den Schritt-für-Schritt-Ablauf
> und [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) für den verbindlichen Vertrag.

## Identität
| Feld | Wert |
|---|---|
| Modul-Name (Schema) | `<modul>` |
| Anzeigename | `<Modul-Anzeigename>` |
| Version | `1.0.0` |
| DB-Schema | `<modul>.` (eigene Tabellen, RLS an) |
| Frontend | `src/modules/<modul>/` (lazy, eigener Chunk) |
| n8n-Workflows | Tag/Präfix `<modul>__*` (nur Trigger/Status, kein eigener Builder) |

## Core-Abhängigkeiten (Einbahn: Modul → Core)
> Core kennt dieses Modul NICHT. Nur diese Berührungspunkte sind erlaubt.

| Art | Core-Objekt | Nutzung |
|---|---|---|
| LESEN | `core.v_*` / Core-View | _z. B. Deal-Stammdaten lesen_ |
| SCHREIBEN | `core.<rpc>(...)` | _Core-Mutation nur via RPC (SECURITY DEFINER)_ |
| FK | `public.deals(id)` | _FK aus `<modul>.widget.deal_id` (Modul→Core erlaubt)_ |
| EVENT | `core.emit_event(...)` | _Kopplung an andere Module nur über den Event-Spine_ |

## Exponierte RPCs (die API dieses Moduls)
| RPC | Signatur | Autorisierung |
|---|---|---|
| `<modul>.create_widget` | `(p_deal_id uuid, p_title text) → uuid` | `core.has_capability('<modul>','write')` |

## Emittierte Events
| event_type | Wann | Payload |
|---|---|---|
| `widget.created` | nach Insert | `{ deal_id, title }` |

## Capability → Rollen-Map (deklarativ)
> Wird in `core.capabilities` registriert (Migration). Quelle der Wahrheit für RLS + UI.

| Capability | admin | management | projektmanager | sales |
|---|:---:|:---:|:---:|:---:|
| `<modul>.read` | ✅ | ✅ | ✅ | ✅ |
| `<modul>.write` | ✅ | ✅ | ✅ | ❌ |

## Definition of Done
- [ ] RLS-Smoke grün gegen alle 4 Rollen (`modules/<modul>/tests/rbac_smoke.sql`) — Counts == Capability-Map
- [ ] Contract-Test grün (kein Raw-Core-Write im Modul-Frontend)
- [ ] POLICY-LINT grün (RLS an, 4 cmd-Policies, keine `USING (true)`/anon/public, SECURITY DEFINER pinnt `search_path`)
- [ ] drift-check grün (Migration flach abgelegt + in `core.module_registry` registriert)
