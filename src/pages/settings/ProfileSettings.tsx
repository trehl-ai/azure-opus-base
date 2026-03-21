import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface ProfileForm {
  first_name: string;
  last_name: string;
}

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  sales: "Sales",
  project_manager: "Projektmanager",
  management: "Management",
  read_only: "Nur Lesen",
};

export default function ProfileSettings() {
  const { user } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileForm>();

  useEffect(() => {
    if (user) {
      reset({ first_name: user.first_name, last_name: user.last_name });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return;
    const { error } = await supabase
      .from("users")
      .update({ first_name: data.first_name, last_name: data.last_name })
      .eq("id", user.id);

    if (error) {
      toast.error("Fehler: " + error.message);
    } else {
      toast.success("Profil aktualisiert");
    }
  };

  if (!user) return null;

  const initials = (user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "");

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Persönliche Daten</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname *</Label>
                <Input {...register("first_name", { required: "Pflichtfeld" })} />
                {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Nachname *</Label>
                <Input {...register("last_name", { required: "Pflichtfeld" })} />
                {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input value={user.email} disabled />
              <p className="text-xs text-muted-foreground">E-Mail kann nur vom Admin geändert werden</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Rolle</Label>
                <div><Badge variant="secondary">{roleLabels[user.role] ?? user.role}</Badge></div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Erstellt am</Label>
                <p className="text-sm">{format(new Date(user.created_at), "dd.MM.yyyy")}</p>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichern…" : "Speichern"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Avatar</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16 text-xl">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {initials.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm text-muted-foreground">Profilbild-Upload folgt in einer späteren Version</p>
        </CardContent>
      </Card>
    </div>
  );
}
