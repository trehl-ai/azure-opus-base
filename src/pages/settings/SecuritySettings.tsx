import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function SecuritySettings() {
  const { logout } = useAuth();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<PasswordForm>();
  const newPassword = watch("new_password");

  const onSubmit = async (data: PasswordForm) => {
    const { error } = await supabase.auth.updateUser({ password: data.new_password });
    if (error) {
      toast.error("Fehler: " + error.message);
    } else {
      toast.success("Passwort erfolgreich geändert");
      reset();
    }
  };

  const handleGlobalSignOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Aus allen Geräten abgemeldet");
    logout();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Aktuelles Passwort</Label>
              <Input type="password" {...register("current_password", { required: "Pflichtfeld" })} />
              {errors.current_password && <p className="text-sm text-destructive">{errors.current_password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input type="password" {...register("new_password", { required: "Pflichtfeld", minLength: { value: 8, message: "Mindestens 8 Zeichen" } })} />
              {errors.new_password && <p className="text-sm text-destructive">{errors.new_password.message}</p>}
              <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen</p>
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort bestätigen</Label>
              <Input type="password" {...register("confirm_password", {
                required: "Pflichtfeld",
                validate: v => v === newPassword || "Passwörter stimmen nicht überein"
              })} />
              {errors.confirm_password && <p className="text-sm text-destructive">{errors.confirm_password.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichern…" : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Aktive Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Für erweiterte Session-Verwaltung nutze den Lovable Cloud Auth-Bereich.
          </p>
          <Button variant="destructive" onClick={handleGlobalSignOut} className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Aus allen Geräten abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
