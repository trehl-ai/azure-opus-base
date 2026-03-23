import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Gesendet", variant: "default" },
  draft: { label: "Entwurf", variant: "secondary" },
  failed: { label: "Fehlgeschlagen", variant: "destructive" },
  pending: { label: "Ausstehend", variant: "outline" },
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
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>Von: {email.from_email}</span>
              <span>
                {email.sent_at
                  ? format(new Date(email.sent_at), "dd.MM.yyyy HH:mm")
                  : format(new Date(email.created_at), "dd.MM.yyyy HH:mm")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
