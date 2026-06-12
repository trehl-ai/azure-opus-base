import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { extractReadableText } from "@/lib/emailUtils";

interface EmailHistoryProps {
  contactId?: string;
  dealId?: string;
}

type EmailActivity = {
  id: string;
  title: string | null;
  description: string | null;
  mail_entwurf: string | null;
  completed_at: string | null;
  created_at: string | null;
  deal_id: string | null;
  activity_type: string;
};

const ACTIVITY_FIELDS =
  "id, title, description, mail_entwurf, completed_at, created_at, deal_id, activity_type";

// Anzuzeigenden Mailtext bestimmen: ein sauberer Entwurf (mail_entwurf, z.B.
// versendete Kampagnen-Mails) ist bereits Klartext und gewinnt; sonst wird die
// description für email_reply / email aufbereitet.
function displayEmailText(email: EmailActivity): string {
  const draft = email.mail_entwurf?.trim();
  if (draft) return draft;
  const desc = email.description?.trim() || "";
  if (email.activity_type === "email_reply" || email.activity_type === "email") {
    return extractReadableText(desc);
  }
  return desc;
}

function EmailDetail({ email }: { email: EmailActivity }) {
  const timestamp = email.completed_at ?? email.created_at;
  const body = displayEmailText(email);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left pr-8">
          {email.title || "(Kein Betreff)"}
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            {timestamp && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Datum:</span>{" "}
                {format(new Date(timestamp), "dd.MM.yyyy HH:mm")}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            E-Mail
          </Badge>
        </div>

        {/* Kontext-Notiz (Empfänger/Workflow) nur zeigen, wenn der Mailtext aus
            mail_entwurf kommt und die description eine separate Notiz ist. */}
        {email.mail_entwurf?.trim() && email.description?.trim() && (
          <p className="text-xs text-muted-foreground">{email.description.trim()}</p>
        )}

        <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans mt-2 rounded-md border border-border bg-muted/30 p-4">
          {body || "(Kein Inhalt)"}
        </pre>
      </div>
    </>
  );
}

export function EmailHistory({ contactId, dealId }: EmailHistoryProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailActivity | null>(null);

  const { data: emails = [], isLoading } = useQuery<EmailActivity[]>({
    queryKey: ["email-history", contactId, dealId],
    queryFn: async () => {
      if (dealId) {
        const { data, error } = await (supabase as any)
          .from("deal_activities")
          .select(ACTIVITY_FIELDS)
          .eq("deal_id", dealId)
          .is("deleted_at", null)
          .eq("activity_type", "email")
          .order("completed_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as EmailActivity[];
      }

      if (contactId) {
        // deal_activities has no contact_id column — fetch only emails attached
        // to deals whose primary_contact_id is this contact.
        const { data: relatedDeals } = await (supabase as any)
          .from("deals")
          .select("id")
          .eq("primary_contact_id", contactId);

        if (relatedDeals?.length) {
          const dealIds = relatedDeals.map((d) => d.id);
          const { data: dealActs } = await (supabase as any)
            .from("deal_activities")
            .select(ACTIVITY_FIELDS)
            .in("deal_id", dealIds)
            .is("deleted_at", null)
            .eq("activity_type", "email")
            .order("completed_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(50);
          return (dealActs ?? []) as EmailActivity[];
        }
        return [];
      }

      return [];
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
    <>
      <div className="space-y-2">
        {emails.map((email) => {
          const timestamp = email.completed_at ?? email.created_at;
          const fullBody = displayEmailText(email);
          const preview = fullBody.slice(0, 150);

          return (
            <button
              type="button"
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className="w-full text-left rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {email.title || "(Kein Betreff)"}
                  </p>
                  {preview && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {preview}
                      {fullBody.length > preview.length ? "…" : ""}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  E-Mail
                </Badge>
              </div>

              {timestamp && (
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>{format(new Date(timestamp), "dd.MM.yyyy HH:mm")}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Sheet
        open={selectedEmail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedEmail && <EmailDetail key={selectedEmail.id} email={selectedEmail} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
