import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { Handshake, Trophy, Percent, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDashboardStats,
  type HoverCompanyValue,
  type HoverCompanyExpected,
} from "@/hooks/useDashboardStats";

const PIPELINE_COLOR_MAP: Record<string, string> = {
  Erlebniswelten: "#8b5cf6",
  "Viktoria Rebensburg - Industrie": "#f59e0b",
  "Corporate Events": "#3b82f6",
  "Werteraum - Schulen": "#10b981",
  Ausschreibungen: "#6b7280",
};
const PIPELINE_FALLBACK_COLOR = "#94a3b8";

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurCompactFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  notation: "compact",
});

function getGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

type LeadScoreTier = "hot" | "warm" | "medium" | "cold";

function getLeadScoreTier(score: number | null | undefined): LeadScoreTier {
  if (score == null) return "cold";
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "medium";
  return "cold";
}

const LEAD_TIER_STYLES: Record<
  LeadScoreTier,
  { label: string; bg: string; text: string }
> = {
  hot: { label: "HOT", bg: "bg-[#ef4444]", text: "text-white" },
  warm: { label: "WARM", bg: "bg-[#f97316]", text: "text-white" },
  medium: { label: "MEDIUM", bg: "bg-[#eab308]", text: "text-black" },
  cold: { label: "COLD", bg: "bg-[#94a3b8]", text: "text-white" },
};

type TopLead = {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  lead_score: number | null;
};

