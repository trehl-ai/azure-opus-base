import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmail, type EmailProvider } from "@/lib/email";
import { loadUserSignature } from "@/lib/signature";
import { toast } from "sonner";
import {
  Mail, Send, Server, ChevronDown, Plus, X, AlertCircle, Loader2, User, Briefcase,
  Paperclip, FileText, FileSpreadsheet, Image, File, Upload, Trash2,
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
import { EntitySearchSelect } from "@/components/shared/EntitySearchSelect";
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
// File attachment config
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB total

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (type.includes("spreadsheet") || type.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (type.includes("word") || type === "application/msword") return <FileText className="h-4 w-4 text-blue-600" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return `"${file.name}" hat einen nicht unterstützten Dateityp. Erlaubt: PDF, Word, Excel, Bilder (PNG/JPG), TXT.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" ist zu groß (${formatFileSize(file.size)}). Maximal ${formatFileSize(MAX_FILE_SIZE)} pro Datei.`;
  }
  return null;
}

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
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedAccount, setSelectedAccount] = useState<string>("resend");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState<string | null>(null);
  const [useSignature, setUseSignature] = useState(true);

  // Load user signature
  useEffect(() => {
    loadUserSignature().then((sig) => {
      if (sig?.html) setSignatureHtml(sig.html);
    });
  }, []);

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

  const totalAttachmentSize = useMemo(() => attachments.reduce((sum, f) => sum + f.size, 0), [attachments]);
  const canSend = resolvedAccount && SENDABLE_STATUSES.has(resolvedAccount.status) && to.length > 0 && subject.trim().length > 0 && bodyText.trim().length > 0 && totalAttachmentSize <= MAX_TOTAL_SIZE;

  // Handle deal selection – auto-link contact
  const handleDealChange = (id: string | null, deal?: any) => {
    setDealId(id);
    if (deal?.primary_contact_id && !contactId) {
      setContactId(deal.primary_contact_id);
    }
  };

  // File handling
  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const error = isAllowedFile(file);
      if (error) {
        errors.push(error);
      } else if (attachments.some((a) => a.name === file.name && a.size === file.size)) {
        // skip duplicates
      } else {
        newFiles.push(file);
      }
    });

    if (errors.length) {
      errors.forEach((e) => toast.error(e));
    }

    const combined = [...attachments, ...newFiles];
    const totalSize = combined.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      toast.error(`Gesamtgröße überschreitet ${formatFileSize(MAX_TOTAL_SIZE)}. Bitte entferne einige Dateien.`);
      return;
    }

    setAttachments(combined);
  }, [attachments]);

  const removeFile = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // Upload files to storage and return paths
  const uploadAttachments = async (): Promise<{ file_name: string; file_path: string; file_type: string; file_size: number }[]> => {
    if (!attachments.length) return [];

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error("Nicht angemeldet");

    const results = [];
    for (const file of attachments) {
      const filePath = `${authUser.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("email-attachments")
        .upload(filePath, file, { contentType: file.type });

      if (error) throw new Error(`Upload fehlgeschlagen für "${file.name}": ${error.message}`);

      results.push({
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      });
    }
    return results;
  };

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedAccount) throw new Error("Kein Konto ausgewählt.");

      // 1. Upload attachments to storage
      const uploadedFiles = await uploadAttachments();

      // 2. Convert attachments to base64 for sending
      const attachmentPayloads: { filename: string; content: string; type: string }[] = [];
      for (const file of attachments) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        attachmentPayloads.push({
          filename: file.name,
          content: base64,
          type: file.type,
        });
      }

      // 3. Build body with signature
      const bodyHtmlContent = `<pre style="font-family:sans-serif;white-space:pre-wrap">${bodyText.replace(/</g, "&lt;")}</pre>`;
      const fullBodyHtml = useSignature && signatureHtml
        ? `${bodyHtmlContent}\n${signatureHtml}`
        : bodyHtmlContent;

      // 4. Send email
      const result = await sendEmail({
        provider: resolvedAccount.provider,
        account_id: resolvedAccount.account_id,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        body_html: fullBodyHtml,
        body_text: bodyText,
        contact_id: contactId || undefined,
        deal_id: dealId || undefined,
        attachments: attachmentPayloads.length ? attachmentPayloads : undefined,
      });

      // 4. Save attachment records if email was sent
      if (result.success && result.message_id && uploadedFiles.length) {
        const { data: publicUserIdData } = await supabase.rpc("get_public_user_id", {
          _auth_user_id: (await supabase.auth.getUser()).data.user!.id,
        });

        if (publicUserIdData) {
          await supabase.from("email_attachments").insert(
            uploadedFiles.map((f) => ({
              email_message_id: result.message_id!,
              user_id: publicUserIdData as string,
              file_name: f.file_name,
              file_path: f.file_path,
              file_type: f.file_type,
              file_size: f.file_size,
            }))
          );
        }
      }

      return result;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("E-Mail erfolgreich versendet!");
        qc.invalidateQueries({ queryKey: ["email-history"] });
        setTo([]);
        setCc([]);
        setBcc([]);
        setSubject("");
        setBodyText("");
        setShowCcBcc(false);
        setContactId(null);
        setDealId(null);
        setAttachments([]);
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

            {isBlocked && statusInfo && (
              <div className="flex items-center gap-2 text-[13px] text-destructive mt-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Dieses Konto hat den Status „{statusInfo.label}" und kann aktuell nicht zum Versand genutzt werden.</span>
              </div>
            )}
          </div>

          {/* CRM Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Contact zuordnen
              </Label>
              <EntitySearchSelect
                entityType="contact"
                value={contactId}
                onChange={(id) => setContactId(id)}
                placeholder="Contact suchen…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                Deal zuordnen
              </Label>
              <EntitySearchSelect
                entityType="deal"
                value={dealId}
                onChange={handleDealChange}
                placeholder="Deal suchen…"
              />
            </div>
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

          {/* Attachments */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              Anhänge
            </Label>

            {/* Drop zone */}
            <div
              className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-1.5 py-5 text-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">
                  Dateien hierher ziehen oder <span className="text-primary font-medium">auswählen</span>
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  PDF, Word, Excel, Bilder (PNG/JPG), TXT – max. {formatFileSize(MAX_FILE_SIZE)} pro Datei
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* File list */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  {attachments.length} {attachments.length === 1 ? "Datei" : "Dateien"} · {formatFileSize(totalAttachmentSize)} gesamt
                  {totalAttachmentSize > MAX_TOTAL_SIZE && (
                    <span className="text-destructive ml-1">(max. {formatFileSize(MAX_TOTAL_SIZE)})</span>
                  )}
                </p>
              </div>
            )}
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
