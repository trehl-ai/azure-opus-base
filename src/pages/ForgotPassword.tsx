import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-section-title text-primary font-bold">CRM</h1>
          <p className="mt-1 text-body text-muted-foreground">Passwort zurücksetzen</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <p className="text-body text-foreground">
              Falls ein Konto mit <strong>{email}</strong> existiert, wurde eine E-Mail zum Zurücksetzen gesendet.
            </p>
            <p className="text-label text-muted-foreground">
              Bitte prüfe dein Postfach und folge dem Link in der E-Mail.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-label text-foreground">
                E-Mail-Adresse
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird gesendet…" : "Link senden"}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-label text-primary hover:text-primary-hover transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
