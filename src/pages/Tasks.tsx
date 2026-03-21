import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List, Plus } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfWeek, startOfWeek, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

const taskStatuses = ["todo", "in_progress", "review", "done"] as const;
const taskStatusLabel: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
const taskColumnBg: Record<string, string> = { done: "bg-success/5 border-success/20" };
const priorityDot: Record<string, string> = { low: "bg-muted-foreground", medium: "bg-warning", high: "bg-destructive" };
const statusBadge: Record<string, string> = {
  todo: "bg-secondary text-secondary-foreground", in_progress: "bg-primary/10 text-primary",
  review: "bg-warning/10 text-warning", done: "bg-success/10 text-success",
};
const priorityBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-warning/10 text-warning", high: "bg-destructive/10 text-destructive",
};

export default function Tasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users } = useUsers();
  const { user } = useAuth();
  const { canWrite, role } = usePermission();
  const canWriteTasks = canWrite("tasks");

  const [view, setView] = useState<"board" | "list">("board");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDue, setFilterDue] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned:users!tasks_assigned_user_id_fkey(first_name, last_name), project:projects!tasks_project_id_fkey(id, title)")
        .is("parent_task_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title").order("title");
      if (error) throw error;
      return data;
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "done") updates.completed_at = new Date().toISOString();
      else updates.completed_at = null;
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-tasks"] }); qc.invalidateQueries({ queryKey: ["project-tasks"] }); qc.invalidateQueries({ queryKey: ["project-task-counts"] }); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const today = startOfDay(new Date());
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    return tasks.filter((t) => {
      if (filterProject !== "all" && t.project_id !== filterProject) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterUser !== "all" && t.assigned_user_id !== filterUser) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterDue !== "all" && t.due_date) {
        const d = new Date(t.due_date);
        if (filterDue === "overdue" && !isBefore(d, today)) return false;
        if (filterDue === "this_week" && (isBefore(d, today) || isAfter(d, weekEnd))) return false;
        if (filterDue === "next_week" && (isBefore(d, nextWeekStart) || isAfter(d, nextWeekEnd))) return false;
      }
      if (filterDue !== "all" && !t.due_date) return false;
      return true;
    });
  }, [tasks, filterProject, filterStatus, filterUser, filterPriority, filterDue]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => { if (!canWriteTasks) { e.preventDefault(); return; } e.dataTransfer.setData("taskId", taskId); }, [canWriteTasks]);
  const handleDrop = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    const task = filtered.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    moveTaskMutation.mutate({ taskId, status });
  }, [filtered, moveTaskMutation]);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const tasksByStatus = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((t) => {
      const list = map.get(t.status) ?? [];
      list.push(t);
      map.set(t.status, list);
    });
    return map;
  }, [filtered]);

  const isOverdue = (due: string | null) => due && isBefore(new Date(due), startOfDay(new Date()));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-[28px] font-semibold text-foreground">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("board")} className={cn("px-3 py-2 text-sm min-h-[44px]", view === "board" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView("list")} className={cn("px-3 py-2 text-sm min-h-[44px]", view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] bg-card"><SelectValue placeholder="Projekt" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Projekte</SelectItem>
            {projects?.map((p) => <SelectItem key={p.id} value={p.id} className="min-h-[44px]">{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[150px] min-h-[44px] bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Status</SelectItem>
            {taskStatuses.map((s) => <SelectItem key={s} value={s} className="min-h-[44px]">{taskStatusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] bg-card"><SelectValue placeholder="Verantwortlich" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={u.id} className="min-h-[44px]">{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] bg-card"><SelectValue placeholder="Priorität" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle</SelectItem>
            <SelectItem value="low" className="min-h-[44px]">Low</SelectItem>
            <SelectItem value="medium" className="min-h-[44px]">Medium</SelectItem>
            <SelectItem value="high" className="min-h-[44px]">High</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDue} onValueChange={setFilterDue}>
          <SelectTrigger className="w-full sm:w-[160px] min-h-[44px] bg-card col-span-2 sm:col-span-1"><SelectValue placeholder="Fälligkeit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle</SelectItem>
            <SelectItem value="overdue" className="min-h-[44px]">Überfällig</SelectItem>
            <SelectItem value="this_week" className="min-h-[44px]">Diese Woche</SelectItem>
            <SelectItem value="next_week" className="min-h-[44px]">Nächste Woche</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board View */}
      {view === "board" && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {taskStatuses.map((status) => {
              const statusTasks = tasksByStatus.get(status) ?? [];
              const bgClass = taskColumnBg[status] ?? "bg-[hsl(var(--secondary))] border-transparent";
              return (
                <div key={status} className={cn("flex w-[280px] shrink-0 flex-col rounded-xl border p-3", bgClass)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                  <div className="mb-3 px-1 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-foreground">{taskStatusLabel[status]}</h3>
                    <span className="text-[11px] font-medium text-muted-foreground">{statusTasks.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 min-h-[80px]">
                    {statusTasks.map((task) => {
                      const assigned = task.assigned as { first_name: string; last_name: string } | null;
                      const project = task.project as { id: string; title: string } | null;
                      const initials = assigned ? `${assigned.first_name[0]}${assigned.last_name[0]}`.toUpperCase() : null;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={cn("rounded-xl border border-border bg-card p-3 cursor-grab transition-shadow hover:shadow-md", task.status === "done" && "opacity-60")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm font-medium text-foreground truncate flex-1", task.status === "done" && "line-through")}>{task.title}</p>
                            {task.priority && <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority] ?? priorityDot.medium)} />}
                          </div>
                          {project && <p className="mt-1 text-[11px] text-muted-foreground truncate">{project.title}</p>}
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            {task.due_date ? <span className={cn(isOverdue(task.due_date) && task.status !== "done" && "text-destructive font-medium")}>{format(new Date(task.due_date), "dd.MM.yy")}</span> : <span />}
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
      )}

      {/* List View */}
      {view === "list" && (
        <div className="rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Verantwortlich</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Erstellt am</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Keine Tasks gefunden.</TableCell></TableRow>
              ) : filtered.map((task) => {
                const assigned = task.assigned as { first_name: string; last_name: string } | null;
                const project = task.project as { id: string; title: string } | null;
                return (
                  <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50 h-[52px]" onClick={() => setSelectedTaskId(task.id)}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className="text-muted-foreground">{project?.title ?? "–"}</TableCell>
                    <TableCell>{assigned ? `${assigned.first_name} ${assigned.last_name}` : "–"}</TableCell>
                    <TableCell><span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", statusBadge[task.status])}>{taskStatusLabel[task.status]}</span></TableCell>
                    <TableCell><span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", priorityBadge[task.priority ?? "medium"])}>{task.priority ?? "medium"}</span></TableCell>
                    <TableCell className={cn(isOverdue(task.due_date) && task.status !== "done" && "text-destructive font-medium")}>{task.due_date ? format(new Date(task.due_date), "dd.MM.yyyy") : "–"}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(task.created_at), "dd.MM.yyyy")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailSheet taskId={selectedTaskId} open={!!selectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} />
    </div>
  );
}
