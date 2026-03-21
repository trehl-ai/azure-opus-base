import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EditProjectSheet } from "@/components/projects/EditProjectSheet";
import { AddTaskDialog } from "@/components/projects/AddTaskDialog";
import { EntityTagsManager } from "@/components/shared/EntityTagsManager";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, Trash2, Plus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const cardClass = "rounded-2xl border border-border bg-card p-6";

const statusLabel: Record<string, string> = {
  new: "New", planned: "Planned", in_progress: "In Progress", blocked: "Blocked", review: "Review", completed: "Completed",
};
const statusBadge: Record<string, string> = {
  new: "bg-info/10 text-info", planned: "bg-secondary text-secondary-foreground", in_progress: "bg-primary/10 text-primary",
  blocked: "bg-destructive/10 text-destructive", review: "bg-warning/10 text-warning", completed: "bg-success/10 text-success",
};
const priorityBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-warning/10 text-warning", high: "bg-destructive/10 text-destructive",
};

const taskStatuses = ["todo", "in_progress", "review", "done"] as const;
const taskStatusLabel: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
const taskColumnBg: Record<string, string> = { done: "bg-success/5 border-success/20" };

const priorityDot: Record<string, string> = { low: "bg-muted-foreground", medium: "bg-warning", high: "bg-destructive" };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const { canWrite } = usePermission();
  const canWriteProjects = canWrite("projects");
  const canWriteTasks = canWrite("tasks");

  // Project
  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, company:companies(id, name), contact:contacts!projects_primary_contact_id_fkey(id, first_name, last_name), owner:users!projects_owner_user_id_fkey(first_name, last_name), deal:deals!projects_originating_deal_id_fkey(id, title)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tasks
  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned:users!tasks_assigned_user_id_fkey(first_name, last_name)")
        .eq("project_id", id!)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Soft-delete
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Projekt gelöscht" }); navigate("/projects"); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  // Quick status change
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  // Notes
  const notesMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("projects").update({ description: text.trim() || null }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Notizen gespeichert" }); qc.invalidateQueries({ queryKey: ["project", id] }); },
  });

  // Move task
  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "done") updates.completed_at = new Date().toISOString();
      else updates.completed_at = null;
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-tasks", id] }); qc.invalidateQueries({ queryKey: ["project-task-counts"] }); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => { if (!canWriteTasks) { e.preventDefault(); return; } e.dataTransfer.setData("taskId", taskId); }, [canWriteTasks]);
  const handleDrop = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    moveTaskMutation.mutate({ taskId, status });
  }, [tasks, moveTaskMutation]);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const tasksByStatus = new Map<string, typeof tasks>();
  tasks?.forEach((t) => {
    const list = tasksByStatus.get(t.status) ?? [];
    list.push(t);
    tasksByStatus.set(t.status, list);
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-[hsl(228,33%,91%)]" />
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[hsl(228,33%,91%)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[hsl(228,33%,91%)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  if (!project) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Projekt nicht gefunden.</p></div>;

  const company = project.company as { id: string; name: string } | null;
  const contact = project.contact as { id: string; first_name: string; last_name: string } | null;
  const owner = project.owner as { first_name: string; last_name: string } | null;
  const deal = project.deal as { id: string; title: string } | null;
  const currentNotes = notes ?? project.description ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-[28px] font-semibold text-foreground">{project.title}</h1>
          <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium", statusBadge[project.status])}>
            {statusLabel[project.status]}
          </span>
        </div>
        {canWriteProjects && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Bearbeiten</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Projekt löschen?</AlertDialogTitle><AlertDialogDescription>Alle zugehörigen Tasks werden ebenfalls gelöscht.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Notizen</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="links">Verknüpfungen</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className={cardClass}>
            {deal && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
                Entstanden aus Deal: <Link to={`/deals/${deal.id}`} className="font-medium text-primary hover:underline">{deal.title}</Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Projektname" value={project.title} />
              <Field label="Unternehmen" value={company ? <Link to={`/companies/${company.id}`} className="text-primary hover:underline">{company.name}</Link> : "–"} />
              <Field label="Hauptkontakt" value={contact ? <Link to={`/contacts/${contact.id}`} className="text-primary hover:underline">{contact.first_name} {contact.last_name}</Link> : "–"} />
              <div>
                <p className="text-[12px] font-medium text-muted-foreground mb-1">Status</p>
                <Select value={project.status} onValueChange={(v) => statusMutation.mutate(v)}>
                  <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Field label="Priorität" value={<span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", priorityBadge[project.priority ?? "medium"])}>{project.priority ?? "medium"}</span>} />
              <Field label="Owner" value={owner ? `${owner.first_name} ${owner.last_name}` : "–"} />
              <Field label="Startdatum" value={project.start_date ? format(new Date(project.start_date), "dd.MM.yyyy") : "–"} />
              <Field label="Enddatum" value={project.end_date ? format(new Date(project.end_date), "dd.MM.yyyy") : "–"} />
              {project.description && <div className="col-span-2"><Field label="Beschreibung" value={project.description} /></div>}
            </div>
          </div>
        </TabsContent>

        {/* Tasks Kanban */}
        <TabsContent value="tasks" className="space-y-4 mt-4">
          {canWriteTasks && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTaskDialogOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Task</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4">
              {taskStatuses.map((status) => {
                const statusTasks = tasksByStatus.get(status) ?? [];
                const bgClass = taskColumnBg[status] ?? "bg-[#F0F1F5] border-transparent";
                return (
                  <div key={status} className={cn("flex w-[250px] shrink-0 flex-col rounded-xl border p-3", bgClass)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                    <div className="mb-3 px-1 flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold text-foreground">{taskStatusLabel[status]}</h3>
                      <span className="text-[11px] font-medium text-muted-foreground">{statusTasks.length}</span>
                    </div>
                    <div className="flex-1 space-y-2 min-h-[60px]">
                      {statusTasks.map((task) => {
                        const assigned = task.assigned as { first_name: string; last_name: string } | null;
                        const initials = assigned ? `${assigned.first_name[0]}${assigned.last_name[0]}`.toUpperCase() : null;
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            className={cn("rounded-xl border border-border bg-card p-3 cursor-grab transition-shadow hover:shadow-md", task.status === "done" && "opacity-60")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn("text-sm font-medium text-foreground truncate flex-1", task.status === "done" && "line-through")}>{task.title}</p>
                              {task.priority && <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority] ?? priorityDot.medium)} />}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                              {task.due_date ? <span>{format(new Date(task.due_date), "dd.MM.yy")}</span> : <span />}
                              {initials && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{initials}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <div className={cardClass + " space-y-3"}>
            <Textarea value={currentNotes} onChange={(e) => setNotes(e.target.value)} rows={8} placeholder="Projektnotizen…" />
            <Button size="sm" onClick={() => notesMutation.mutate(currentNotes)} disabled={notesMutation.isPending}>Speichern</Button>
          </div>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="mt-4">
          <div className={cardClass}>
            <EntityTagsManager entityType="project" entityId={id!} />
          </div>
        </TabsContent>

        {/* Links */}
        <TabsContent value="links" className="mt-4">
          <div className={cardClass + " space-y-3"}>
            {company && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div><p className="text-[12px] text-muted-foreground">Unternehmen</p><p className="text-sm font-medium">{company.name}</p></div>
                <Button variant="outline" size="sm" asChild><Link to={`/companies/${company.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Öffnen</Link></Button>
              </div>
            )}
            {contact && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div><p className="text-[12px] text-muted-foreground">Hauptkontakt</p><p className="text-sm font-medium">{contact.first_name} {contact.last_name}</p></div>
                <Button variant="outline" size="sm" asChild><Link to={`/contacts/${contact.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Öffnen</Link></Button>
              </div>
            )}
            {deal && (
              <div className="flex items-center justify-between py-2">
                <div><p className="text-[12px] text-muted-foreground">Ursprungs-Deal</p><p className="text-sm font-medium">{deal.title}</p></div>
                <Button variant="outline" size="sm" asChild><Link to={`/deals/${deal.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Öffnen</Link></Button>
              </div>
            )}
            {!company && !contact && !deal && <p className="text-muted-foreground">Keine Verknüpfungen.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <EditProjectSheet project={project} open={editOpen} onOpenChange={setEditOpen} />
      <AddTaskDialog projectId={id!} open={taskDialogOpen} onOpenChange={setTaskDialogOpen} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
