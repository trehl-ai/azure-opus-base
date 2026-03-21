type Role = "admin" | "sales" | "project_manager" | "management" | "read_only";
type Action = "read" | "write";

const permissionMatrix: Record<string, Record<Action, Role[]>> = {
  dashboard:        { read: ["admin", "sales", "project_manager", "management", "read_only"], write: ["admin"] },
  companies:        { read: ["admin", "sales", "project_manager", "management", "read_only"], write: ["admin", "sales"] },
  contacts:         { read: ["admin", "sales", "project_manager", "management", "read_only"], write: ["admin", "sales"] },
  deals:            { read: ["admin", "sales", "management", "read_only"],                    write: ["admin", "sales"] },
  projects:         { read: ["admin", "sales", "project_manager", "management", "read_only"], write: ["admin", "project_manager"] },
  tasks:            { read: ["admin", "sales", "project_manager", "management", "read_only"], write: ["admin", "sales", "project_manager"] },
  csv_import:       { read: ["admin", "sales"],                                               write: ["admin", "sales"] },
  email_intake:     { read: ["admin", "sales"],                                               write: ["admin", "sales"] },
  settings:         { read: ["admin"],                                                        write: ["admin"] },
  user_management:  { read: ["admin"],                                                        write: ["admin"] },
};

export function hasPermission(userRole: string, module: string, action: Action): boolean {
  const mod = permissionMatrix[module];
  if (!mod) return false;
  return mod[action]?.includes(userRole as Role) ?? false;
}

export { permissionMatrix };
export type { Role, Action };
