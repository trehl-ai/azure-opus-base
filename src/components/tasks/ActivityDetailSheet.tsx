import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Phone, Mail, FileText, CheckSquare, Calendar, Users, MessageSquare, ExternalLink, CheckCircle, Plus, Pencil, Reply, MousePointerClick } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
import { AddActivityDialog } from "@/components/deals/AddActivityDialog";
import { EditActivitySheet } from "@/components/activities/EditActivitySheet";

type DealActivity = Database["public"]["Tables"]["deal_activities"]["Row"];

// Type-Icons + Farben — synchron zur Tasks-Liste (Tasks.tsx).
const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  note: FileText,
  task: CheckSquare,
  meeting: Calendar,
  briefing: Users,
  casting: Users,
  email_reply: Reply,
  link_click: MousePointerClick,
};
const ACTIVITY_COLORS: Record<string, string> = {
  call: "text-blue-500",
  email: "text-orange-500",
  note: "text-gray-400",
  task: "text-green-500",
  meeting: "text-purple-500",
  briefing: "text-pink-500",
  casting: "text-yellow-500",
  email_reply: "text-orange-400",
  link_click: "text-gray-400",
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
  status: string;
  created_by_user_id: string | null;
  source?: "activity" | "task";
};

interface Props {
  activity: ActivityDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ContactRow = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null };

