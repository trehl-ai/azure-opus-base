import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Handshake, TrendingUp, Trophy, FolderKanban } from "lucide-react";
import { format, isBefore, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { KPICardSkeleton, TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  useDashboardDeals,
  useDashboardProjects,
  useDashboardOverdueTasks,
  useDashboardMyTasks,
  useDashboardOpenActivities,
  useDashboardDefaultStages,
} from "@/hooks/queries";

const eur = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default function Dashboard() {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const { data: deals, isLoading: dealsLoading, error: dealsError } = useDashboardDeals();
  const { data: projects, isLoading: projectsLoading } = useDashboardProjects();
  const { data: overdueTasks } = useDashboardOverdueTasks();
  const { data: myTasks } = useDashboardMyTasks(user?.id);
  const { data: openActivities } = useDashboardOpenActivities();
  const { data: defaultStages } = useDashboardDefaultStages();

  const openDeals = useMemo(() => deals?.filter((d) => d.status === "open") ?? [], [deals]);
  const pipelineValue = useMemo(() => openDeals.reduce((s, d) => s + (Number(d.value_amount) || 0), 0), [openDeals]);
  const wonThisMonth = useMemo(() => deals?.filter((d) => d.status === "won" && d.won_at && new Date(d.won_at) >= monthStart && new Date(d.won_at) <= monthEnd).length ?? 0, [deals, monthStart, monthEnd]);
  const activeProjects = useMemo(() => projects?.filter((p) => ["new", "planned", "in_progress", "blocked", "review"].includes(p.status)).length ?? 0, [projects]);

  const dealsNoActivity = useMemo(() => {
    if (!openActivities) return [];
    return openDeals.filter((d) => !openActivities.has(d.id)).slice(0, 5);
  }, [openDeals, openActivities]);

  const pipelineChart = useMemo(() => {
    if (!defaultStages || !openDeals.length) return [];
    return defaultStages.map((s) => {
      const stageDeals = openDeals.filter((d) => d.pipeline_stage_id === s.id);
      return { name: s.name, deals: stageDeals.length, value: stageDeals.reduce((sum, d) => sum + (Number(d.value_amount) || 0), 0) };
    });
  }, [defaultStages, openDeals]);

  const projectChart = useMemo(() => {
    if (!projects) return [];
    const counts: Record<string, number> = {};
    projects.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    const labels: Record<string, string> = { new: "New", planned: "Planned", in_progress: "In Progress", blocked: "Blocked", review: "Review", completed: "Completed" };
    const colors: Record<string, string> = { new: "hsl(228,33%,93%)", planned: "hsl(237,87%,59%)", in_progress: "hsl(237,68%,54%)", blocked: "hsl(0,84%,60%)", review: "hsl(38,92%,50%)", completed: "hsl(142,71%,45%)" };
    return Object.entries(counts).map(([k, v]) => ({ name: labels[k] ?? k, value: v, color: colors[k] ?? "hsl(228,33%,93%)" }));
  }, [projects]);

  const statusBadge: Record<string, string> = { todo: "bg-secondary text-secondary-foreground", in_progress: "bg-primary/10 text-primary", review: "bg-warning/10 text-warning", done: "bg-success/10 text-success" };
  const statusLabel: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
  const priorityBadge: Record<string, string> = { low: "bg-muted text-muted-foreground", medium: "bg-warning/10 text-warning", high: "bg-destructive/10 text-destructive" };

  if (dealsError) return <ErrorState error={dealsError as Error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-foreground">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dealsLoading || projectsLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KpiCard icon={Handshake} label="Offene Deals" value={openDeals.length} colorClass="text-primary" bgClass="bg-primary/10" />
            <KpiCard icon={TrendingUp} label="Pipeline-Wert" value={eur(pipelineValue)} colorClass="text-primary" bgClass="bg-primary/10" />
            <KpiCard icon={Trophy} label="Gewonnen (Monat)" value={wonThisMonth} colorClass="text-success" bgClass="bg-success/10" />
            <KpiCard icon={FolderKanban} label="Aktive Projekte" value={activeProjects} colorClass="text-info" bgClass="bg-info/10" />
          </>
        )}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Überfällige Tasks</h2>
            <Link to="/tasks" className="text-[12px] text-primary hover:underline">Alle anzeigen</Link>
          </div>
          {overdueTasks && overdueTasks.length > 0 ? (
            <div className="space-y-2">
              {overdueTasks.map((t) => {
                const proj = t.project as { title: string } | null;
                const assigned = t.assigned as { first_name: string; last_name: string } | null;
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{t.title}</p>
                      <p className="text-[12px] text-muted-foreground">{proj?.title} · {assigned ? `${assigned.first_name} ${assigned.last_name}` : "–"}</p>
                    </div>
                    <span className="text-[12px] font-medium text-destructive shrink-0 ml-3">{t.due_date ? format(new Date(t.due_date), "dd.MM.yyyy") : ""}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground">Keine überfälligen Tasks.</p>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Deals ohne nächste Aktivität</h2>
            <Link to="/deals" className="text-[12px] text-primary hover:underline">Alle anzeigen</Link>
          </div>
          {dealsNoActivity.length > 0 ? (
            <div className="space-y-2">
              {dealsNoActivity.map((d) => {
                const company = d.companies as { name: string } | null;
                const stage = d.stage as { name: string } | null;
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                    <div className="flex-1 min-w-0">
                      <Link to={`/deals/${d.id}`} className="font-medium text-foreground hover:text-primary truncate block">{d.title}</Link>
                      <p className="text-[12px] text-muted-foreground">{company?.name ?? "–"} · {stage?.name ?? "–"}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground shrink-0 ml-3">{eur(Number(d.value_amount) || 0)}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground">Alle Deals haben offene Aktivitäten.</p>}
        </div>
      </div>

      {/* Row 3 - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">Pipeline-Übersicht</h2>
          {pipelineChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineChart} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "hsl(224,15%,60%)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number, name: string) => [name === "deals" ? `${v} Deals` : eur(v), name === "deals" ? "Anzahl" : "Wert"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(228,33%,91%)", fontSize: 13 }} />
                <Bar dataKey="deals" fill="hsl(237,87%,59%)" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">Keine Daten.</p>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">Projekte nach Status</h2>
          {projectChart.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={projectChart} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                    {projectChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} Projekte`]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(228,33%,91%)", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {projectChart.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="text-foreground">{e.name}</span>
                    <span className="text-muted-foreground font-medium">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Keine Projekte.</p>}
        </div>
      </div>

      {/* Row 4 - My Tasks */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-[15px] font-semibold text-foreground mb-4">Meine Aufgaben</h2>
        {myTasks && myTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-[12px] font-medium text-muted-foreground">
                <th className="text-left py-2 pr-4">Titel</th><th className="text-left py-2 pr-4">Projekt</th><th className="text-left py-2 pr-4">Priorität</th><th className="text-left py-2 pr-4">Due Date</th><th className="text-left py-2">Status</th>
              </tr></thead>
              <tbody>
                {myTasks.map((t) => {
                  const proj = t.project as { title: string } | null;
                  const overdue = t.due_date && isBefore(new Date(t.due_date), today) && t.status !== "done";
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0 h-[44px]">
                      <td className="font-medium text-foreground pr-4">{t.title}</td>
                      <td className="text-muted-foreground pr-4">{proj?.title ?? "–"}</td>
                      <td className="pr-4"><span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", priorityBadge[t.priority ?? "medium"])}>{t.priority ?? "medium"}</span></td>
                      <td className={cn("pr-4", overdue && "text-destructive font-medium")}>{t.due_date ? format(new Date(t.due_date), "dd.MM.yyyy") : "–"}</td>
                      <td><span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", statusBadge[t.status])}>{statusLabel[t.status] ?? t.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">Keine offenen Aufgaben.</p>}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, colorClass, bgClass }: { icon: React.ElementType; label: string; value: string | number; colorClass: string; bgClass: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mb-3", bgClass)}>
        <Icon className={cn("h-5 w-5", colorClass)} />
      </div>
      <p className="text-[28px] font-bold text-foreground leading-tight">{value}</p>
      <p className="text-[13px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
