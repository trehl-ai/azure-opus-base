import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useProfileImage } from "@/hooks/useProfileImage";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  FolderKanban,
  CheckSquare,
  Upload,
  Mail,
  Send,
  Settings,
  LogOut,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      { label: "💡 Ideen", icon: Lightbulb, path: "/ideas", module: "contacts" },
    ],
  },
  {
    sectionLabel: "DATA",
    items: [
      { label: "Import", icon: Upload, path: "/import", module: "csv_import" },
      { label: "Intake", icon: Mail, path: "/intake", module: "email_intake" },
      { label: "E-Mail", icon: Send, path: "/compose", module: "dashboard" },
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

interface AppSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ collapsed = false, onNavigate }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role ?? "read_only";
  const { data: profileImageUrl } = useProfileImage(user?.id);
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <aside className={cn(
      "flex shrink-0 flex-col bg-primary text-white transition-all duration-200 h-screen sticky top-0",
      collapsed ? "w-16" : "w-[260px]"
    )}>
      <div className={cn("pt-6 pb-2", collapsed ? "px-3 text-center" : "px-6")}>
        <span className={cn("font-bold tracking-tight", collapsed ? "text-[16px]" : "text-[22px]")}>
          {collapsed ? "B" : "eo ipso Boost"}
        </span>
      </div>

      {user && !collapsed && (
        <div className="mx-4 mb-4 rounded-lg bg-white/10 px-4 py-3 flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            {profileImageUrl ? (
              <AvatarImage src={profileImageUrl} alt="Profil" className="object-cover" />
            ) : (
              <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <p className="text-[14px] font-medium leading-tight truncate">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-[12px] font-medium text-white/60 mt-0.5">
              {roleLabels[user.role] ?? user.role}
            </p>
          </div>
        </div>
      )}

      {user && collapsed && (
        <div className="flex justify-center mb-3">
          <Avatar className="h-8 w-8">
            {profileImageUrl ? (
              <AvatarImage src={profileImageUrl} alt="Profil" className="object-cover" />
            ) : (
              <AvatarFallback className="bg-white/20 text-white text-[10px] font-semibold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
      )}

      <nav className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "px-1.5" : "px-3")}>
        {navSections.map((section, sIdx) => {
          const visibleItems = section.items.filter(item => hasPermission(role, item.module, "read"));
          if (visibleItems.length === 0) return null;
          return (
            <div key={sIdx}>
              {section.sectionLabel && !collapsed && (
                <p className="px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider text-[#C9CDF8] select-none">
                  {section.sectionLabel}
                </p>
              )}
              {collapsed && section.sectionLabel && (
                <div className="my-2 mx-2 border-t border-white/10" />
              )}
              {visibleItems.map((item) => {
                const active = isActive(item.path);
                const linkContent = (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={handleClick}
                    className={cn(
                      "flex items-center rounded-lg font-medium transition-colors",
                      collapsed
                        ? "justify-center p-2.5"
                        : "gap-3 px-4 py-2.5 text-[15px]",
                      active
                        ? "bg-white text-primary shadow-sm"
                        : "text-white/90 hover:bg-white/[0.08]"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return linkContent;
              })}
            </div>
          );
        })}
      </nav>

      <div className={cn("mt-auto border-t border-white/10 py-3 space-y-1", collapsed ? "px-1.5" : "px-3")}>
        {collapsed ? (
          <>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to="/settings"
                  onClick={handleClick}
                  className={cn(
                    "flex items-center justify-center rounded-lg p-2.5 font-medium transition-colors",
                    isActive("/settings")
                      ? "bg-white text-primary shadow-sm"
                      : "text-white/90 hover:bg-white/[0.08]"
                  )}
                >
                  <Settings className="h-[18px] w-[18px] shrink-0" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">Settings</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { handleClick(); logout(); }}
                  className="flex w-full items-center justify-center rounded-lg p-2.5 font-medium text-white/90 hover:bg-white/[0.08] transition-colors"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">Logout</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <NavLink
              to="/settings"
              onClick={handleClick}
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
              onClick={() => { handleClick(); logout(); }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium text-white/90 hover:bg-white/[0.08] transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span>Logout</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
