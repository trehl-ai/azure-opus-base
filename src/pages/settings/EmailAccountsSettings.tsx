import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Mail, Star, Trash2, Server, ShieldOff, CheckCircle2, XCircle, Info, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const {
    outlookAccount,
    connecting: connectingOutlook,
    error: outlookError,
    connect: connectOutlook,
    disconnect: disconnectOutlook,
  } = useMicrosoftAuth();

  // Check provider setup status
  const { data: providerStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["email-provider-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-email-provider-status");
      if (error) return { google: false, outlook: false, resend: false };
      return data as { google: boolean; outlook: boolean; resend: boolean };
    },
    staleTime: 60_000,
  });

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
      await supabase
        .from("email_accounts")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true);
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
      const { error } = await supabase.from("email_accounts").delete().eq("id", accountId);
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
    setConnectingGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-google-oauth");
      if (error || data?.error) {
        toast.error("Fehler beim Starten der Google-Verbindung.");
        return;
      }
      if (data?.auth_url) {
        const popup = window.open(data.auth_url, "google-oauth", "width=600,height=700,popup=yes");
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
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleConnectOutlook = async () => {
    try {
      await connectOutlook();
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Starten der Outlook-Verbindung.");
    }
  };

  const handleDisconnectOutlook = async () => {
    try {
      await disconnectOutlook();
      toast.success("Outlook-Konto getrennt");
    } catch {
      toast.error("Fehler beim Trennen des Outlook-Kontos");
    }
  };

  const googleReady = providerStatus?.google ?? false;
  const outlookReady = true;
  const resendReady = providerStatus?.resend ?? false;
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

      {/* Admin: Provider Setup Status */}
      {isAdmin && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-[16px]">Provider-Status (nur Admin)</CardTitle>
            <CardDescription className="text-[13px]">
              Übersicht der konfigurierten E-Mail-Provider. Fehlende Secrets müssen im Backend hinterlegt werden.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                <Loader2 className="h-4 w-4 animate-spin" /> Prüfe Konfiguration…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Google */}
                <div className={`rounded-lg border p-3 ${googleReady ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-4 w-4" />
                    <span className="text-[13px] font-semibold">Google / Gmail</span>
                    {googleReady
                      ? <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
                      : <XCircle className="h-4 w-4 text-destructive ml-auto" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {googleReady ? "Alle Secrets konfiguriert" : "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET oder EMAIL_TOKEN_ENCRYPTION_KEY fehlt"}
                  </p>
                </div>
                {/* Outlook (PKCE — keine Backend-Secrets nötig) */}
                <div className="rounded-lg border p-3 border-success/30 bg-success/5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Mail className="h-4 w-4 text-[#0078D4]" />
                    <span className="text-[13px] font-semibold">Outlook / Microsoft</span>
                    <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    PKCE-Flow (MSAL.js) — keine Backend-Secrets nötig
                  </p>
                </div>
                {/* Resend */}
                <div className={`rounded-lg border p-3 ${resendReady ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Server className="h-4 w-4 text-primary" />
                    <span className="text-[13px] font-semibold">Resend (Plattform)</span>
                    {resendReady
                      ? <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
                      : <XCircle className="h-4 w-4 text-destructive ml-auto" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {resendReady ? "RESEND_API_KEY konfiguriert" : "RESEND_API_KEY fehlt"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          </p>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold text-foreground">Persönliche Konten</h3>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleConnectGoogle}
                      disabled={!googleReady || connectingGoogle || statusLoading}
                      className="gap-1.5"
                    >
                      {connectingGoogle
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-4 w-4" />}
                      Google verbinden
                    </Button>
                  </span>
                </TooltipTrigger>
                {!googleReady && !statusLoading && (
                  <TooltipContent>
                    <p className="text-[12px] max-w-[250px]">
                      {isAdmin
                        ? "Google OAuth ist noch nicht konfiguriert. Bitte hinterlege GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET und EMAIL_TOKEN_ENCRYPTION_KEY als Backend-Secrets."
                        : "Dieser Provider wurde von deinem Administrator noch nicht eingerichtet."}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            {!outlookAccount && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectOutlook}
                disabled={connectingOutlook}
                className="gap-1.5"
              >
                {connectingOutlook
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Mail className="h-4 w-4 text-[#0078D4]" />}
                Outlook verbinden
              </Button>
            )}
          </div>
        </div>

        {/* Outlook (MSAL PKCE) — verbundenes Konto */}
        {outlookAccount && (
          <Card className="mb-4 border-[#0078D4]/30 bg-[#0078D4]/[0.03]">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0078D4] text-white">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[14px] truncate">
                    {outlookAccount.displayName || outlookAccount.email}
                  </span>
                  <Badge variant="outline" className="text-[11px] bg-[#0078D4] text-white border-0">
                    Outlook
                  </Badge>
                  <Badge variant="default" className="text-[11px]">
                    Aktiv
                  </Badge>
                </div>
                <p className="text-[13px] text-green-600 truncate mt-0.5">
                  {outlookAccount.email}
                </p>
                {outlookError && (
                  <p className="text-[12px] text-destructive mt-1">{outlookError}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnectOutlook}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Trennen
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info for non-admin when both unavailable */}
        {!isAdmin && !googleReady && !outlookReady && !statusLoading && (
          <Card className="mb-4 border-muted">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-foreground">E-Mail-Provider noch nicht verfügbar</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Die E-Mail-Integration (Google / Outlook) wurde von deinem Administrator noch nicht eingerichtet.
                  Sobald die Konfiguration abgeschlossen ist, kannst du hier dein Konto verbinden.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                {googleReady || outlookReady
                  ? "Verbinde dein Google- oder Outlook-Konto, um E-Mails direkt aus BOOST zu versenden."
                  : isAdmin
                    ? "Konfiguriere zuerst die Provider-Secrets, um die Verbindung zu ermöglichen."
                    : "Dein Administrator muss zuerst die E-Mail-Provider einrichten."}
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
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
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
                          <span className="ml-3">Verbunden seit {format(new Date(account.created_at), "dd.MM.yyyy")}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!account.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(account.id)}
                          disabled={setDefaultMutation.isPending}
                          className="text-[13px] gap-1"
                        >
                          <Star className="h-3.5 w-3.5" /> Standard
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
