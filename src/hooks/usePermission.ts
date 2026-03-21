import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";

/**
 * Hook that returns permission check functions based on current user role.
 */
export function usePermission() {
  const { user } = useAuth();
  const role = user?.role ?? "read_only";

  return {
    can: (module: string, action: "read" | "write") => hasPermission(role, module, action),
    canWrite: (module: string) => hasPermission(role, module, "write"),
    canRead: (module: string) => hasPermission(role, module, "read"),
    isAdmin: role === "admin",
    role,
  };
}
