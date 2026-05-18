import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTaskStatuses } from "@/hooks/queries/useTaskStatuses";
import { MobileCard } from "@/components/shared/MobileCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { CreateTaskSheet } from "@/components/tasks/CreateTaskSheet";

const priorityDot: Record<string, string> = { low: "bg-muted-foreground", medium: "bg-warning", high: "bg-destructive" };

export default function Tasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { data: users } = useUsers();
  const { user } = useAuth();
  const { canWrite } = usePermission();
  const canWriteTasks = canWrite("tasks");
  const { data: taskStatusesRaw = [] } = useTaskStatuses();

  // Status-Helpers aus dynamischen task_statuses
  const taskStatuses = taskStatusesRaw.map((s) => s.slug).filter((s): s is string => !!s);
  const taskStatusLabel: Record<string, string> = {};
  taskStatusesRaw.forEach((s) => { if (s.slug) taskStatusLabel[s.slug] = s.name; });
  const statusBadge: Record<string, string> = {};
  taskStatusesRaw.forEach((s, i) => {
    if (!s.slug) return;
    const colors = ["bg-secondary text-secondary-foreground", "bg-primary/10 text-primary", "bg-warning/10 text-warning", "bg-success/10 text-success"];
    statusBadge[s.slug] = colors[i % colors.length];
  });
  const doneSlug = taskStatusesRaw[taskStatusesRaw.length - 1]?.slug ?? "done";

  // Filter-State — Owner default = eingeloggter User
  const [filterUser, setFilterUser] = useState<string>(user?.id ?? "all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusChangeSheet, setStatusChangeSheet] = useState<{ open: boolean; taskId: string; currentStatus: string }>({
    open: false, taskId: "", currentStatus: "",
  });

  // Tasks-Query — Owner nur via owner_user_id, Auflösung clientseitig via useUsers() (RLS-bypass via list_team_members).
  // Kunde wird über project.company aufgelöst (project_id ist FK, companies via embed).
  const { data: tasks } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, task_type, assigned_user_id, project_id, created_at, project:projects!tasks_project_id_fkey(id, title, company:companies(name))")
        .is("parent_task_id", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Distinct Aufgabenarten aus der DB (für Filter-Dropdown)
  const distinctTaskTypes = useMemo(() => {
    if (!tasks) return [];
    const set = new Set<string>();
    tasks.forEach((t) => { if (t.task_type) set.add(t.task_type); });
    return Array.from(set).sort();
  }, [tasks]);

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === doneSlug) updates.completed_at = new Date().toISOString();
      else updates.completed_at = null;
      const { error } = await supabase.from("tasks").update(updates as any).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["project-tasks"] });
      qc.invalidateQueries({ queryKey: ["project-task-counts"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const filtered = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      if (filterUser !== "all" && t.assigned_user_id !== filterUser) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterType !== "all") {
        if (filterType === "__none__" ? t.task_type : t.task_type !== filterType) return false;
      }
      return true;
    });
  }, [tasks, filterUser, filterStatus, filterType]);

  const today = startOfDay(new Date());
  const dueState = (due: string | null, status: string): "overdue" | "today" | "future" | "none" => {
    if (!due) return "none";
    if (status === doneSlug) return "future";
    const d = new Date(due);
    if (isBefore(d, today)) return "overdue";
    if (isSameDay(d, today)) return "today";
    return "future";
  };
  const rowBg: Record<string, string> = {
    overdue: "bg-destructive/5 hover:bg-destructive/10",
    today: "bg-warning/5 hover:bg-warning/10",
    future: "hover:bg-muted/50",
    none: "hover:bg-muted/50",
  };
  const dueLabelClass: Record<string, string> = {
    overdue: "text-destructive font-medium",
    today: "text-warning font-medium",
    future: "text-foreground",
    none: "text-muted-foreground",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-[28px] font-semibold text-foreground">Tasks</h1>
        {canWriteTasks && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1 min-h-[44px]">
            <Plus className="h-4 w-4" /> Neuer Task
          </Button>
        )}
      </div>

      {/* Filter-Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-full min-h-[44px] bg-card"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Owner</SelectItem>
            {users?.map((u) => (
              <SelectItem key={u.id} value={u.id} className="min-h-[44px]">
                {u.first_name} {u.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full min-h-[44px] bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Status</SelectItem>
            {taskStatuses.map((s) => (
              <SelectItem key={s} value={s} className="min-h-[44px]">{taskStatusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full min-h-[44px] bg-card"><SelectValue placeholder="Aufgabenart" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Aufgabenarten</SelectItem>
            {distinctTaskTypes.map((t) => (
              <SelectItem key={t} value={t} className="min-h-[44px]">{t}</SelectItem>
            ))}
            <SelectItem value="__none__" className="min-h-[44px]">Ohne Aufgabenart</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Card-Liste (kein Kanban mehr — Liste auch hier) */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Tasks gefunden.</p>
          ) : filtered.map((task) => {
            const project = task.project as { id: string; title: string; company: { name: string } | null } | null;
            const company = project?.company?.name ?? null;
            const owner = users?.find((u) => u.id === task.assigned_user_id) ?? null;
            const ds = dueState(task.due_date, task.status);
            return (
              <MobileCard
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                title={task.title}
                subtitle={company ?? project?.title ?? undefined}
                className={cn(task.status === doneSlug && "opacity-60", ds === "overdue" && "border-destructive/30", ds === "today" && "border-warning/40")}
                badge={
                  <button
                    onClick={(e) => { e.stopPropagation(); if (canWriteTasks) setStatusChangeSheet({ open: true, taskId: task.id, currentStatus: task.status }); }}
                    className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusBadge[task.status])}
                  >
                    {taskStatusLabel[task.status] ?? task.status}
                  </button>
                }
                rightContent={
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {task.priority && <span className={cn("h-2 w-2 rounded-full", priorityDot[task.priority] ?? priorityDot.medium)} />}
                    {task.due_date && (
                      <span className={cn("text-[11px]", dueLabelClass[ds])}>{format(new Date(task.due_date), "dd.MM")}</span>
                    )}
                    {owner && (
                      <span className="text-[10px] text-muted-foreground">{owner.first_name?.[0]}{owner.last_name?.[0]}</span>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        /* Desktop: chronologische Liste */
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aufgabentitel</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Fällig am</TableHead>
                <TableHead>Aufgabenart</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Keine Tasks gefunden.</TableCell></TableRow>
              ) : filtered.map((task) => {
                const project = task.project as { id: string; title: string; company: { name: string } | null } | null;
                const company = project?.company?.name ?? null;
                const owner = users?.find((u) => u.id === task.assigned_user_id) ?? null;
                const ds = dueState(task.due_date, task.status);
                return (
                  <TableRow
                    key={task.id}
                    className={cn("cursor-pointer h-[56px]", rowBg[ds], task.status === doneSlug && "opacity-60")}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <TableCell className={cn("font-medium", task.status === doneSlug && "line-through")}>{task.title}</TableCell>
                    <TableCell>
                      {company ? (
                        <div className="leading-tight">
                          <div className="font-medium text-foreground">{company}</div>
                          {project?.title && <div className="text-[11px] text-muted-foreground">{project.title}</div>}
                        </div>
                      ) : project?.title ? (
                        <span className="text-muted-foreground">{project.title}</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className={dueLabelClass[ds]}>
                      {task.due_date ? format(new Date(task.due_date), "dd.MM.yyyy") : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{task.task_type ?? "–"}</TableCell>
                    <TableCell>{owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "–"}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", statusBadge[task.status])}>
                        {taskStatusLabel[task.status] ?? task.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Status-Change Bottom-Sheet (Mobile) */}
      <Sheet open={statusChangeSheet.open} onOpenChange={(open) => setStatusChangeSheet((p) => ({ ...p, open }))}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle className="text-left">Status ändern</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4 pb-4">
            {taskStatuses.map((s) => (
              <Button
                key={s}
                variant={s === statusChangeSheet.currentStatus ? "default" : "outline"}
                className="w-full justify-start min-h-[48px]"
                onClick={() => {
                  if (s !== statusChangeSheet.currentStatus) moveTaskMutation.mutate({ taskId: statusChangeSheet.taskId, status: s });
                  setStatusChangeSheet({ open: false, taskId: "", currentStatus: "" });
                }}
              >
                <span className={cn("mr-2 h-2 w-2 rounded-full", statusBadge[s]?.split(" ")[0])} />
                {taskStatusLabel[s]}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <TaskDetailSheet taskId={selectedTaskId} open={!!selectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} />
      <CreateTaskSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
