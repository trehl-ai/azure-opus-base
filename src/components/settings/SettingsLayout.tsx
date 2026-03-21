import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

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
      { label: "Tags", path: "/settings/tags" },
      { label: "Deal-Felder", path: "/settings/deal-fields" },
    ],
  },
];

export default function SettingsLayout() {
  return (
    <div className="flex gap-0 min-h-[calc(100vh-4rem)]">
      {/* Sub-sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-card rounded-l-2xl">
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
