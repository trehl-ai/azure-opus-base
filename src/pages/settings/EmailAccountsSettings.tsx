import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "sonner";
import { format } from "date-fns";
import { Mail, Plus, Star, Trash2, ExternalLink, Server, ShieldOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const providerMeta: Record<string, { label: string; color: string; icon: typeof Mail }> = {
  resend: { label: "Resend", color: "bg-[#3B45F1] text-white", icon: Server },
  gmail: { label: "Google", color: "bg-[#EA4335] text-white", icon: Mail },
  outlook: { label: "Outlook", color: "bg-[#0078D4] text-white", icon: Mail },
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Aktiv", variant: "default" },
  pending: { label: "Ausstehend", variant: "outline" },
  error: { label: "Fehler", variant: "destructive" },
  token_expired: { label: "Token abgelaufen", variant: "destructive" },
  disconnected: { label: "Getrennt", variant: "secondary" },
  inactive: { label: "Inaktiv", variant: "secondary" },
};

export default function EmailAccountsSettings() {
  const { user } = useAuth();
  const { role } = usePermission();
  const queryClient = useQueryClient();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);

  // Block non-authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <ShieldOff className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Zugriff verweigert</h2>
        <p className="text-muted-foreground">Du musst eingeloggt sein, um E-Mail-Konten zu verwalten.</p>
      </div>
    );
  }

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (accountId: string) => {
      // Remove current default
      await supabase
        .from("email_accounts")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true);
      // Set new default
      const { error } = await supabase
        .from("email_accounts")
        .update({ is_default: true })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      toast.success("Standard-Absender aktualisiert");
    },
    onError: () => toast.error("Fehler beim Setzen des Standard-Absenders"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("email_accounts")
        .delete()
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      toast.success("Konto getrennt");
      setDisconnectId(null);
    },
    onError: () => toast.error("Fehler beim Trennen des Kontos"),
  });

  const handleConnectGoogle = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("start-google-oauth");

      if (error) {
        toast.error("Fehler beim Starten der Google-Verbindung.");
        return;
      }

      if (data?.error) {
        // Secret guard triggered
        toast.error(data.details || data.error);
        return;
      }

      if (data?.auth_url) {
        // Open OAuth popup
        const popup = window.open(data.auth_url, "google-oauth", "width=600,height=700,popup=yes");

        // Listen for success message from callback
        const handler = (event: MessageEvent) => {
          if (event.data?.type === "google-oauth-success") {
            window.removeEventListener("message", handler);
            queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
            toast.success("Google-Konto erfolgreich verbunden!");
            popup?.close();
          }
        };
        window.addEventListener("message", handler);
      }
    } catch {
      toast.error("Fehler beim Starten der Google-Verbindung.");
    }
  };

  const handleConnectOutlook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("start-outlook-oauth");

      if (error) {
        toast.error("Fehler beim Starten der Outlook-Verbindung.");
        return;
      }

      if (data?.error) {
        toast.error(data.details || data.error);
        return;
      }

      if (data?.auth_url) {
        const popup = window.open(data.auth_url, "outlook-oauth", "width=600,height=700,popup=yes");

        const handler = (event: MessageEvent) => {
          if (event.data?.type === "outlook-oauth-success") {
            window.removeEventListener("message", handler);
            queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
            toast.success("Outlook-Konto erfolgreich verbunden!");
            popup?.close();
          }
        };
        window.addEventListener("message", handler);
      }
    } catch {
      toast.error("Fehler beim Starten der Outlook-Verbindung.");
    }
  };

  const disconnectAccount = accounts.find((a) => a.id === disconnectId);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">E-Mail-Konten</h2>
        <p className="text-[14px] text-muted-foreground mt-1">
          Verwalte deine E-Mail-Versandkonten und verbinde weitere Provider.
        </p>
      </div>

      {/* System / Resend card */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3B45F1] text-white">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-[16px]">Plattform-Versand (Resend)</CardTitle>
                <CardDescription className="text-[13px]">
                  Systemmails &amp; Benachrichtigungen über ts-connect.cloud
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-[#22C55E] text-white hover:bg-[#22C55E]/90">Aktiv</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
            <div>
              <span className="text-muted-foreground">Absender</span>
              <p className="font-medium mt-0.5">noreply@ts-connect.cloud</p>
            </div>
            <div>
              <span className="text-muted-foreground">Typ</span>
              <p className="font-medium mt-0.5">System / Transaktional</p>
            </div>
            <div>
              <span className="text-muted-foreground">Domain</span>
              <p className="font-medium mt-0.5">ts-connect.cloud</p>
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground mt-4 leading-relaxed">
            Dieser Kanal wird für automatische E-Mails, Einladungen und Benachrichtigungen verwendet.
            Er ist kein persönliches Postfach und kann nicht für den individuellen Versand konfiguriert werden.
          </p>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold text-foreground">Persönliche Konten</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleConnectGoogle} className="gap-1.5">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-4 w-4" />
              Google verbinden
            </Button>
            <Button variant="outline" size="sm" onClick={handleConnectOutlook} className="gap-1.5">
              <Mail className="h-4 w-4 text-[#0078D4]" />
              Outlook verbinden
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Mail className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-[14px] text-muted-foreground">
                Noch keine persönlichen E-Mail-Konten verbunden.
              </p>
              <p className="text-[13px] text-muted-foreground max-w-md">
                Verbinde dein Google- oder Outlook-Konto, um E-Mails direkt aus dem CRM zu versenden.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const meta = providerMeta[account.provider] || providerMeta.resend;
              const status = statusLabels[account.status] || statusLabels.active;
              const Icon = meta.icon;

              return (
                <Card key={account.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 py-4">
                    {/* Provider icon */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[14px] truncate">
                          {account.display_name || account.email_address}
                        </span>
                        <Badge variant="outline" className={`text-[11px] ${meta.color} border-0`}>
                          {meta.label}
                        </Badge>
                        <Badge variant={status.variant} className="text-[11px]">
                          {status.label}
                        </Badge>
                        {account.is_default && (
                          <Badge className="bg-[#F59E0B] text-white text-[11px] hover:bg-[#F59E0B]/90 gap-1">
                            <Star className="h-3 w-3" /> Standard
                          </Badge>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                        {account.email_address}
                        {account.created_at && (
                          <span className="ml-3">
                            Verbunden seit {format(new Date(account.created_at), "dd.MM.yyyy")}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!account.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(account.id)}
                          disabled={setDefaultMutation.isPending}
                          className="text-[13px] gap-1"
                        >
                          <Star className="h-3.5 w-3.5" />
                          Standard
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDisconnectId(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Setup guide for non-production */}
      <Card className="border-amber-300/50 bg-amber-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-[14px] text-amber-900">Einrichtung – OAuth-Provider</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 text-[13px] text-amber-900/80 leading-relaxed">
          <p>
            Damit Google- und Outlook-Konten verbunden werden können, müssen folgende Secrets
            im Backend konfiguriert sein:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 bg-white/60 p-3 space-y-1">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-3.5 w-3.5" />
                Google / Gmail
              </p>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                <li><code className="bg-amber-100 px-1 rounded text-[11px]">GOOGLE_CLIENT_ID</code></li>
                <li><code className="bg-amber-100 px-1 rounded text-[11px]">GOOGLE_CLIENT_SECRET</code></li>
                <li><code className="bg-amber-100 px-1 rounded text-[11px]">EMAIL_TOKEN_ENCRYPTION_KEY</code></li>
              </ul>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/60 p-3 space-y-1">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#0078D4]" />
                Outlook / Microsoft 365
              </p>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                <li><code className="bg-amber-100 px-1 rounded text-[11px]">MICROSOFT_CLIENT_ID</code></li>
                <li><code className="bg-amber-100 px-1 rounded text-[11px]">MICROSOFT_CLIENT_SECRET</code></li>
                <li><code className="bg-amber-100 px-1 rounded text-[11px]">EMAIL_TOKEN_ENCRYPTION_KEY</code></li>
              </ul>
            </div>
          </div>
          <p className="text-[12px]">
            Solange diese nicht gesetzt sind, zeigen die Verbindungs-Buttons eine entsprechende Meldung.
            Der Plattform-Versand (Resend) funktioniert unabhängig davon.
          </p>
        </CardContent>
      </Card>

      {/* Info box */}
      <div className="rounded-xl bg-[hsl(var(--primary)/0.06)] border border-primary/10 p-4">
        <p className="text-[13px] text-foreground leading-relaxed">
          <strong>Hinweis:</strong> Persönliche E-Mail-Konten ermöglichen dir den Versand direkt aus deinem
          Postfach. Der Plattform-Versand (Resend) wird unabhängig davon für Systemmails und
          Benachrichtigungen verwendet.
        </p>
      </div>

      {/* Disconnect dialog */}
      <AlertDialog open={!!disconnectId} onOpenChange={(open) => !open && setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konto trennen</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du{" "}
              <strong>{disconnectAccount?.email_address}</strong>{" "}
              trennen möchtest? Du kannst es jederzeit wieder verbinden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => disconnectId && disconnectMutation.mutate(disconnectId)}
            >
              Trennen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
