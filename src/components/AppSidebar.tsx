import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  FolderKanban,
  CheckSquare,
  Upload,
  Mail,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections = [
  {
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", module: "dashboard" },
    ],
  },
  {
    sectionLabel: "SALES",
    items: [
      { label: "Contacts", icon: Users, path: "/contacts", module: "contacts" },
      { label: "Companies", icon: Building2, path: "/companies", module: "companies" },
      { label: "Deals", icon: Handshake, path: "/deals", module: "deals" },
    ],
  },
  {
    sectionLabel: "OPERATIONS",
    items: [
      { label: "Projects", icon: FolderKanban, path: "/projects", module: "projects" },
      { label: "Tasks", icon: CheckSquare, path: "/tasks", module: "tasks" },
    ],
  },
  {
    sectionLabel: "DATA",
    items: [
      { label: "Import", icon: Upload, path: "/import", module: "csv_import" },
      { label: "Intake", icon: Mail, path: "/intake", module: "email_intake" },
    ],
  },
];

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  sales: "Sales",
  project_manager: "Projektmanager",
  management: "Management",
  read_only: "Nur Lesen",
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role ?? "read_only";

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-primary text-white">
      <div className="px-6 pt-6 pb-2">
        <span className="text-[22px] font-bold tracking-tight">CRM</span>
      </div>

      {user && (
        <div className="mx-4 mb-4 rounded-lg bg-white/10 px-4 py-3">
          <p className="text-[14px] font-medium leading-tight truncate">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-[12px] font-medium text-white/60 mt-0.5">
            {roleLabels[user.role] ?? user.role}
          </p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {navSections.map((section, sIdx) => {
          const visibleItems = section.items.filter(item => hasPermission(role, item.module, "read"));
          if (visibleItems.length === 0) return null;
          return (
            <div key={sIdx}>
              {section.sectionLabel && (
                <p className="px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider text-[#C9CDF8] select-none">
                  {section.sectionLabel}
                </p>
              )}
              {visibleItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-white text-primary shadow-sm"
                        : "text-white/90 hover:bg-white/[0.08]"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 px-3 py-3 space-y-1">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors",
            isActive("/settings")
              ? "bg-white text-primary shadow-sm"
              : "text-white/90 hover:bg-white/[0.08]"
          )}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span>Settings</span>
        </NavLink>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium text-white/90 hover:bg-white/[0.08] transition-colors"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
