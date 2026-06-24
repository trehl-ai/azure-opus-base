// UI-Spiegel der Live-RLS auf ttgvhqygmgtnjgwunuwz. NUR kosmetisch — die DB-RLS
// ist die Durchsetzungsebene; hier werden keine Security-Regeln dupliziert.
//
// Rollen exakt wie in public.users (DB-Schreibweise, deutsch). 'read_only' ist
// KEINE DB-Rolle (durch users_role_check ausgeschlossen), sondern nur der
// Fallback-Sentinel fuer (noch) nicht geladene/anonyme User (?? "read_only").
//
// Die Matrix ist grob (read|write je Modul). Feinere RLS-Semantik wird in den
// Komponenten via useUserRole abgebildet, NICHT hier:
//   - deals/companies/contacts/projects DELETE = is_admin()  -> isAdmin pro Komponente
//   - deals UPDATE = jeder Pipeline-Accessor (alle 4)        -> in DealDetail offen
//   - tasks/deal_activities Edit/Delete = can_manage_all_tasks() ODER eigener Datensatz
//       -> "write" haelt hier nur den Rollen-Teil [admin, management];
//          der Ownership-Teil (created_by/assigned === auth.uid()) liegt per-Row
//          in den Komponenten. tasks INSERT (RLS = alle) wird ebenfalls
//          komponentenseitig offen gehalten.
type Role = "admin" | "sales" | "projektmanager" | "management" | "read_only";
type Action = "read" | "write";

const permissionMatrix: Record<string, Record<Action, Role[]>> = {
  dashboard:        { read: ["admin", "sales", "projektmanager", "management", "read_only"], write: ["admin"] },
  companies:        { read: ["admin", "sales", "projektmanager", "management", "read_only"], write: ["admin", "management", "projektmanager", "sales"] },
  contacts:         { read: ["admin", "sales", "projektmanager", "management", "read_only"], write: ["admin", "management", "projektmanager", "sales"] },
  deals:            { read: ["admin", "sales", "projektmanager", "management", "read_only"], write: ["admin", "management", "projektmanager"] },
  projects:         { read: ["admin", "sales", "projektmanager", "management", "read_only"], write: ["admin", "management", "projektmanager", "sales"] },
  tasks:            { read: ["admin", "sales", "projektmanager", "management", "read_only"], write: ["admin", "management"] },
  csv_import:       { read: ["admin", "sales"],                                              write: ["admin", "sales"] },
  email_intake:     { read: ["admin", "sales"],                                              write: ["admin", "sales"] },
  settings:         { read: ["admin"],                                                       write: ["admin"] },
  user_management:  { read: ["admin"],                                                       write: ["admin"] },
};

export function hasPermission(userRole: string, module: string, action: Action): boolean {
  const mod = permissionMatrix[module];
  if (!mod) return false;
  return mod[action]?.includes(userRole as Role) ?? false;
}

export { permissionMatrix };
export type { Role, Action };
