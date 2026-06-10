import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useUsers } from "@/hooks/useUsers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { EditDealSheet } from "@/components/deals/EditDealSheet";
import { LostReasonDialog } from "@/components/deals/LostReasonDialog";
import { AddActivityDialog } from "@/components/deals/AddActivityDialog";
import { EditActivitySheet } from "@/components/activities/EditActivitySheet";
import { RoadshowChecklist } from "@/components/deals/RoadshowChecklist";
import { EntityTagsManager } from "@/components/shared/EntityTagsManager";
import { EmailHistory } from "@/components/shared/EmailHistory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Pencil, Trash2, Trophy, XCircle, Plus, Phone, Mail, Users, CalendarCheck, StickyNote, ExternalLink, CheckSquare, ClipboardList, Clapperboard, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { resolveActivityAuthorId } from "@/lib/activityAuthor";
import type { Database } from "@/integrations/supabase/types";

type DealActivityRow = Database["public"]["Tables"]["deal_activities"]["Row"];

const cardClass = "rounded-2xl border border-border bg-card p-6";

const statusColors: Record<string, string> = {
  open: "bg-info/10 text-info",
  won: "bg-success/10 text-success",
  lost: "bg-destructive/10 text-destructive",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
};

// Includes legacy types (follow_up, wiedervorlage, notiz, angebot, absage) for
// historical rows — those values are no longer creatable via the UI but may
// exist in older deal_activities records.
const activityIcons: Record<string, typeof Phone> = {
  call: Phone, email: Mail, email_reply: AlertCircle, meeting: Users, task: CheckSquare, briefing: ClipboardList, casting: Clapperboard,
  note: StickyNote,
  follow_up: CalendarCheck, wiedervorlage: CalendarCheck, notiz: StickyNote, angebot: Mail, absage: XCircle,
};

const activityLabels: Record<string, string> = {
  call: "📞 Anruf", email: "📧 E-Mail", email_reply: "🔔 Antwort erhalten", meeting: "🤝 Meeting", task: "✅ Aufgabe",
  briefing: "📋 Briefing", casting: "🎬 Casting", note: "📝 Notiz",
  follow_up: "🔄 Follow-Up", wiedervorlage: "🔄 Wiedervorlage", notiz: "📝 Notiz",
  angebot: "📄 Angebot", absage: "❌ Absage",
};

