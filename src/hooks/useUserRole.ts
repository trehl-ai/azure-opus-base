import { useAuth } from "@/contexts/AuthContext";

// Rollen-Strings exakt wie in public.users (ttgvhqygmgtnjgwunuwz).
// NB: "projektmanager" (deutsche Schreibweise) — NICHT "project_manager".
// (lib/permissions.ts verwendet abweichend "project_manager" und ist insofern stale.)
export type AppRole = "admin" | "management" | "projektmanager" | "sales" | "read_only";

// Spiegelt die RLS-Helper auf ttgvhqygmgtnjgwunuwz 1:1 wider. Dieses Gating ist
// REIN KOSMETISCH — durchgesetzt wird ausschliesslich von der DB-RLS:
//   can_write_deals()      = get_user_role(auth.uid()) IN ('admin','management','projektmanager')
//   can_manage_all_tasks() = get_user_role(auth.uid()) IN ('admin','management')
//   is_admin()             = get_user_role(auth.uid()) = 'admin'
const WRITE_DEALS_ROLES: AppRole[] = ["admin", "management", "projektmanager"];
const MANAGE_ALL_TASKS_ROLES: AppRole[] = ["admin", "management"];

/**
 * Zentraler Rollen-Hook. Die Rolle stammt aus dem AuthContext, der die
 * public.users-Row des eingeloggten Users EINMALIG über den Session-`supabase`-
 * Client laedt (RLS-konform via auth.uid(), siehe AuthContext.fetchOrCreateDbUser).
 * Damit ist kein zweiter Query noetig — Single Source of Truth, kein Cache-Drift.
 */
export function useUserRole() {
  const { user, loading } = useAuth();
  const role = (user?.role ?? null) as AppRole | null;

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isManagement: role === "management",
    canWriteDeals: role != null && WRITE_DEALS_ROLES.includes(role),
    canManageAllTasks: role != null && MANAGE_ALL_TASKS_ROLES.includes(role),
  };
}
