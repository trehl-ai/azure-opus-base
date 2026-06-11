import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Plus, Eye, EyeOff } from "lucide-react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { CreateTaskSheet } from "@/components/tasks/CreateTaskSheet";

const priorityDot: Record<string, string> = { low: "bg-muted-foreground", medium: "bg-warning", high: "bg-destructive" };

type Source = "task" | "activity";
type UnifiedTodo = {
  id: string;
  source: Source;
  title: string;
  due_date: string | null;
  owner_user_id: string | null;
  type: string | null;       // task_type or activity_type
  status: string;
  company: string | null;
  project_title: string | null;
  deal_id: string | null;
  deal_title: string | null;
  priority: string | null;
};

const sourceBadge: Record<Source, string> = {
  task: "bg-primary/10 text-primary",
  activity: "bg-warning/10 text-warning",
};
const sourceLabel: Record<Source, string> = {
  task: "Task",
  activity: "Aktivität",
};

export default function Tasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
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
  const doneSlug = taskStatusesRaw.find((s) => s.slug === "erledigt")?.slug ?? "erledigt";
  // Default-/Offen-Slug fuer Activity-Status-Mapping (deal_activities nutzen open/completed statt Slugs)
  const offenSlug = taskStatusesRaw.find((s) => s.is_default)?.slug ?? "offen";

  // Filter-State — Owner default = eingeloggter User.
  // Umut's tasks/activities are attributed to Tomas in the DB, so the default
  // "my items" filter would hide everything. Default him to "all" instead.
  const UMUT_USER_ID = "c1c7b986-21e7-4371-9226-c54a03d59ecf";
  const isUmut = user?.id === UMUT_USER_ID;
  const [filterUser, setFilterUser] = useState<string>(isUmut ? "all" : (user?.id ?? "all"));
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false); // erledigte Tasks default ausblenden
  const [statusChangeSheet, setStatusChangeSheet] = useState<{ open: boolean; taskId: string; currentStatus: string }>({
    open: false, taskId: "", currentStatus: "",
  });

  // Tasks-Query
  const { data: tasksRaw } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, task_type, assigned_user_id, project_id, deal_id, project:projects!tasks_project_id_fkey(title, company:companies(name)), deal:deals!tasks_deal_id_fkey(title, company:companies(name))")
        .is("parent_task_id", null);
      if (error) throw error;
      return data as any;
    },
  });

  // Deal-Activities-Query — nur offene
  const { data: activitiesRaw } = useQuery({
    queryKey: ["open-activities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deal_activities")
        .select("id, title, status, due_date, activity_type, owner_user_id, deal_id, deal:deals(title, company:companies(name))")
        .is("deleted_at", null)
        .or("status.eq.open,status.is.null");
      if (error) throw error;
      return data;
    },
  });

  // Client-side merge nach UnifiedTodo
  const unified: UnifiedTodo[] = useMemo(() => {
    const out: UnifiedTodo[] = [];
    (tasksRaw ?? []).forEach((t) => {
      const project = t.project as { title: string | null; company: { name: string } | null } | null;
      const deal = t.deal as { title: string | null; company: { name: string } | null } | null;
      out.push({
        id: t.id,
        source: "task",
        title: t.title,
        due_date: t.due_date ?? null,
        owner_user_id: t.assigned_user_id ?? null,
        type: t.task_type ?? null,
        status: t.status,
        company: deal?.company?.name ?? project?.company?.name ?? null,
        project_title: project?.title ?? null,
        deal_id: t.deal_id ?? null,
        deal_title: deal?.title ?? null,
        priority: t.priority ?? null,
      });
    });
    (activitiesRaw ?? []).forEach((a) => {
      const deal = a.deal as unknown as { title: string | null; company: { name: string } | null } | null;
      out.push({
        id: a.id,
        source: "activity",
        title: a.title,
        due_date: a.due_date ?? null,
        owner_user_id: a.owner_user_id ?? null,
        type: a.activity_type ?? null,
        status: a.status ?? "open",
        company: deal?.company?.name ?? null,
        project_title: null,
        deal_id: a.deal_id ?? null,
        deal_title: deal?.title ?? null,
        priority: null,
      });
    });
    // due_date ASC NULLS LAST
    out.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
    return out;
  }, [tasksRaw, activitiesRaw]);

  // Distinct Aufgabenarten (vereint aus task_type + activity_type)
  const distinctTypes = useMemo(() => {
    const set = new Set<string>();
    unified.forEach((u) => { if (u.type) set.add(u.type); });
    return Array.from(set).sort();
  }, [unified]);

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
    return unified.filter((u) => {
      // Erledigte Tasks (doneSlug = "erledigt") default ausblenden — ausser Toggle an oder explizit danach gefiltert
      if (!showCompleted && u.source === "task" && u.status === doneSlug && filterStatus !== doneSlug) return false;
      if (filterUser !== "all" && u.owner_user_id !== filterUser) return false;
      // deal_activities haben ein eigenes Status-Vokabular (open/completed/sent) statt task_statuses-Slugs.
      // 1:1 auf Slugs mappen, damit Activities beim Status-Filter nicht pauschal verschwinden: open->offen, completed->erledigt.
      if (filterStatus !== "all") {
        const effStatus = u.source === "task" ? u.status : (u.status === "completed" ? doneSlug : offenSlug);
        if (effStatus !== filterStatus) return false;
      }
      if (filterType !== "all") {
        if (filterType === "__none__" ? u.type : u.type !== filterType) return false;
      }
      return true;
    });
  }, [unified, filterUser, filterStatus, filterType, showCompleted, doneSlug, offenSlug]);

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

  const handleRowClick = (item: UnifiedTodo) => {
    if (item.source === "task") setSelectedTaskId(item.id);
    else if (item.deal_id) navigate(`/deals/${item.deal_id}`);
  };

  const renderStatusBadge = (item: UnifiedTodo) => {
    if (item.source === "activity") {
      return <span className="rounded-full px-2.5 py-0.5 text-[12px] font-medium bg-muted text-muted-foreground">{item.status}</span>;
    }
    return (
      <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", statusBadge[item.status])}>
        {taskStatusLabel[item.status] ?? item.status}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-[28px] font-semibold text-foreground">Tasks</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showCompleted ? "default" : "outline"}
            onClick={() => setShowCompleted((v) => !v)}
            className="gap-1 min-h-[44px]"
            aria-pressed={showCompleted}
          >
            {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Erledigte {showCompleted ? "ausblenden" : "anzeigen"}
          </Button>
          {canWriteTasks && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1 min-h-[44px]">
              <Plus className="h-4 w-4" /> Neuer Task
            </Button>
          )}
        </div>
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
            {distinctTypes.map((t) => (
              <SelectItem key={t} value={t} className="min-h-[44px]">{t}</SelectItem>
            ))}
            <SelectItem value="__none__" className="min-h-[44px]">Ohne Aufgabenart</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Card-Liste */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Einträge gefunden.</p>
          ) : filtered.map((item) => {
            const owner = users?.find((u) => u.id === item.owner_user_id) ?? null;
            const ds = dueState(item.due_date, item.status);
            const subtitle = item.company ?? item.deal_title ?? item.project_title ?? undefined;
            return (
              <MobileCard
                key={`${item.source}-${item.id}`}
                onClick={() => handleRowClick(item)}
                title={item.title}
                subtitle={subtitle}
                className={cn(item.status === doneSlug && "opacity-50", ds === "overdue" && "border-destructive/30", ds === "today" && "border-warning/40")}
                badge={
                  item.source === "task" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (canWriteTasks) setStatusChangeSheet({ open: true, taskId: item.id, currentStatus: item.status }); }}
                      className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusBadge[item.status])}
                    >
                      {taskStatusLabel[item.status] ?? item.status}
                    </button>
                  ) : (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", sourceBadge.activity)}>
                      {sourceLabel.activity}
                    </span>
                  )
                }
                rightContent={
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.priority && <span className={cn("h-2 w-2 rounded-full", priorityDot[item.priority] ?? priorityDot.medium)} />}
                    {item.due_date && (
                      <span className={cn("text-[11px]", dueLabelClass[ds])}>{format(new Date(item.due_date), "dd.MM")}</span>
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
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Keine Einträge gefunden.</TableCell></TableRow>
              ) : filtered.map((item) => {
                const owner = users?.find((u) => u.id === item.owner_user_id) ?? null;
                const ds = dueState(item.due_date, item.status);
                return (
                  <TableRow
                    key={`${item.source}-${item.id}`}
                    className={cn("cursor-pointer h-[56px]", rowBg[ds], item.status === doneSlug && "opacity-50")}
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className={cn("font-medium", item.status === doneSlug && "line-through")}>
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", sourceBadge[item.source])}>
                          {sourceLabel[item.source]}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.company ? (
                        <div className="leading-tight">
                          <div className="font-medium text-foreground">{item.company}</div>
                          {(item.deal_title || item.project_title) && (
                            <div className="text-[11px] text-muted-foreground">
                              {item.deal_title ?? item.project_title}
                            </div>
                          )}
                        </div>
                      ) : item.deal_title ?? item.project_title ? (
                        <span className="text-muted-foreground">{item.deal_title ?? item.project_title}</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className={dueLabelClass[ds]}>
                      {item.due_date ? format(new Date(item.due_date), "dd.MM.yyyy") : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.type ?? "–"}</TableCell>
                    <TableCell>{owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "–"}</TableCell>
                    <TableCell>{renderStatusBadge(item)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Status-Change Bottom-Sheet (Mobile) — nur für Tasks */}
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