type RecentActivity = {
  id: string;
  activity_type: string | null;
  description: string | null;
  created_at: string;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading } = useDashboardStats();

  const today = useMemo(
    () => format(new Date(), "EEEE, d. MMMM yyyy", { locale: de }),
    [],
  );
  const greeting = useMemo(() => getGreeting(), []);

  const { data: topLeads, isLoading: topLeadsLoading } = useQuery<TopLead[]>({
    queryKey: ["dashboard_top_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("first_name, last_name, company, job_title, lead_score")
        .eq("source", "ssteo_import")
        .order("lead_score", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as TopLead[];
    },
    staleTime: 60_000,
  });

  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<
    RecentActivity[]
  >({
    queryKey: ["dashboard_recent_activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("id, activity_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as RecentActivity[];
    },
    staleTime: 60_000,
  });

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-canvas p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-brand">
          EO IPSO CRM
        </h1>
        <p className="text-[14px] text-muted-foreground">
          {greeting} · <span className="capitalize">{today}</span>
        </p>
      </header>

      {/* Block 1 — KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTooltip
          title="Top Pipeline-Companies"
          rows={stats?.hover_pipeline_companies ?? []}
          variant="value"
        >
          <KpiCard
            icon={Handshake}
            label="Pipeline-Wert"
            value={loading ? null : eurFormatter.format(stats?.pipeline_value ?? 0)}
            subtext={
              stats ? `${(stats.deal_count ?? 0).toLocaleString("de-DE")} aktive Deals` : undefined
            }
            tone="brand"
            onClick={() => navigate("/deals")}
          />
        </KpiTooltip>
        <KpiTooltip
          title="Top gewonnene Companies"
          rows={stats?.hover_won_companies ?? []}
          variant="value"
        >
          <KpiCard
            icon={Trophy}
            label="Gewonnen"
            value={loading ? null : eurFormatter.format(stats?.won_value ?? 0)}
            subtext="Porsche Museum abgeschlossen"
            tone="success"
          />
        </KpiTooltip>
        <KpiTooltip
          title="Top Companies nach erwartetem Wert"
          rows={stats?.hover_probability_companies ?? []}
          variant="expected"
        >
          <KpiCard
            icon={Percent}
            label="Ø Wahrscheinlichkeit"
            value={loading ? null : eurFormatter.format(stats?.expected_value ?? 0)}
            subtext={
              loading
                ? undefined
                : `${stats?.weighted_probability ?? 0}% gewichtete Wahrscheinlichkeit`
            }
            tone="gold"
          />
        </KpiTooltip>
        <KpiCard
          icon={Users}
          label="Kontakte"
          value={
            loading ? null : (stats?.contact_count ?? 0).toLocaleString("de-DE")
          }
          subtext={
            stats
              ? `${(stats.company_count ?? 0).toLocaleString("de-DE")} Unternehmen`
              : undefined
          }
          tone="brand"
          onClick={() => navigate("/contacts")}
        />
      </section>

      {/* Block 2 — Pipeline Wert Chart */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">
            Pipeline-Wert nach Pipeline
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Summe der Deal-Werte je Pipeline
          </p>
        </div>
        {loading ? (
          <Skeleton className="h-[300px] rounded-lg" />
        ) : !stats || stats.pipeline_breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Pipeline-Daten verfügbar.
          </p>
        ) : (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[...stats.pipeline_breakdown].sort(
                  (a, b) => b.total_value - a.total_value,
                )}
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => eurCompactFormatter.format(v)}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  tick={{ fontSize: 12, fill: "#374151" }}
                />
                <Tooltip content={<PipelineTooltip />} />
                <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
                  {stats.pipeline_breakdown.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        PIPELINE_COLOR_MAP[entry.name] ?? PIPELINE_FALLBACK_COLOR
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Block 3 — Lead Score Distribution */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LeadScoreCard
          dot="🔴"
          label="Hot"
          range="80+"
          count={stats?.hot_leads ?? 0}
          color="#ef4444"
          loading={loading}
        />
        <LeadScoreCard
          dot="🟠"
          label="Warm"
          range="60–79"
          count={stats?.warm_leads ?? 0}
          color="#f97316"
          loading={loading}
        />
        <LeadScoreCard
          dot="🟡"
          label="Medium"
          range="40–59"
          count={stats?.medium_leads ?? 0}
          color="#eab308"
          loading={loading}
        />
        <LeadScoreCard
          dot="⚪"
          label="Cold"
          range="<40"
          count={stats?.cold_leads ?? 0}
          color="#94a3b8"
          loading={loading}
        />
      </section>

      {/* Block 4 — Top 10 Leads */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">
            Top 10 Leads
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Aus ssteo_import — sortiert nach Lead Score
          </p>
        </div>
        {topLeadsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : !topLeads || topLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Leads gefunden.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Unternehmen</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLeads.map((lead, i) => {
                const tier = getLeadScoreTier(lead.lead_score);
                const styles = LEAD_TIER_STYLES[tier];
                const fullName =
                  [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
                  "—";
                return (
                  <TableRow key={`${fullName}-${i}`}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{lead.company ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.job_title ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          styles.bg,
                          styles.text,
                        )}
                      >
                        {styles.label}
                        <span className="opacity-90">
                          {lead.lead_score ?? 0}
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Block 5 — Recent Activities */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">
            Letzte Aktivitäten
          </h2>
        </div>
        {activitiesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : !recentActivities || recentActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Aktivitäten erfasst.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentActivities.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-foreground truncate">
                    {a.activity_type ?? "Aktivität"}
                  </p>
                  {a.description && (
                    <p className="text-[12px] text-muted-foreground line-clamp-1">
                      {a.description}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                  {formatDistanceToNow(new Date(a.created_at), {
                    addSuffix: true,
                    locale: de,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  subtext?: string;
  tone: "brand" | "gold" | "success" | "danger";
  onClick?: () => void;
}) {
  const toneStyles =
    tone === "brand"
      ? "bg-brand-soft text-brand"
      : tone === "gold"
        ? "bg-gold-soft text-gold"
        : tone === "success"
          ? "bg-[#10b981]/10 text-[#10b981]"
          : "bg-destructive/10 text-destructive";

  const valueStyles =
    tone === "success" ? "text-[#10b981]" : "text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full h-full text-left rounded-[12px] border border-border bg-card shadow-sm p-5 transition-all",
        onClick && "hover:border-brand hover:shadow-md cursor-pointer",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl mb-3",
          toneStyles,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      {value === null ? (
        <Skeleton className="h-9 w-32" />
      ) : (
        <p
          className={cn(
            "text-[28px] font-bold leading-tight tabular-nums",
            valueStyles,
          )}
        >
          {value}
        </p>
      )}
      <p className="text-[13px] text-muted-foreground mt-1">{label}</p>
      {subtext && (
        <p className="text-[11px] text-muted-foreground mt-2">{subtext}</p>
      )}
    </button>
  );
}

function LeadScoreCard({
  dot,
  label,
  range,
  count,
  color,
  loading,
}: {
  dot: string;
  label: string;
  range: string;
  count: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      className="rounded-[12px] border bg-card shadow-sm p-5"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden>{dot}</span>
        <span
          className="text-[12px] font-semibold uppercase tracking-wide tabular-nums"
          style={{ color }}
        >
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {range}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-20" />
      ) : (
        <p
          className="text-[28px] font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {count.toLocaleString("de-DE")}
        </p>
      )}
      <p className="text-[12px] text-muted-foreground mt-1.5">Contacts</p>
    </div>
  );
}

function KpiTooltip({
  title,
  rows,
  variant,
  children,
}: {
  title: string;
  rows: HoverCompanyValue[] | HoverCompanyExpected[];
  variant: "value" | "expected";
  children: React.ReactNode;
}) {
  const safeRows = rows ?? [];
  const hasRows = safeRows.length > 0;
  return (
    <div className="relative group h-full">
      {children}
      {hasRows && (
        <div
          role="tooltip"
          className={cn(
            "hidden md:block absolute left-0 top-full mt-2 w-80 z-50",
            "bg-gray-900 text-white rounded-xl shadow-2xl p-4",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100 group-hover:pointer-events-auto",
            "transition-all duration-200",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-300 mb-2">
            {title}
          </p>
          <ul className="max-h-72 overflow-y-auto divide-y divide-gray-800">
            {safeRows.map((r, i) => (
              <li
                key={`${r?.company_name ?? "unknown"}-${i}`}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">
                    {r?.company_name ?? "—"}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {r?.pipeline_name ?? "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-medium tabular-nums">
                    {variant === "expected"
                      ? `${Math.round((r as HoverCompanyExpected)?.expected_value ?? 0).toLocaleString("de-DE")} €`
                      : `${Math.round((r as HoverCompanyValue)?.total_value ?? 0).toLocaleString("de-DE")} €`}
                  </p>
                  {variant === "expected" && (
                    <p className="text-[10px] text-gray-400 tabular-nums">
                      {Math.round((r as HoverCompanyExpected)?.avg_probability ?? 0)}%
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PipelineTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload as {
    name: string;
    deal_count: number;
    total_value: number;
  };
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md text-[12px]">
      <p className="font-semibold text-foreground mb-1">{item.name}</p>
      <p className="text-muted-foreground">
        Wert: <span className="text-foreground font-medium tabular-nums">
          {eurFormatter.format(item.total_value)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Deals: <span className="text-foreground font-medium tabular-nums">
          {item.deal_count}
        </span>
      </p>
    </div>
  );
}