const fmt = (v: number | null, c: string | null) =>
  v != null ? new Intl.NumberFormat("de-DE", { style: "currency", currency: c || "EUR", maximumFractionDigits: 0 }).format(v) : "–";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [editActivity, setEditActivity] = useState<DealActivityRow | null>(null);
  const [editActivityOpen, setEditActivityOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const defaultFollowupDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  };
  const [followupDate, setFollowupDate] = useState<Date>(defaultFollowupDate);
  const { canWrite } = usePermission();
  const canWriteDeals = canWrite("deals");
  const { data: users } = useUsers();

  // Resolve owner_user_id -> "First Last" via SECURITY DEFINER list_team_members RPC.
  // Direct PostgREST `users!fkey(...)` embeds silently return null under RLS for
  // non-admin viewers, hiding the owner on cards and activity rows.
  const resolveOwnerName = (uid: string | null | undefined): string | null => {
    if (!uid) return null;
    const u = users?.find((x) => x.id === uid);
    if (!u) return null;
    return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || null;
  };

  // Deal
  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deals")
        .select("*, company:companies(id, name), contact:contacts!deals_primary_contact_id_fkey(id, first_name, last_name, phone), pipeline:pipelines(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Stages
  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", deal?.pipeline_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pipeline_stages").select("*").eq("pipeline_id", deal!.pipeline_id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!deal?.pipeline_id,
  });

  // Activities
  const { data: activities } = useQuery({
    queryKey: ["deal-activities", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deal_activities")
        .select("*")
        .eq("deal_id", id!)
        .order("created_at", { ascending: false }); // newest first — important lead replies stay at the top
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Linked project
  const { data: linkedProject } = useQuery({
    queryKey: ["deal-project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, status").eq("originating_deal_id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Soft-delete
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("deals").update({ deleted_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deal gelöscht" });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["deal", id] });
      navigate("/deals");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  // Won via atomic RPC
  const wonMutation = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.rpc("set_deal_won_and_create_project", {
        p_deal_id: id!,
        p_winning_user_id: user?.id ?? "",
      });
      if (error) throw error;
      const projectId =
        (result as { project_id?: string } | null)?.project_id ?? null;
      if (projectId) {
        const { data: project } = await supabase
          .from("projects")
          .select("id, title")
          .eq("id", projectId)
          .maybeSingle();
        return project;
      }
      return null;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["deal", id] });
      qc.invalidateQueries({ queryKey: ["deal-project", id] });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      if (project) {
        toast({
          title: "Deal gewonnen! Projekt wurde automatisch erstellt. 🎉",
          description: project.title,
          action: <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${project.id}`)}>Zum Projekt</Button>,
        });
      } else {
        toast({ title: "Deal als Won markiert 🎉" });
      }
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  // Reopen — flip won/lost back to open via RPC (nulls won_at/lost_at/lost_reason)
  const reopenMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("set_deal_reopen", { p_deal_id: id! });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", id] });
      qc.invalidateQueries({ queryKey: ["deal-project", id] });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      toast({ title: "↩ Deal wieder geöffnet", description: "Deal ist jetzt offen." });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  // Notes
  const notesMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await (supabase as any).from("deals").update({ description: text.trim() || null }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Notizen gespeichert" }); qc.invalidateQueries({ queryKey: ["deal", id] }); },
  });

  // Toggle activity
  const toggleActivityMutation = useMutation({
    mutationFn: async ({ actId, completed }: { actId: string; completed: boolean }) => {
      const { error } = await (supabase as any).from("deal_activities").update({
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-activities", id] }),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (actId: string) => {
      const { error } = await (supabase as any).from("deal_activities").delete().eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notiz gelöscht" });
      qc.invalidateQueries({ queryKey: ["deal-activities", id] });
      qc.invalidateQueries({ queryKey: ["open-activities"] });
      qc.invalidateQueries({ queryKey: ["activity-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard_activities"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  // "Infomaterial auf Wiedervorlage" — scheduled follow-up, default due_date is
  // today+7d (user picks date in the popover before saving). description holds
  // the note text since deal_activities has no `notes` column.
  const infomaterialFollowupMutation = useMutation({
    mutationFn: async () => {
      const authorId = resolveActivityAuthorId(user?.id);
      const { error } = await (supabase as any).from("deal_activities").insert({
        deal_id: id!,
        activity_type: "task",
        title: "Infomaterial auf Wiedervorlage",
        description: "Infomaterial auf Wiedervorlage",
        due_date: followupDate.toISOString(),
        owner_user_id: authorId,
        created_by_user_id: authorId,
        
        completed_at: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Wiedervorlage angelegt", description: format(followupDate, "dd.MM.yyyy") });
      qc.invalidateQueries({ queryKey: ["deal-activities", id] });
      setFollowupOpen(false);
      setFollowupDate(defaultFollowupDate());
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-[hsl(228,33%,91%)]" />
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[hsl(228,33%,91%)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[hsl(228,33%,91%)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  if (!deal) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Deal nicht gefunden.</p></div>;

  const company = deal.company as { id: string; name: string } | null;
  const contact = deal.contact as { id: string; first_name: string; last_name: string; phone: string | null } | null;
  const ownerName = resolveOwnerName(deal.owner_user_id);
  const pipeline = deal.pipeline as { name: string } | null;
  const currentNotes = notes ?? deal.description ?? "";
  const lostStage = stages?.find((s) => s.is_lost_stage);
  const currentStageIdx = stages?.findIndex((s) => s.id === deal.pipeline_stage_id) ?? -1;

  // Notizen (activity_type='note') als Kommentar-Strang getrennt von Aktions-Aktivitäten
  // (call/email/task/meeting/...) — kein Checkbox, kein Offen/Erledigt-Split.
  const actionActivities = activities?.filter((a) => a.activity_type !== "note") ?? [];
  const noteActivities = activities?.filter((a) => a.activity_type === "note") ?? [];
  const openActivities = actionActivities.filter((a) => !a.completed_at);
  const doneActivities = actionActivities.filter((a) => a.completed_at);

  const isWerteraumSchulen = deal?.pipeline_id === "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/deals"))}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-[28px] font-semibold text-foreground">{deal.title}</h1>
          <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium", statusColors[deal.status] ?? statusColors.open)}>
            {deal.status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canWriteDeals && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Bearbeiten</Button>}
          {deal.status === "open" && canWriteDeals && (
            <>
              <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-white" onClick={() => wonMutation.mutate()} disabled={wonMutation.isPending}>
                <Trophy className="h-3.5 w-3.5" /> Won
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setLostOpen(true)}>
                <XCircle className="h-3.5 w-3.5" /> Lost
              </Button>
            </>
          )}
          {(deal.status === "won" || deal.status === "lost") && canWriteDeals && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
            >
              ↩ Als offen markieren
            </Button>
          )}
          {canWriteDeals && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Deal löschen?</AlertDialogTitle><AlertDialogDescription>Dieser Vorgang kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      </div>

      {/* Won banner */}
      {deal.status === "won" && linkedProject && (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-5 py-3">
          <Trophy className="h-5 w-5 text-success shrink-0" />
          <p className="text-body text-foreground flex-1">
            Dieser Deal wurde gewonnen. Projekt:{" "}
            <Link to={`/projects/${linkedProject.id}`} className="font-medium text-primary hover:underline">{linkedProject.title}</Link>
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/projects/${linkedProject.id}`}>Zum Projekt</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          {isWerteraumSchulen && <TabsTrigger value="roadshow">Roadshow-Checkliste</TabsTrigger>}
          <TabsTrigger value="activities">Aktivitäten</TabsTrigger>
          <TabsTrigger value="emails">E-Mails</TabsTrigger>
          <TabsTrigger value="notes">Notizen</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          {deal.status === "won" && <TabsTrigger value="project">Projekt</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Stage Progress */}
          {stages && stages.length > 0 && (
            <div className={cardClass}>
              <p className="text-label font-semibold text-foreground mb-3">Pipeline-Fortschritt</p>
              <div className="flex gap-1">
                {stages.map((s, i) => (
                  <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn(
                      "h-2 w-full rounded-full transition-colors",
                      i <= currentStageIdx
                        ? s.is_won_stage ? "bg-success" : s.is_lost_stage ? "bg-destructive" : "bg-primary"
                        : "bg-muted"
                    )} />
                    <span className={cn("text-[10px] font-medium truncate max-w-full",
                      i === currentStageIdx ? "text-primary" : "text-muted-foreground"
                    )}>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className={cardClass}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Deal-Name" value={deal.title} />
              <Field label="Unternehmen" value={company ? <Link to={`/companies/${company.id}`} className="text-primary hover:underline">{company.name}</Link> : "–"} />
              <Field label="Hauptkontakt" value={contact ? (
                <>
                  <Link to={`/contacts/${contact.id}`} className="text-primary hover:underline">{contact.first_name} {contact.last_name}</Link>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                      <Phone className="w-3 h-3" />
                      {contact.phone}
                    </a>
                  )}
                </>
              ) : "–"} />
              <Field label="Pipeline" value={pipeline?.name ?? "–"} />
              <Field label="Stage" value={stages?.find((s) => s.id === deal.pipeline_stage_id)?.name ?? "–"} />
              <Field label="Deal-Wert" value={<span className="text-lg font-semibold">{fmt(deal.value_amount, deal.currency)}</span>} />
              <Field label="Währung" value={deal.currency ?? "EUR"} />
              <Field label="Abschlussdatum" value={deal.expected_close_date ? format(new Date(deal.expected_close_date), "dd.MM.yyyy") : "–"} />
              <Field label="Wahrscheinlichkeit" value={`${deal.probability_percent ?? 0}%`} />
              <Field label="Priorität" value={<span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", priorityColors[deal.priority ?? "medium"])}>{deal.priority ?? "medium"}</span>} />
              <Field label="Quelle" value={deal.source ?? "–"} />
              <Field label="Owner" value={ownerName ?? "–"} />
              {deal.description && <div className="col-span-2"><Field label="Beschreibung" value={deal.description} /></div>}
              {deal.won_at && <Field label="Gewonnen am" value={format(new Date(deal.won_at), "dd.MM.yyyy HH:mm")} />}
              {deal.lost_at && <Field label="Verloren am" value={format(new Date(deal.lost_at), "dd.MM.yyyy HH:mm")} />}
              {deal.lost_reason && <div className="col-span-2"><Field label="Verlustgrund" value={deal.lost_reason} /></div>}
            </div>
          </div>
        </TabsContent>

        {/* Activities */}
        <TabsContent value="activities" className="space-y-4 mt-4">
          <div className="flex justify-end gap-2">
            {canWriteDeals && (
              <Popover open={followupOpen} onOpenChange={setFollowupOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <CalendarCheck className="h-3.5 w-3.5" /> Infomaterial auf Wiedervorlage
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 space-y-2">
                    <p className="text-label font-medium px-1">Fällig am</p>
                    <Calendar
                      mode="single"
                      selected={followupDate}
                      onSelect={(d) => d && setFollowupDate(d)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => infomaterialFollowupMutation.mutate()}
                      disabled={infomaterialFollowupMutation.isPending}
                    >
                      {infomaterialFollowupMutation.isPending ? "Anlegen…" : "Anlegen"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button size="sm" onClick={() => setActivityOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Aktivität</Button>
          </div>
          {openActivities.length === 0 && doneActivities.length === 0 && noteActivities.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Noch keine Aktivitäten.</p>
          )}
          {openActivities.length > 0 && (
            <div className={cardClass + " space-y-3"}>
              <p className="text-label font-semibold">Offen</p>
              {openActivities.map((a) => <ActivityRow key={a.id} activity={a} ownerName={resolveOwnerName(a.owner_user_id)} onToggle={(checked) => toggleActivityMutation.mutate({ actId: a.id, completed: checked })} onEdit={() => { setEditActivity(a as DealActivityRow); setEditActivityOpen(true); }} />)}
            </div>
          )}
          {doneActivities.length > 0 && (
            <div className={cardClass + " space-y-3"}>
              <p className="text-label font-semibold text-muted-foreground">Erledigt</p>
              {doneActivities.map((a) => <ActivityRow key={a.id} activity={a} ownerName={resolveOwnerName(a.owner_user_id)} onToggle={(checked) => toggleActivityMutation.mutate({ actId: a.id, completed: checked })} onEdit={() => { setEditActivity(a as DealActivityRow); setEditActivityOpen(true); }} />)}
            </div>
          )}

          {/* Notizen & Kommentare — getrennt von Aktions-Aktivitäten, ohne Checkbox/Status */}
          {noteActivities.length > 0 && (
            <div className={cardClass + " space-y-3"}>
              <p className="text-label font-semibold flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Notizen & Kommentare</p>
              {noteActivities.map((a) => <CommentRow key={a.id} activity={a} ownerName={resolveOwnerName(a.owner_user_id)} onEdit={() => { setEditActivity(a as DealActivityRow); setEditActivityOpen(true); }} onDelete={() => deleteActivityMutation.mutate(a.id)} />)}
            </div>
          )}
        </TabsContent>

        {/* E-Mails */}
        <TabsContent value="emails" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-label font-semibold text-foreground mb-4">E-Mail-Historie</h2>
            <EmailHistory dealId={id!} />
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <div className={cardClass + " space-y-3"}>
            <Textarea value={currentNotes} onChange={(e) => setNotes(e.target.value)} rows={8} placeholder="Deal-Notizen…" />
            <Button size="sm" onClick={() => notesMutation.mutate(currentNotes)} disabled={notesMutation.isPending}>Speichern</Button>
          </div>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="mt-4">
          <div className={cardClass}>
            <EntityTagsManager entityType="deal" entityId={id!} />
          </div>
        </TabsContent>

        {/* Roadshow — nur für Werteraum - Schulen */}
        {isWerteraumSchulen && (
          <TabsContent value="roadshow" className="mt-4">
            <RoadshowChecklist dealId={id!} />
          </TabsContent>
        )}

        {/* Project */}
        {deal.status === "won" && (
          <TabsContent value="project" className="mt-4">
            <div className={cardClass}>
              {linkedProject ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{linkedProject.title}</p>
                    <p className="text-label text-muted-foreground">Status: {linkedProject.status}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <Link to={`/projects/${linkedProject.id}`}><ExternalLink className="h-3.5 w-3.5" /> Zum Projekt</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Noch kein Projekt verknüpft.</p>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <EditDealSheet deal={deal} open={editOpen} onOpenChange={setEditOpen} />
      <AddActivityDialog dealId={id!} open={activityOpen} onOpenChange={setActivityOpen} />
      <EditActivitySheet
        activity={editActivity}
        open={editActivityOpen}
        onClose={() => setEditActivityOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["deal-activities", id] })}
      />
      {lostStage && (
        <LostReasonDialog
          dealId={id!} dealTitle={deal.title} stageId={lostStage.id}
          open={lostOpen} onOpenChange={setLostOpen}
          onComplete={() => { setLostOpen(false); qc.invalidateQueries({ queryKey: ["deal", id] }); }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-muted-foreground mb-0.5">{label}</p>
      <div className="text-body text-foreground">{value}</div>
    </div>
  );
}

function ActivityRow({ activity, ownerName, onToggle, onEdit }: { activity: any; ownerName: string | null; onToggle: (checked: boolean) => void; onEdit?: () => void }) {
  const Icon = activityIcons[activity.activity_type] ?? StickyNote;
  const isDone = !!activity.completed_at;
  const isReply = activity.activity_type === "email_reply";

  return (
    <div className={cn(
      "flex items-start gap-3 py-2",
      isReply ? "rounded-lg border border-amber-300 bg-amber-50 px-3" : "border-b border-border last:border-0",
      isDone && !isReply && "opacity-60",
    )}>
      <Checkbox checked={isDone} onCheckedChange={(c) => onToggle(!!c)} className="mt-0.5" />
      <div className={cn("rounded-lg p-1.5", isReply ? "bg-amber-100" : isDone ? "bg-muted" : "bg-primary/10")}>
        <Icon className={cn("h-3.5 w-3.5", isReply ? "text-amber-600" : isDone ? "text-muted-foreground" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-body font-medium", isReply && "font-semibold text-amber-900", isDone && !isReply && "line-through text-muted-foreground")}>{activity.title}</p>
          {isReply && (
            <span className="shrink-0 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Antwort erhalten
            </span>
          )}
        </div>
        {activity.description && <p className="text-label text-muted-foreground mt-0.5 truncate">{activity.description}</p>}
        <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
          <span>{activityLabels[activity.activity_type] ?? activity.activity_type}</span>
          {activity.due_date && <span>Fällig: {format(new Date(activity.due_date), "dd.MM.yyyy")}</span>}
          {ownerName && <span>{ownerName}</span>}
          {activity.completed_at && <span>Erledigt: {format(new Date(activity.completed_at), "dd.MM.yyyy")}</span>}
        </div>
      </div>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onEdit}
          aria-label="Aktivität bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}


function CommentRow({ activity, ownerName, onEdit, onDelete }: { activity: any; ownerName: string | null; onEdit?: () => void; onDelete?: () => void }) {
  const isGenericTitle = !activity.title || activity.title === "📝 Notiz" || activity.title === "Notiz";
  return (
    <div className="group flex items-start gap-3 rounded-lg border-l-4 border-muted bg-muted/30 px-3 py-2">
      <div className="rounded-lg bg-muted p-1.5 mt-0.5 shrink-0">
        <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {!isGenericTitle && <p className="text-body font-medium">{activity.title}</p>}
        {activity.description && <p className="text-body text-foreground whitespace-pre-wrap break-words">{activity.description}</p>}
        <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
          {ownerName && <span>{ownerName}</span>}
          <span>{format(new Date(activity.created_at), "dd.MM.yyyy HH:mm")}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
            aria-label="Notiz bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Notiz löschen">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Notiz wirklich löschen?</AlertDialogTitle>
                <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
