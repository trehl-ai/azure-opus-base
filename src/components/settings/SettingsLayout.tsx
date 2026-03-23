import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown } from "lucide-react";

const settingsNav = [
  {
    label: "KONTO",
    items: [
      { label: "Mein Profil", path: "/settings/profile" },
      { label: "Passwort & Sicherheit", path: "/settings/security" },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { label: "Allgemein", path: "/settings/general" },
      { label: "Benutzerverwaltung", path: "/settings/users" },
      { label: "Rollen & Rechte", path: "/settings/roles" },
    ],
  },
  {
    label: "CRM-KONFIGURATION",
    items: [
      { label: "Pipelines", path: "/settings/pipelines" },
      { label: "Task-Status", path: "/settings/task-statuses" },
      { label: "Tags", path: "/settings/tags" },
      { label: "Deal-Felder", path: "/settings/deal-fields" },
    ],
  },
  {
    label: "INTEGRATIONEN",
    items: [
      { label: "E-Mail-Konten", path: "/settings/email-accounts" },
    ],
  },
];

function getCurrentLabel(pathname: string): string {
  for (const group of settingsNav) {
    for (const item of group.items) {
      if (pathname === item.path || pathname.startsWith(item.path + "/")) return item.label;
    }
  }
  return "Einstellungen";
}

export default function SettingsLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentLabel = getCurrentLabel(location.pathname);

  if (isMobile) {
    return (
      <div className="space-y-4">
        <h1 className="text-[24px] font-semibold text-foreground">Einstellungen</h1>
        {/* Collapsible nav for mobile */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-[14px] font-medium"
        >
          {currentLabel}
          <ChevronDown className={cn("h-4 w-4 transition-transform", mobileNavOpen && "rotate-180")} />
        </button>
        {mobileNavOpen && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {settingsNav.map((group) => (
              <div key={group.label}>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground select-none">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "block px-4 py-3 text-[14px] font-medium transition-colors min-h-[44px] flex items-center",
                        isActive
                          ? "bg-primary/5 text-primary"
                          : "text-foreground hover:bg-muted"
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        )}
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex gap-0 min-h-[calc(100vh-4rem)]">
      {/* Sub-sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-card rounded-l-2xl hidden md:block">
        <nav className="p-4 space-y-1">
          {settingsNav.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-4 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground select-none">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                      isActive
                        ? "bg-[#EEF0FE] text-primary"
                        : "text-foreground hover:bg-muted"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 p-8">
        <h1 className="text-[28px] font-semibold text-foreground mb-8">Einstellungen</h1>
        <Outlet />
      </div>
    </div>
  );
}
