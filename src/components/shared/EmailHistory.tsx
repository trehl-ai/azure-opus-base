import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Paperclip, Download } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Gesendet", variant: "default" },
  draft: { label: "Entwurf", variant: "secondary" },
  failed: { label: "Fehlgeschlagen", variant: "destructive" },
  pending: { label: "Ausstehend", variant: "outline" },
  queued: { label: "In Warteschlange", variant: "outline" },
};

const providerLabels: Record<string, string> = {
  resend: "Plattform",
  gmail: "Gmail",
  outlook: "Outlook",
};

interface EmailHistoryProps {
  contactId?: string;
  dealId?: string;
}

export function EmailHistory({ contactId, dealId }: EmailHistoryProps) {
  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["email-history", contactId, dealId],
    queryFn: async () => {
      let query = supabase
        .from("email_messages")
        .select("id, subject, to_email, from_email, provider, status, sent_at, created_at, body_text")
        .order("created_at", { ascending: false });

      if (dealId) {
        query = query.eq("deal_id", dealId);
      } else if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!(contactId || dealId),
  });

  // Load attachments for all displayed emails
  const emailIds = emails.map((e) => e.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ["email-attachments", emailIds],
    queryFn: async () => {
      if (!emailIds.length) return [];
      const { data, error } = await supabase
        .from("email_attachments")
        .select("id, email_message_id, file_name, file_path, file_type, file_size")
        .in("email_message_id", emailIds);
      if (error) throw error;
      return data;
    },
    enabled: emailIds.length > 0,
  });

  const attachmentsByEmail = attachments.reduce<Record<string, typeof attachments>>((acc, a) => {
    if (!acc[a.email_message_id]) acc[a.email_message_id] = [];
    acc[a.email_message_id].push(a);
    return acc;
  }, {});

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("email-attachments")
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Mail className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Noch keine E-Mails zugeordnet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => {
        const st = statusLabels[email.status] ?? statusLabels.draft;
        const preview = email.body_text?.slice(0, 120) || "";
        const emailAttachments = attachmentsByEmail[email.id] || [];

        return (
          <div
            key={email.id}
            className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {email.subject || "(Kein Betreff)"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  An: {(email.to_email as string[])?.join(", ") || "–"}
                </p>
                {preview && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}…</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {providerLabels[email.provider] ?? email.provider}
                </span>
              </div>
            </div>

            {/* Attachments */}
            {emailAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {emailAttachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => handleDownload(att.file_path, att.file_name)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{att.file_name}</span>
                    <Download className="h-2.5 w-2.5 ml-0.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>Von: {email.from_email}</span>
              <span>
                {email.sent_at
                  ? format(new Date(email.sent_at), "dd.MM.yyyy HH:mm")
                  : format(new Date(email.created_at), "dd.MM.yyyy HH:mm")}
              </span>
              {emailAttachments.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <Paperclip className="h-3 w-3" />
                  {emailAttachments.length}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