export function ActivityDetailSheet({ activity, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { canManageAllTasks } = useUserRole();
  // deal_activities update/delete: RLS = can_manage_all_tasks() OR created_by_user_id = auth.uid().
  // Bearbeiten oeffnet EditActivitySheet (Edit + Delete) → ein Gate deckt beides ab.
  const canEditActivity = !!activity && (canManageAllTasks || activity.created_by_user_id === user?.id);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Aktivität als erledigt markieren — session-supabase (RLS), gleiches
  // invalidate-Key wie die Tasks-Liste (["open-activities"]), dann Sheet schließen.
  const handleMarkDone = async () => {
    if (!activity) return;
    setIsUpdating(true);
    const { error } = await (supabase as any)
      .from("deal_activities")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", activity.id);
    setIsUpdating(false);
    if (error) return;
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["open-activities"] });
  };

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

  // Task-Panel (source:"task"): Kontakt/Firma NUR aus description/title geparst und
  // direkt gesucht — verknüpfungs-UNABHÄNGIG. company_contacts wird bewusst NICHT
  // genutzt (Flow 1 legt die Verknüpfung bei neuen Karten nicht an → wäre demo-unsicher).
  const isTask = activity?.source === "task";
  const parsed = useMemo(() => {
    const desc = activity?.description ?? "";
    const email = desc.match(/Email:\s*([^\s|]+@[^\s|]+)/i)?.[1]?.trim() ?? null;
    const company = desc.match(/Firma:\s*(.+?)\s*(?:\||\n|$)/i)?.[1]?.trim() ?? null;
    // Titel-Fallback: "…ergänzen: <Vor Nach>"
    const name = activity?.title?.match(/ergänzen:\s*(.+)$/i)?.[1]?.trim() ?? null;
    return { email, company, name };
  }, [activity?.description, activity?.title]);

  const { data: taskLinks } = useQuery({
    queryKey: ["task-links", activity?.id, parsed.email, parsed.company, parsed.name],
    enabled: !!activity && open && isTask,
    queryFn: async () => {
      // KONTAKT: exakte Email (Prio 1), sonst Titel-Name per ILIKE (Prio 2). Soft-delete-aware.
      let contact: { id: string; first_name: string | null; last_name: string | null } | null = null;
      if (parsed.email) {
        const { data } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("email", parsed.email)
          .is("deleted_at", null)
          .limit(1);
        contact = (data?.[0] as typeof contact) ?? null;
      }
      if (!contact && parsed.name) {
        const [first, ...rest] = parsed.name.split(/\s+/);
        const last = rest.join(" ");
        let q = supabase.from("contacts").select("id, first_name, last_name").is("deleted_at", null);
        if (first) q = q.ilike("first_name", `%${first}%`);
        if (last) q = q.ilike("last_name", `%${last}%`);
        const { data } = await q.limit(1);
        contact = (data?.[0] as typeof contact) ?? null;
      }
      // FIRMA: "Firma: <name>" direkt gegen companies (ILIKE, soft-delete-aware).
      let company: { id: string; name: string } | null = null;
      if (parsed.company) {
        const { data } = await supabase
          .from("companies")
          .select("id, name")
          .ilike("name", parsed.company)
          .is("deleted_at", null)
          .limit(1);
        company = (data?.[0] as typeof company) ?? null;
      }
      return { contact, company };
    },
  });

  const goTo = (path: string) => { onOpenChange(false); navigate(path); };

  const type = activity?.type ?? "";
  const Icon = ACTIVITY_ICONS[type] || MessageSquare;
  const iconColor = ACTIVITY_COLORS[type] || "text-gray-400";

  // EditActivitySheet erwartet eine deal_activities-Row; es liest nur
  // title/description/activity_type/due_date/id. type → activity_type mappen.
  const editActivity = activity
    ? ({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        activity_type: activity.type ?? "call",
        due_date: activity.due_date,
      } as unknown as DealActivity)
    : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${iconColor}`} />
              <span>{activity?.title}</span>
            </SheetTitle>
          </SheetHeader>

          {activity && (
            <>
              {/* Scrollbarer Body: Kontakt → Notiz → Fällig → Deal-Link */}
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
                {/* Task-Verknüpfungen (nur source:"task") — description-basiert, nie ins Leere */}
                {isTask && (parsed.name || parsed.email || parsed.company) && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Verknüpfungen</p>
                    {/* Kontakt: Treffer → Link, sonst grauer "Erkannt"-Text */}
                    {taskLinks?.contact ? (
                      <button
                        type="button"
                        onClick={() => goTo(`/contacts/${taskLinks.contact!.id}`)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        → Kontakt: {`${taskLinks.contact.first_name ?? ""} ${taskLinks.contact.last_name ?? ""}`.trim()}
                      </button>
                    ) : (parsed.name || parsed.email) ? (
                      <p className="text-sm text-muted-foreground">Erkannt: {parsed.name ?? parsed.email}</p>
                    ) : null}
                    {/* Firma: Treffer → Link, sonst grauer "Erkannt"-Text */}
                    {taskLinks?.company ? (
                      <button
                        type="button"
                        onClick={() => goTo(`/companies/${taskLinks.company!.id}`)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        → Firma: {taskLinks.company.name}
                      </button>
                    ) : parsed.company ? (
                      <p className="text-sm text-muted-foreground">Erkannt: {parsed.company}</p>
                    ) : null}
                  </div>
                )}

                {/* Kontakt */}
                {contact && (
                  <div className="rounded-md border p-3 space-y-1">
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

                {/* Deal-Link (Anzeige) */}
                {activity.deal_id && activity.deal_title && (
                  <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">{activity.deal_title}</span>
                  </div>
                )}
              </div>

              {/* Sticky CTA-Leiste — 3 Stufen */}
              <div className="sticky bottom-0 bg-background border-t pt-3 mt-4 flex flex-col gap-2 shrink-0">
                <Button
                  className="w-full"
                  onClick={handleMarkDone}
                  disabled={activity.status === "completed" || isUpdating}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Erledigt
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowFollowUp(true)}
                    disabled={!activity.deal_id}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Folgeaktivität
                  </Button>
                  {canEditActivity && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowEdit(true)}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Bearbeiten
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => navigate(`/deals/${activity.deal_id}`)}
                  disabled={!activity.deal_id}
                >
                  Deal öffnen ↗
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Folgeaktivität — bestehender AddActivityDialog (braucht deal_id) */}
      {activity?.deal_id && (
        <AddActivityDialog
          dealId={activity.deal_id}
          contactId={activity.contact_id}
          open={showFollowUp}
          onOpenChange={setShowFollowUp}
        />
      )}

      {/* Bearbeiten — bestehendes EditActivitySheet */}
      <EditActivitySheet
        activity={showEdit ? editActivity : null}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={() => onOpenChange(false)}
      />
    </>
  );
}
