import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileCard } from "@/components/shared/MobileCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, FileText, CheckSquare, Calendar, Users, MessageSquare } from "lucide-react";
import { format, isBefore, isSameDay, startOfDay, isToday, isPast, isThisWeek, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ActivityDetailSheet, type ActivityDetail } from "@/components/tasks/ActivityDetailSheet";

// Reine Activity-View — Quelle ist ausschliesslich deal_activities.
type UnifiedTodo = {
  id: string;
  title: string;
  due_date: string | null;
  owner_user_id: string | null;
  type: string | null;         // activity_type
  status: string;
  company: string | null;
  deal_id: string | null;
  deal_title: string | null;
  description: string | null;
  contact_id: string | null;
  created_by_user_id: string | null;
};

// Type-Icons 1:1 aus Activities.tsx — ersetzen das frühere Source-Badge.
const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  note: FileText,
  task: CheckSquare,
  meeting: Calendar,
  briefing: Users,
  casting: Users,
};
const ACTIVITY_COLORS: Record<string, string> = {
  call: "text-blue-500",
  email: "text-purple-500",
  note: "text-gray-500",
  task: "text-orange-500",
  meeting: "text-green-500",
  briefing: "text-pink-500",
  casting: "text-yellow-500",
};

// Zeitfilter (portiert aus Activities.tsx).
type TimeFilter = "all" | "today" | "overdue" | "week";
const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "today", label: "Heute" },
  { key: "overdue", label: "Überfällig" },
  { key: "week", label: "Diese Woche" },
];

const isDone = (status: string) => status === "completed";

export default function Tasks() {
  const isMobile = useIsMobile();
  const { data: users } = useUsers();
  const { user } = useAuth();

  // Filter-State — Owner default = eingeloggter User.
  // Umut's activities are attributed to Tomas in the DB, so the default
  // "my items" filter would hide everything. Default him to "all" instead.
  const UMUT_USER_ID = "c1c7b986-21e7-4371-9226-c54a03d59ecf";
  const isUmut = user?.id === UMUT_USER_ID;
  const [filterUser, setFilterUser] = useState<string>(isUmut ? "all" : (user?.id ?? "all"));
  const [filterType, setFilterType] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selectedActivity, setSelectedActivity] = useState<ActivityDetail | null>(null);

  // Deal-Activities-Query — nur offene. deal_activities ist die EINZIGE Quelle.
  const { data: activitiesRaw } = useQuery({
    queryKey: ["open-activities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deal_activities")
        .select("id, title, status, due_date, activity_type, owner_user_id, created_by_user_id, deal_id, description, contact_id, deal:deals(title, company:companies(name))")
        .is("deleted_at", null)
        .or("status.eq.open,status.is.null");
      if (error) throw error;
      return data;
    },
  });

  // deal_activities → UnifiedTodo
  const unified: UnifiedTodo[] = useMemo(() => {
    const out: UnifiedTodo[] = [];
    (activitiesRaw ?? []).forEach((a) => {
      const deal = a.deal as unknown as { title: string | null; company: { name: string } | null } | null;
      out.push({
        id: a.id,
        title: a.title,
        due_date: a.due_date ?? null,
        owner_user_id: a.owner_user_id ?? null,
        type: a.activity_type ?? null,
        status: a.status ?? "open",
        company: deal?.company?.name ?? null,
        deal_id: a.deal_id ?? null,
        deal_title: deal?.title ?? null,
        description: a.description ?? null,
        contact_id: a.contact_id ?? null,
        created_by_user_id: a.created_by_user_id ?? null,
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
  }, [activitiesRaw]);

  // Distinct Aufgabenarten (aus activity_type)
  const distinctTypes = useMemo(() => {
    const set = new Set<string>();
    unified.forEach((u) => { if (u.type) set.add(u.type); });
    return Array.from(set).sort();
  }, [unified]);

  const filtered = useMemo(() => {
    return unified.filter((u) => {
      if (filterUser !== "all" && u.owner_user_id !== filterUser) return false;
      if (filterType !== "all") {
        if (filterType === "__none__" ? u.type : u.type !== filterType) return false;
      }
      // Zeitfilter (Heute/Überfällig/Diese Woche) — portiert aus Activities.tsx (date-fns).
      if (timeFilter !== "all") {
        const due = u.due_date ? parseISO(u.due_date) : null;
        if (timeFilter === "today" && (!due || !isToday(due))) return false;
        if (timeFilter === "overdue" && (!due || !isPast(due) || isToday(due) || isDone(u.status))) return false;
        if (timeFilter === "week" && (!due || !isThisWeek(due, { locale: de }))) return false;
      }
      return true;
    });
  }, [unified, filterUser, filterType, timeFilter]);

  const today = startOfDay(new Date());
  const dueState = (due: string | null, status: string): "overdue" | "today" | "future" | "none" => {
    if (!due) return "none";
    if (isDone(status)) return "future";
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

  const typeIcon = (type: string | null) => {
    const I = ACTIVITY_ICONS[type ?? ""] || MessageSquare;
    return <I className={cn("h-4 w-4 shrink-0", ACTIVITY_COLORS[type ?? ""] || "text-muted-foreground")} />;
  };

  const handleRowClick = (item: UnifiedTodo) => {
    setSelectedActivity({
      id: item.id, title: item.title, type: item.type, description: item.description,
      due_date: item.due_date, deal_id: item.deal_id, deal_title: item.deal_title, contact_id: item.contact_id,
      status: item.status, created_by_user_id: item.created_by_user_id,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-[28px] font-semibold text-foreground">Tasks</h1>
      </div>

      {/* Filter-Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
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

      {/* Zeitfilter-Tabs (portiert aus Activities) */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TIME_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={timeFilter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter(f.key)}
            className="min-h-[44px]"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Mobile: Card-Liste */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Einträge gefunden.</p>
          ) : filtered.map((item) => {
            const owner = users?.find((u) => u.id === item.owner_user_id) ?? null;
            const ds = dueState(item.due_date, item.status);
            const subtitle = item.company ?? item.deal_title ?? undefined;
            return (
              <MobileCard
                key={item.id}
                onClick={() => handleRowClick(item)}
                title={item.title}
                subtitle={subtitle}
                className={cn(isDone(item.status) && "opacity-50", ds === "overdue" && "border-destructive/30", ds === "today" && "border-warning/40")}
                badge={typeIcon(item.type)}
                rightContent={
                  <div className="flex flex-col items-end gap-1 shrink-0">
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
                    key={item.id}
                    className={cn("cursor-pointer h-[56px]", rowBg[ds], isDone(item.status) && "opacity-50")}
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className={cn("font-medium", isDone(item.status) && "line-through")}>
                      <div className="flex items-center gap-2">
                        {typeIcon(item.type)}
                        <span className="truncate">{item.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.company ? (
                        <div className="leading-tight">
                          <div className="font-medium text-foreground">{item.company}</div>
                          {item.deal_title && (
                            <div className="text-[11px] text-muted-foreground">{item.deal_title}</div>
                          )}
                        </div>
                      ) : item.deal_title ? (
                        <span className="text-muted-foreground">{item.deal_title}</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className={dueLabelClass[ds]}>
                      {item.due_date ? format(new Date(item.due_date), "dd.MM.yyyy") : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.type ?? "–"}</TableCell>
                    <TableCell>{owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "–"}</TableCell>
                    <TableCell>
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-medium bg-muted text-muted-foreground">{item.status}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ActivityDetailSheet activity={selectedActivity} open={!!selectedActivity} onOpenChange={(open) => { if (!open) setSelectedActivity(null); }} />
    </div>
  );
}
