import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Phone, Mail, FileText, CheckSquare, Calendar, Users, MessageSquare, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

// 1:1 aus Activities.tsx übernommen (Type-Icons + Farben).
const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  note: FileText,
  task: CheckSquare,
  meeting: Calendar,
  briefing: Users,
  casting: Users,
};
const ACTIVITY_COLORS: Record<string, string> = {
  call: "text-blue-500",
  email: "text-purple-500",
  note: "text-gray-500",
  task: "text-orange-500",
  meeting: "text-green-500",
  briefing: "text-pink-500",
  casting: "text-yellow-500",
};

export type ActivityDetail = {
  id: string;
  title: string;
  type: string | null;
  description: string | null;
  due_date: string | null;
  deal_id: string | null;
  deal_title: string | null;
  contact_id: string | null;
};

interface Props {
  activity: ActivityDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ContactRow = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null };

export function ActivityDetailSheet({ activity, open, onOpenChange }: Props) {
  const navigate = useNavigate();

  // Kontakt-Auflösung — IMMER session-supabase (RLS auth.uid()), NIE supabaseEIC.
  // Prio 1: activity.contact_id → contacts.
  // Prio 2: activity.deal_id → deals.primary_contact_id → contacts.
  const { data: contact } = useQuery<ContactRow | null>({
    queryKey: ["activity-contact", activity?.id, activity?.contact_id, activity?.deal_id],
    enabled: !!activity && open,
    queryFn: async () => {
      if (!activity) return null;
      if (activity.contact_id) {
        const { data } = await supabase
          .from("contacts")
          .select("first_name, last_name, email, phone")
          .eq("id", activity.contact_id)
          .maybeSingle();
        if (data) return data as ContactRow;
      }
      if (activity.deal_id) {
        const { data: deal } = await supabase
          .from("deals")
          .select("primary_contact_id")
          .eq("id", activity.deal_id)
          .maybeSingle();
        const pcid = (deal as { primary_contact_id: string | null } | null)?.primary_contact_id;
        if (pcid) {
          const { data } = await supabase
            .from("contacts")
            .select("first_name, last_name, email, phone")
            .eq("id", pcid)
            .maybeSingle();
          if (data) return data as ContactRow;
        }
      }
      return null;
    },
  });

  const type = activity?.type ?? "";
  const Icon = ACTIVITY_ICONS[type] || MessageSquare;
  const iconColor = ACTIVITY_COLORS[type] || "text-gray-400";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconColor}`} />
            <span>{activity?.title}</span>
          </SheetTitle>
        </SheetHeader>

        {activity && (
          <div className="mt-4 space-y-4">
            {/* Kontakt */}
            {contact && (
              <div className="rounded-md border p-3 space-y-1 mt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kontakt</p>
                <p className="text-sm font-semibold">{contact.first_name} {contact.last_name}</p>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline block">
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="text-sm text-muted-foreground hover:underline block">
                    {contact.phone}
                  </a>
                )}
              </div>
            )}

            {/* Beschreibung */}
            {activity.description && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notiz</p>
                <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
              </div>
            )}

            {/* Fällig */}
            {activity.due_date && (
              <p className="text-xs text-muted-foreground">
                Fällig: {format(parseISO(activity.due_date), "dd.MM.yyyy HH:mm", { locale: de })}
              </p>
            )}

            {/* Deal */}
            {activity.deal_id && (
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate(`/deals/${activity.deal_id}`)}
              >
                <span className="truncate">{activity.deal_title ?? "Deal öffnen"}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
