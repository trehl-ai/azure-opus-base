import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { CreateProjectSheet } from "@/components/projects/CreateProjectSheet";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, LayoutGrid, List, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statuses = ["new", "planned", "in_progress", "blocked", "review", "completed"] as const;
const statusLabel: Record<string, string> = {
  new: "New", planned: "Planned", in_progress: "In Progress", blocked: "Blocked", review: "Review", completed: "Completed",
};
const statusBadge: Record<string, string> = {
  new: "bg-info/10 text-info", planned: "bg-secondary text-secondary-foreground", in_progress: "bg-primary/10 text-primary",
  blocked: "bg-destructive/10 text-destructive", review: "bg-warning/10 text-warning", completed: "bg-success/10 text-success",
};
const columnBg: Record<string, string> = {
  blocked: "bg-destructive/5 border-destructive/20", completed: "bg-success/5 border-success/20",
};
const priorityBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-warning/10 text-warning", high: "bg-destructive/10 text-destructive",
};

export default function Projects() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { user } = useAuth();
  const { canWrite, role } = usePermission();
  const canWriteProjects = canWrite("projects");
  const showOwnerToggle = role === "project_manager";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState(showOwnerToggle ? (user?.id ?? "all") : "all");
  const [showAll, setShowAll] = useState(!showOwnerToggle);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortCol, setSortCol] = useState<string>("title");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: projects } = useQuery({
    queryKey: ["projects", statusFilter, ownerFilter, priorityFilter],
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select("*, company:companies(name), owner:users!projects_owner_user_id_fkey(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const effectiveOwner = showOwnerToggle && !showAll ? (user?.id ?? ownerFilter) : ownerFilter;
      if (effectiveOwner !== "all") q = q.eq("owner_user_id", effectiveOwner);
      if (priorityFilter !== "all") q = q.eq("priority", priorityFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const projectIds = projects?.map((p) => p.id) ?? [];
  const { data: taskCounts } = useQuery({
    queryKey: ["project-task-counts", projectIds.join(",")],
    queryFn: async () => {
      if (projectIds.length === 0) return {};
      const { data, error } = await supabase
        .from("tasks")
        .select("project_id, status")
        .in("project_id", projectIds)
        .neq("status", "done");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((t) => { counts[t.project_id] = (counts[t.project_id] ?? 0) + 1; });
      return counts;
    },
    enabled: projectIds.length > 0,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "completed") updates.end_date = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => { if (!canWriteProjects) { e.preventDefault(); return; } e.dataTransfer.setData("projectId", id); }, [canWriteProjects]);
  const handleDrop = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId");
    if (!projectId) return;
    const project = projects?.find((p) => p.id === projectId);
    if (!project || project.status === status) return;
    moveMutation.mutate({ projectId, status });
  }, [projects, moveMutation]);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const projectsByStatus = new Map<string, typeof projects>();
  projects?.forEach((p) => {
    const list = projectsByStatus.get(p.status) ?? [];
    list.push(p);
    projectsByStatus.set(p.status, list);
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); }
  };

  const sortedProjects = [...(projects ?? [])].sort((a, b) => {
    const va = (a as any)[sortCol] ?? "";
    const vb = (b as any)[sortCol] ?? "";
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] font-semibold text-foreground">Projects</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("board")} className={cn("px-3 py-1.5 text-sm", view === "board" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")} className={cn("px-3 py-1.5 text-sm", view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50")}>
              <List className="h-4 w-4" />
            </button>
          </div>
          {canWriteProjects && <Button onClick={() => setSheetOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Neues Projekt</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Owner</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Alle Prio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === "board" && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {statuses.map((status) => {
              const statusProjects = projectsByStatus.get(status) ?? [];
              const bgClass = columnBg[status] ?? "bg-[#F0F1F5] border-transparent";
              return (
                <div key={status} className={cn("flex w-[270px] shrink-0 flex-col rounded-xl border p-3", bgClass)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                  <div className="mb-3 px-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold text-foreground">{statusLabel[status]}</h3>
                      <span className="text-[11px] font-medium text-muted-foreground">{statusProjects.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 min-h-[60px]">
                    {statusProjects.map((p) => {
                      const company = p.company as { name: string } | null;
                      const owner = p.owner as { first_name: string; last_name: string } | null;
                      return (
                        <ProjectCard
                          key={p.id}
                          project={{
                            id: p.id, title: p.title, company_name: company?.name ?? null,
                            priority: p.priority, owner_first_name: owner?.first_name ?? null,
                            owner_last_name: owner?.last_name ?? null, start_date: p.start_date,
                            end_date: p.end_date, open_tasks: taskCounts?.[p.id] ?? 0, status: p.status,
                          }}
                          onDragStart={handleDragStart}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  { key: "title", label: "Projektname" },
                  { key: "company", label: "Unternehmen" },
                  { key: "status", label: "Status" },
                  { key: "priority", label: "Priorität" },
                  { key: "owner", label: "Owner" },
                  { key: "start_date", label: "Start" },
                  { key: "end_date", label: "Ende" },
                ].map((col) => (
                  <TableHead key={col.key} className="cursor-pointer select-none" onClick={() => toggleSort(col.key)}>
                    <div className="flex items-center gap-1">{col.label}<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </TableHead>
                ))}
                <TableHead>Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((p) => {
                const company = p.company as { name: string } | null;
                const owner = p.owner as { first_name: string; last_name: string } | null;
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30 h-[52px]" onClick={() => navigate(`/projects/${p.id}`)}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{company?.name ?? "–"}</TableCell>
                    <TableCell><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", statusBadge[p.status])}>{statusLabel[p.status]}</span></TableCell>
                    <TableCell><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", priorityBadge[p.priority ?? "medium"])}>{p.priority ?? "medium"}</span></TableCell>
                    <TableCell>{owner ? `${owner.first_name} ${owner.last_name}` : "–"}</TableCell>
                    <TableCell>{p.start_date ? format(new Date(p.start_date), "dd.MM.yyyy") : "–"}</TableCell>
                    <TableCell>{p.end_date ? format(new Date(p.end_date), "dd.MM.yyyy") : "–"}</TableCell>
                    <TableCell>{taskCounts?.[p.id] ?? 0}</TableCell>
                  </TableRow>
                );
              })}
              {sortedProjects.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Projekte gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateProjectSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
