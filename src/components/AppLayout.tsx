import { ReactNode, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: ReactNode;
}

const routeNames: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contacts": "Contacts",
  "/companies": "Companies",
  "/deals": "Deals",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/import": "Import",
  "/intake": "Intake",
  "/settings": "Einstellungen",
};

function getPageName(pathname: string): string {
  if (routeNames[pathname]) return routeNames[pathname];
  for (const [route, name] of Object.entries(routeNames)) {
    if (pathname.startsWith(route)) return name;
  }
  return "BOOST";
}

// Custom hook for breakpoints: mobile < 768, tablet 768-1024, desktop > 1024
function useBreakpoint() {
  const [bp, setBp] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 768) setBp("mobile");
      else if (w <= 1024) setBp("tablet");
      else setBp("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return bp;
}

export default function AppLayout({ children }: AppLayoutProps) {
  useRealtimeSync();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";
  const showTopHeader = isMobile || isTablet;
  const pageName = getPageName(location.pathname);

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <AppSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      ) : (
        <AppSidebar collapsed={isTablet} />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header for mobile/tablet */}
        {showTopHeader && (
          <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Menü öffnen"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>

            <span className="flex-1 text-center text-[16px] font-semibold text-foreground">
              {pageName}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
                  <User className="mr-2 h-4 w-4" /> Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
        )}

        <main className={cn(
          "flex-1 overflow-y-auto bg-background",
          isMobile ? "p-4" : isTablet ? "p-6" : "p-6 lg:p-8"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
