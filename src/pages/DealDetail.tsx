import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { EditDealSheet } from "@/components/deals/EditDealSheet";
import { LostReasonDialog } from "@/components/deals/LostReasonDialog";
import { AddActivityDialog } from "@/components/deals/AddActivityDialog";
import { RoadshowChecklist } from "@/components/deals/RoadshowChecklist";
import { RoadshowBadge } from "@/components/deals/RoadshowBadge";
import { useRoadshowDetails } from "@/hooks/queries/useRoadshowDetails";
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
import { ArrowLeft, Pencil, Trash2, Trophy, XCircle, Plus, Phone, Mail, Users, CalendarCheck, StickyNote, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

const activityIcons: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: Users, follow_up: CalendarCheck, note: StickyNote,
};

const activityLabels: Record<string, string> = {
  call: "Anruf", email: "E-Mail", meeting: "Meeting", follow_up: "Follow-Up", note: "Notiz",
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
  const { canWrite } = usePermission();
  const canWriteDeals = canWrite("deals");

  // Deal
  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, company:companies(id, name), contact:contacts!deals_primary_contact_id_fkey(id, first_name, last_name), owner:users!deals_owner_user_id_fkey(first_name, last_name), pipeline:pipelines(name)")
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
      const { data, error } = await supabase.from("pipeline_stages").select("*").eq("pipeline_id", deal!.pipeline_id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!deal?.pipeline_id,
  });

  // Activities
  const { data: activities } = useQuery({
    queryKey: ["deal-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("*, owner:users!deal_activities_owner_user_id_fkey(first_name, last_name)")
        .eq("deal_id", id!)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("due_date", { ascending: true, nullsFirst: false });
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
      const { error } = await supabase.from("deals").update({ deleted_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Deal gelöscht" }); navigate("/deals"); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  // Won via atomic RPC
  const wonMutation = useMutation({
    mutationFn: async () => {
      const { data: projectId, error } = await supabase.rpc("set_deal_won_and_create_project", {
        p_deal_id: id!,
        p_winning_user_id: user?.id ?? "",
      });
      if (error) throw error;
      if (projectId) {
        const { data: project } = await supabase.from("projects").select("id, title").eq("id", projectId).maybeSingle();
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

  // Notes
  const notesMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("deals").update({ description: text.trim() || null }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Notizen gespeichert" }); qc.invalidateQueries({ queryKey: ["deal", id] }); },
  });

  // Toggle activity
  const toggleActivityMutation = useMutation({
    mutationFn: async ({ actId, completed }: { actId: string; completed: boolean }) => {
      const { error } = await supabase.from("deal_activities").update({
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-activities", id] }),
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
  const contact = deal.contact as { id: string; first_name: string; last_name: string } | null;
  const owner = deal.owner as { first_name: string; last_name: string } | null;
  const pipeline = deal.pipeline as { name: string } | null;
  const currentNotes = notes ?? deal.description ?? "";
  const lostStage = stages?.find((s) => s.is_lost_stage);
  const currentStageIdx = stages?.findIndex((s) => s.id === deal.pipeline_stage_id) ?? -1;

  const openActivities = activities?.filter((a) => !a.completed_at) ?? [];
  const doneActivities = activities?.filter((a) => a.completed_at) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/deals")}><ArrowLeft className="h-5 w-5" /></Button>
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
          <TabsTrigger value="roadshow">Roadshow-Checkliste</TabsTrigger>
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
              <Field label="Hauptkontakt" value={contact ? <Link to={`/contacts/${contact.id}`} className="text-primary hover:underline">{contact.first_name} {contact.last_name}</Link> : "–"} />
              <Field label="Pipeline" value={pipeline?.name ?? "–"} />
              <Field label="Stage" value={stages?.find((s) => s.id === deal.pipeline_stage_id)?.name ?? "–"} />
              <Field label="Deal-Wert" value={<span className="text-lg font-semibold">{fmt(deal.value_amount, deal.currency)}</span>} />
              <Field label="Währung" value={deal.currency ?? "EUR"} />
              <Field label="Abschlussdatum" value={deal.expected_close_date ? format(new Date(deal.expected_close_date), "dd.MM.yyyy") : "–"} />
              <Field label="Wahrscheinlichkeit" value={`${deal.probability_percent ?? 0}%`} />
              <Field label="Priorität" value={<span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", priorityColors[deal.priority ?? "medium"])}>{deal.priority ?? "medium"}</span>} />
              <Field label="Quelle" value={deal.source ?? "–"} />
              <Field label="Owner" value={owner ? `${owner.first_name} ${owner.last_name}` : "–"} />
              {deal.description && <div className="col-span-2"><Field label="Beschreibung" value={deal.description} /></div>}
              {deal.won_at && <Field label="Gewonnen am" value={format(new Date(deal.won_at), "dd.MM.yyyy HH:mm")} />}
              {deal.lost_at && <Field label="Verloren am" value={format(new Date(deal.lost_at), "dd.MM.yyyy HH:mm")} />}
              {deal.lost_reason && <div className="col-span-2"><Field label="Verlustgrund" value={deal.lost_reason} /></div>}
            </div>
          </div>
        </TabsContent>

        {/* Activities */}
        <TabsContent value="activities" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setActivityOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Aktivität</Button>
          </div>
          {openActivities.length === 0 && doneActivities.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Noch keine Aktivitäten.</p>
          )}
          {openActivities.length > 0 && (
            <div className={cardClass + " space-y-3"}>
              <p className="text-label font-semibold">Offen</p>
              {openActivities.map((a) => <ActivityRow key={a.id} activity={a} onToggle={(checked) => toggleActivityMutation.mutate({ actId: a.id, completed: checked })} />)}
            </div>
          )}
          {doneActivities.length > 0 && (
            <div className={cardClass + " space-y-3"}>
              <p className="text-label font-semibold text-muted-foreground">Erledigt</p>
              {doneActivities.map((a) => <ActivityRow key={a.id} activity={a} onToggle={(checked) => toggleActivityMutation.mutate({ actId: a.id, completed: checked })} />)}
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

function ActivityRow({ activity, onToggle }: { activity: any; onToggle: (checked: boolean) => void }) {
  const Icon = activityIcons[activity.activity_type] ?? StickyNote;
  const owner = activity.owner as { first_name: string; last_name: string } | null;
  const isDone = !!activity.completed_at;

  return (
    <div className={cn("flex items-start gap-3 py-2 border-b border-border last:border-0", isDone && "opacity-60")}>
      <Checkbox checked={isDone} onCheckedChange={(c) => onToggle(!!c)} className="mt-0.5" />
      <div className={cn("rounded-lg p-1.5", isDone ? "bg-muted" : "bg-primary/10")}>
        <Icon className={cn("h-3.5 w-3.5", isDone ? "text-muted-foreground" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-body font-medium", isDone && "line-through text-muted-foreground")}>{activity.title}</p>
        {activity.description && <p className="text-label text-muted-foreground mt-0.5 truncate">{activity.description}</p>}
        <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
          <span>{activityLabels[activity.activity_type] ?? activity.activity_type}</span>
          {activity.due_date && <span>Fällig: {format(new Date(activity.due_date), "dd.MM.yyyy")}</span>}
          {owner && <span>{owner.first_name} {owner.last_name}</span>}
          {activity.completed_at && <span>Erledigt: {format(new Date(activity.completed_at), "dd.MM.yyyy")}</span>}
        </div>
      </div>
    </div>
  );
}
