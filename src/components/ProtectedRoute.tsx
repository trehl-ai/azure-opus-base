import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredModule?: string;
  requiredAction?: "read" | "write";
}

function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <ShieldOff className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Zugriff verweigert</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        Du hast keine Berechtigung, diesen Bereich zu sehen. Wende dich an deinen Administrator.
      </p>
      <Button onClick={() => navigate("/dashboard")}>Zurück zum Dashboard</Button>
    </div>
  );
}

export default function ProtectedRoute({ children, requiredRoles, requiredModule, requiredAction }: ProtectedRouteProps) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Role-based check
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <AccessDenied />;
  }

  // Permission-based check
  if (requiredModule && requiredAction && user && !hasPermission(user.role, requiredModule, requiredAction)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
