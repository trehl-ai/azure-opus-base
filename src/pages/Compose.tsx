import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmail, type EmailProvider } from "@/lib/email";
import { toast } from "sonner";
import {
  Mail, Send, Server, ChevronDown, Plus, X, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Provider / status metadata
// ---------------------------------------------------------------------------

const providerMeta: Record<string, { label: string; color: string }> = {
  resend: { label: "Plattform (Resend)", color: "bg-[hsl(var(--primary))] text-primary-foreground" },
  gmail: { label: "Google", color: "bg-[#EA4335] text-white" },
  outlook: { label: "Outlook", color: "bg-[#0078D4] text-white" },
};

const SENDABLE_STATUSES = new Set(["active"]);

const statusLabels: Record<string, { label: string; ok: boolean }> = {
  active: { label: "Aktiv", ok: true },
  pending: { label: "Ausstehend", ok: false },
  error: { label: "Fehler", ok: false },
  token_expired: { label: "Token abgelaufen", ok: false },
  disconnected: { label: "Getrennt", ok: false },
  inactive: { label: "Inaktiv", ok: false },
};

// ---------------------------------------------------------------------------
// Tag-Input for email addresses
// ---------------------------------------------------------------------------

function EmailTagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addEmail = (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-[44px] focus-within:ring-2 focus-within:ring-ring">
      {value.map((email) => (
        <Badge key={email} variant="secondary" className="gap-1 text-[13px] py-0.5">
          {email}
          <button
            type="button"
            onClick={() => onChange(value.filter((e) => e !== email))}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        className="flex-1 min-w-[140px] bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            e.preventDefault();
            addEmail(input);
          }
          if (e.key === "Backspace" && !input && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => input && addEmail(input)}
        placeholder={value.length ? "" : placeholder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compose Page
// ---------------------------------------------------------------------------

export default function ComposePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [selectedAccount, setSelectedAccount] = useState<string>("resend");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");

  // Load personal accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Group accounts by provider
  const gmailAccounts = useMemo(() => accounts.filter((a) => a.provider === "gmail"), [accounts]);
  const outlookAccounts = useMemo(() => accounts.filter((a) => a.provider === "outlook"), [accounts]);

  // Resolve selected account details
  const resolvedAccount = useMemo(() => {
    if (selectedAccount === "resend") {
      return { provider: "resend" as EmailProvider, account_id: undefined, status: "active", email: "noreply@ts-connect.cloud" };
    }
    const acct = accounts.find((a) => a.id === selectedAccount);
    if (!acct) return null;
    return { provider: acct.provider as EmailProvider, account_id: acct.id, status: acct.status, email: acct.email_address };
  }, [selectedAccount, accounts]);

  const canSend = resolvedAccount && SENDABLE_STATUSES.has(resolvedAccount.status) && to.length > 0 && subject.trim().length > 0 && bodyText.trim().length > 0;

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedAccount) throw new Error("Kein Konto ausgewählt.");

      return sendEmail({
        provider: resolvedAccount.provider,
        account_id: resolvedAccount.account_id,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        body_html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${bodyText.replace(/</g, "&lt;")}</pre>`,
        body_text: bodyText,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("E-Mail erfolgreich versendet!");
        // Reset form
        setTo([]);
        setCc([]);
        setBcc([]);
        setSubject("");
        setBodyText("");
        setShowCcBcc(false);
      } else {
        toast.error(result.error || "Versand fehlgeschlagen.");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Versand fehlgeschlagen.");
    },
  });

  const statusInfo = resolvedAccount ? statusLabels[resolvedAccount.status] : null;
  const isBlocked = resolvedAccount ? !SENDABLE_STATUSES.has(resolvedAccount.status) : false;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground">Neue E-Mail</h1>
          <p className="text-[14px] text-muted-foreground mt-0.5">Verfasse und versende eine E-Mail über einen deiner Kanäle.</p>
        </div>
      </div>

      {/* Compose card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 space-y-5">

          {/* Account selector */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Versandkonto</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="min-h-[44px] text-[14px]">
                <SelectValue placeholder="Konto wählen" />
              </SelectTrigger>
              <SelectContent>
                {/* Resend system */}
                <SelectGroup>
                  <SelectLabel className="text-[12px] text-muted-foreground">Plattform-Versand</SelectLabel>
                  <SelectItem value="resend">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      <span>Resend – noreply@ts-connect.cloud</span>
                      <Badge variant="outline" className="text-[10px] ml-1">System</Badge>
                    </div>
                  </SelectItem>
                </SelectGroup>

                {/* Gmail accounts */}
                {gmailAccounts.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[12px] text-muted-foreground">Google</SelectLabel>
                    {gmailAccounts.map((a) => {
                      const st = statusLabels[a.status] || statusLabels.active;
                      return (
                        <SelectItem key={a.id} value={a.id} disabled={!st.ok}>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-[#EA4335]" />
                            <span>{a.display_name || a.email_address}</span>
                            {!st.ok && (
                              <Badge variant="destructive" className="text-[10px] ml-1">{st.label}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}

                {/* Outlook accounts */}
                {outlookAccounts.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[12px] text-muted-foreground">Outlook</SelectLabel>
                    {outlookAccounts.map((a) => {
                      const st = statusLabels[a.status] || statusLabels.active;
                      return (
                        <SelectItem key={a.id} value={a.id} disabled={!st.ok}>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-[#0078D4]" />
                            <span>{a.display_name || a.email_address}</span>
                            {!st.ok && (
                              <Badge variant="destructive" className="text-[10px] ml-1">{st.label}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            {/* Status warning */}
            {isBlocked && statusInfo && (
              <div className="flex items-center gap-2 text-[13px] text-destructive mt-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Dieses Konto hat den Status „{statusInfo.label}" und kann aktuell nicht zum Versand genutzt werden.</span>
              </div>
            )}
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium">An</Label>
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-[12px] text-primary hover:underline"
                >
                  CC / BCC hinzufügen
                </button>
              )}
            </div>
            <EmailTagInput value={to} onChange={setTo} placeholder="empfaenger@example.com" />
          </div>

          {/* CC / BCC */}
          {showCcBcc && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium">CC</Label>
                <EmailTagInput value={cc} onChange={setCc} placeholder="cc@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium">BCC</Label>
                <EmailTagInput value={bcc} onChange={setBcc} placeholder="bcc@example.com" />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Betreff</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff der E-Mail"
              className="min-h-[44px] text-[14px]"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Nachricht</Label>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Deine Nachricht..."
              className="min-h-[200px] text-[14px] resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/30 rounded-b-xl">
          <p className="text-[12px] text-muted-foreground">
            Versand über: <span className="font-medium">{resolvedAccount?.email || "–"}</span>
          </p>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend || sendMutation.isPending}
            className="gap-2 min-h-[44px] px-6"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Senden
          </Button>
        </div>
      </div>
    </div>
  );
}
