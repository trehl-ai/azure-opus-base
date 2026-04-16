import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthCallback] getSession error:", error);
        navigate("/login", { replace: true });
        return;
      }

      if (data.session) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (session) {
            subscription.unsubscribe();
            navigate("/dashboard", { replace: true });
          } else if (event === "SIGNED_OUT") {
            subscription.unsubscribe();
            navigate("/login", { replace: true });
          }
        }
      );

      setTimeout(() => {
        subscription.unsubscribe();
        navigate("/login", { replace: true });
      }, 5000);
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">Anmeldung wird abgeschlossen…</p>
      </div>
    </div>
  );
}
