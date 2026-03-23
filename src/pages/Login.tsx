import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, LogIn } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        variant: "destructive",
        title: "Anmeldung fehlgeschlagen",
        description: error.message,
      });
    } else {
      navigate("/", { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Subtle background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.30] blur-sm scale-105 pointer-events-none"
        style={{ backgroundImage: "url('/images/login-bg.png')" }}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card/90 backdrop-blur-sm p-10 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-section-title text-primary font-bold">CRM</h1>
          <p className="mt-1 text-body text-muted-foreground">Anmelden</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-label text-foreground">
              E-Mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-label text-foreground">
              Passwort
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10"
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Wird angemeldet…" : "Anmelden"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/forgot-password"
            className="text-label text-primary hover:text-primary-hover transition-colors"
          >
            Passwort vergessen?
          </Link>
        </div>
      </div>
      <span className="absolute bottom-4 right-6 z-10 text-sm font-bold text-black">
        CRM by Tomas Schwirkmann
      </span>
    </div>
  );
}
