import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface EmailHistoryProps {
  contactId?: string;
  dealId?: string;
}

type EmailActivity = {
  id: string;
  title: string | null;
  description: string | null;
  completed_at: string | null;
  created_at: string | null;
  auto_generated: boolean | null;
  metadata: Record<string, unknown> | null;
  contact_id: string | null;
  deal_id: string | null;
  activity_type: string;
};

const ACTIVITY_FIELDS =
  "id, title, description, completed_at, created_at, auto_generated, metadata, contact_id, deal_id, activity_type";

function senderOf(email: EmailActivity): string {
  const inbound = email.auto_generated === true;
  const meta = (email.metadata ?? {}) as Record<string, unknown>;
  const sender = typeof meta.sender_email === "string" ? meta.sender_email : null;
  return inbound ? sender ?? "Eingehend" : "Ausgehend";
}

export function EmailHistory({ contactId, dealId }: EmailHistoryProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailActivity | null>(null);

  const { data: emails = [], isLoading } = useQuery<EmailActivity[]>({
    queryKey: ["email-history", contactId, dealId],
    queryFn: async () => {
      if (dealId) {
        const { data, error } = await supabase
          .from("deal_activities")
          .select(ACTIVITY_FIELDS)
          .eq("deal_id", dealId)
          .in("activity_type", ["email", "email_sent"])
          .order("completed_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as EmailActivity[];
      }

      if (contactId) {
        const { data: directActs, error: e1 } = await supabase
          .from("deal_activities")
          .select(ACTIVITY_FIELDS)
          .eq("contact_id", contactId)
          .in("activity_type", ["email", "email_sent"])
          .order("completed_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(50);
        if (e1) throw e1;

        // Pull emails attached only to a deal whose primary_contact_id is this contact
        const { data: relatedDeals } = await supabase
          .from("deals")
          .select("id")
          .eq("primary_contact_id", contactId);

        let merged: EmailActivity[] = (directActs ?? []) as EmailActivity[];

        if (relatedDeals?.length) {
          const dealIds = relatedDeals.map((d) => d.id);
          const { data: dealActs } = await supabase
            .from("deal_activities")
            .select(ACTIVITY_FIELDS)
            .in("deal_id", dealIds)
            .in("activity_type", ["email", "email_sent"])
            .is("contact_id", null)
            .order("completed_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(100);

          if (dealActs?.length) {
            const seen = new Set(merged.map((a) => a.id));
            for (const a of dealActs as EmailActivity[]) {
              if (!seen.has(a.id)) {
                merged.push(a);
                seen.add(a.id);
              }
            }
            merged.sort((a, b) => {
              const ta = new Date(a.completed_at ?? a.created_at ?? 0).getTime();
              const tb = new Date(b.completed_at ?? b.created_at ?? 0).getTime();
              return tb - ta;
            });
            merged = merged.slice(0, 50);
          }
        }

        return merged;
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
          const inbound = email.auto_generated === true;
          const fromLabel = senderOf(email);
          const timestamp = email.completed_at ?? email.created_at;
          const preview = (email.description ?? "").trim().slice(0, 150);

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
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Von: {fromLabel}
                  </p>
                  {preview && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {preview}
                      {(email.description ?? "").length > preview.length ? "…" : ""}
                    </p>
                  )}
                </div>
                <Badge
                  variant={inbound ? "default" : "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {inbound ? "Eingehend" : "Ausgehend"}
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
          {selectedEmail && (() => {
            const inbound = selectedEmail.auto_generated === true;
            const fromLabel = senderOf(selectedEmail);
            const timestamp = selectedEmail.completed_at ?? selectedEmail.created_at;

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left pr-8">
                    {selectedEmail.title || "(Kein Betreff)"}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Von:</span> {fromLabel}
                      </p>
                      {timestamp && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Datum:</span>{" "}
                          {format(new Date(timestamp), "dd.MM.yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                    <Badge variant={inbound ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {inbound ? "Eingehend" : "Ausgehend"}
                    </Badge>
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words">
                    {selectedEmail.description?.trim() || "(Kein Inhalt)"}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}
