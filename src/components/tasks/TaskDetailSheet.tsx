import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useTaskStatuses } from "@/hooks/queries/useTaskStatuses";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Send, Plus, ExternalLink, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { TaskAttachments } from "./TaskAttachments";
import { TaskLinks } from "./TaskLinks";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// statusOptions now loaded dynamically

export function TaskDetailSheet({ taskId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: taskStatusesData = [] } = useTaskStatuses();
  const statusOptions = taskStatusesData.map((s) => ({ value: s.slug, label: s.name }));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();
  const [commentText, setCommentText] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: task } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned:users!tasks_assigned_user_id_fkey(first_name, last_name), creator:users!tasks_created_by_user_id_fkey(first_name, last_name), project:projects!tasks_project_id_fkey(id, title)")
        .eq("id", taskId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && open,
  });

  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, commenter:users!task_comments_user_id_fkey(first_name, last_name)")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && open,
  });

  const { data: subtasks } = useQuery({
    queryKey: ["subtasks", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned:users!tasks_assigned_user_id_fkey(first_name, last_name)")
        .eq("parent_task_id", taskId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && open,
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority ?? "medium");
      setAssignedUserId(task.assigned_user_id ?? "");
      setStartDate(task.start_date ? new Date(task.start_date) : undefined);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setDirty(false);
    }
  }, [task]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["task-detail", taskId] });
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    qc.invalidateQueries({ queryKey: ["project-task-counts"] });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = {
        title: title.trim(), description: description.trim() || null,
        status, priority, assigned_user_id: assignedUserId || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      };
      if (status === "done" && task?.status !== "done") updates.completed_at = new Date().toISOString();
      else if (status !== "done") updates.completed_at = null;
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Task aktualisiert" }); setDirty(false); invalidateAll(); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!commentText.trim()) return;
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId!, user_id: user!.id, comment_text: commentText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setCommentText(""); qc.invalidateQueries({ queryKey: ["task-comments", taskId] }); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const subtaskMutation = useMutation({
    mutationFn: async () => {
      if (!subtaskTitle.trim()) return;
      const { error } = await supabase.from("tasks").insert({
        title: subtaskTitle.trim(), project_id: task!.project_id,
        parent_task_id: taskId!, created_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setSubtaskTitle(""); setShowSubtaskForm(false); qc.invalidateQueries({ queryKey: ["subtasks", taskId] }); invalidateAll(); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subtasks", taskId] }); invalidateAll(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Task gelöscht" });
      invalidateAll();
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const project = task?.project as { id: string; title: string } | null;
  const creator = task?.creator as { first_name: string; last_name: string } | null;

  const markDirty = () => setDirty(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Task Details</DialogTitle></DialogHeader>
        {!task ? (
          <p className="mt-8 text-center text-muted-foreground">Laden…</p>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Editable fields */}
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} rows={3} />
            </div>

            {project && (
              <div className="space-y-1.5">
                <Label>Projekt</Label>
                <Link to={`/projects/${project.id}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  {project.title} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v); markDirty(); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priorität</Label>
                <Select value={priority} onValueChange={(v) => { setPriority(v); markDirty(); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Verantwortlich</Label>
              <Select value={assignedUserId} onValueChange={(v) => { setAssignedUserId(v); markDirty(); }}>
                <SelectTrigger><SelectValue placeholder="Zuweisen" /></SelectTrigger>
                <SelectContent>{users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Startdatum</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "dd.MM.yyyy") : "Datum"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); markDirty(); }} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Fälligkeitsdatum</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, "dd.MM.yyyy") : "Datum"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={(d) => { setDueDate(d); markDirty(); }} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div><span className="text-[12px] font-medium">Erstellt von:</span> {creator ? `${creator.first_name} ${creator.last_name}` : "–"}</div>
              <div><span className="text-[12px] font-medium">Erstellt am:</span> {format(new Date(task.created_at), "dd.MM.yyyy HH:mm")}</div>
            </div>

            {dirty && (
              <Button className="w-full" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Speichern…" : "Änderungen speichern"}
              </Button>
            )}

            {/* Subtasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Subtasks</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSubtaskForm(true)} className="gap-1 text-[12px]"><Plus className="h-3 w-3" /> Subtask</Button>
              </div>
              {subtasks && subtasks.length > 0 && (
                <div className="space-y-1">
                  {subtasks.map((st) => (
                    <div key={st.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                      <Checkbox
                        checked={st.status === "done"}
                        onCheckedChange={(checked) => toggleSubtask.mutate({ id: st.id, done: !!checked })}
                      />
                      <span className={cn("text-sm flex-1", st.status === "done" && "line-through text-muted-foreground")}>{st.title}</span>
                      {st.due_date && <span className="text-[11px] text-muted-foreground">{format(new Date(st.due_date), "dd.MM.")}</span>}
                    </div>
                  ))}
                </div>
              )}
              {showSubtaskForm && (
                <div className="flex gap-2">
                  <Input value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} placeholder="Subtask-Titel" className="flex-1" onKeyDown={(e) => { if (e.key === "Enter") subtaskMutation.mutate(); }} />
                  <Button size="sm" onClick={() => subtaskMutation.mutate()} disabled={subtaskMutation.isPending}>Hinzufügen</Button>
                </div>
              )}
            </div>

            {/* Attachments */}
            <TaskAttachments taskId={taskId!} />

            {/* Links */}
            <TaskLinks taskId={taskId!} />

            {/* Comments */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Kommentare</h3>
              {comments && comments.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {comments.map((c) => {
                    const commenter = c.commenter as { first_name: string; last_name: string } | null;
                    return (
                      <div key={c.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-foreground">{commenter ? `${commenter.first_name} ${commenter.last_name}` : "Unbekannt"}</span>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(c.created_at), "dd.MM.yyyy HH:mm")}</span>
                        </div>
                        <p className="text-sm text-foreground">{c.comment_text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
              )}
              <div className="flex gap-2">
                <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Kommentar schreiben…" className="flex-1" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) commentMutation.mutate(); }} />
                <Button size="icon" onClick={() => commentMutation.mutate()} disabled={commentMutation.isPending || !commentText.trim()}><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
