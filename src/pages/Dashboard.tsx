import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import { Handshake, Trophy, Percent, Users, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
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
import { useActivityStats, type FunnelStage } from "@/hooks/useActivityStats";

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

const FUNNEL_TILE_COLORS: Record<number, string> = {
  1: "bg-blue-600",
  2: "bg-blue-500",
  3: "bg-blue-400",
  4: "bg-teal-400",
  5: "bg-green-400",
};

const FEED_ICONS: Record<string, string> = {
  email: "📧",
  call: "📞",
  note: "📝",
};

function relativeTimeDe(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  const diffYear = Math.round(diffMonth / 12);
  return rtf.format(diffYear, "year");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading } = useDashboardStats();
  const { activityStats } = useActivityStats();

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

  const funnelStages = useMemo<FunnelStage[]>(() => {
    return (activityStats?.funnel ?? [])
      .filter((f) => f && f.position >= 1 && f.position <= 5)
      .sort((a, b) => a.position - b.position);
  }, [activityStats]);

  const maxFunnelDeals = useMemo(() => {
    if (funnelStages.length === 0) return 0;
    return Math.max(...funnelStages.map((f) => f.deals ?? 0));
  }, [funnelStages]);

  const stageFeed = useMemo(
    () => (activityStats?.stage_feed ?? []).slice(0, 10),
    [activityStats],
  );

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

      {/* Block 5 — Werteraum — Aktivitäten */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold text-foreground">
          Werteraum — Aktivitäten
        </h2>

        {/* ROW 1: Calls KPI (1/3) + Stage-Wechsel Tabelle (2/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CallsKpiCard
            current={activityStats?.calls_diese_woche ?? 0}
            previous={activityStats?.calls_letzte_woche ?? 0}
          />
          <div className="lg:col-span-2 rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aktion</TableHead>
                  <TableHead className="text-right tabular-nums">
                    Diese Woche (lfd.)
                  </TableHead>
                  <TableHead className="text-right tabular-nums">
                    Letzte Woche
                  </TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <StageWechselRow
                  icon="📧"
                  label="Infomaterial versandt"
                  current={activityStats?.stage_infos_diese_woche ?? 0}
                  previous={activityStats?.stage_infos_letzte_woche ?? 0}
                />
                <StageWechselRow
                  icon="🔄"
                  label="→ Wiedervorlage"
                  current={activityStats?.stage_moves_diese_woche ?? 0}
                  previous={activityStats?.stage_moves_letzte_woche ?? 0}
                />
                <StageWechselRow
                  icon="❌"
                  label="Als verloren markiert"
                  current={activityStats?.lost_diese_woche ?? 0}
                  previous={activityStats?.lost_letzte_woche ?? 0}
                />
              </TableBody>
            </Table>
            <p className="text-xs text-gray-400 mt-3">
              Diese Woche läuft noch bis Freitag
            </p>
          </div>
        </div>

        {/* ROW 2: Werteraum Funnel */}
        <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
          {funnelStages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Funnel-Daten verfügbar.
            </p>
          ) : (
            <div className="flex items-stretch gap-2 overflow-x-auto">
              <div className="flex items-stretch gap-2">
                {funnelStages.map((curr, idx) => {
                  const prev = idx > 0 ? funnelStages[idx - 1] : null;
                  const conversion =
                    idx === 0
                      ? null
                      : prev && prev.deals > 0
                        ? Math.round((curr.deals / prev.deals) * 100) + "%"
                        : "—";
                  const widthPx =
                    maxFunnelDeals > 0
                      ? Math.max(
                          100,
                          Math.round((curr.deals / maxFunnelDeals) * 300),
                        )
                      : 100;
                  return (
                    <div key={curr.position} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center rounded-md px-3 py-4 min-h-[88px]",
                          FUNNEL_TILE_COLORS[curr.position] ?? "bg-blue-400",
                        )}
                        style={{ width: `${widthPx}px` }}
                      >
                        <span className="text-xs text-white/80 text-center leading-tight">
                          {curr.stage}
                        </span>
                        <span className="text-2xl font-bold text-white tabular-nums leading-none mt-1">
                          {curr.deals}
                        </span>
                        {conversion && (
                          <span className="text-xs text-white/70 tabular-nums mt-1">
                            {conversion}
                          </span>
                        )}
                      </div>
                      {idx < funnelStages.length - 1 && (
                        <ArrowRight
                          className="h-4 w-4 text-gray-400 shrink-0"
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-stretch ml-4">
                <div className="flex flex-col items-center justify-center rounded-md px-3 py-4 min-h-[88px] bg-red-500 text-white min-w-[100px]">
                  <span className="text-xs text-white/80 text-center leading-tight">
                    Verloren
                  </span>
                  <span className="text-2xl font-bold text-white tabular-nums leading-none mt-1">
                    33
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ROW 3: Stage Feed */}
        <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
          {stageFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Aktivitäten erfasst.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {stageFeed.map((item, i) => (
                <li
                  key={`${item.created_at}-${i}`}
                  className="flex items-center gap-2 py-2"
                >
                  <span aria-hidden className="shrink-0">
                    {FEED_ICONS[item.activity_type] ?? "•"}
                  </span>
                  <span className="font-medium text-sm text-foreground truncate">
                    {item.company_name}
                  </span>
                  <span className="text-xs text-gray-500 ml-2 truncate flex-1">
                    {item.title}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                    {relativeTimeDe(item.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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

function CallsKpiCard({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const isUp = current > previous;
  const isDown = current < previous;
  return (
    <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
      <p className="text-[44px] font-bold leading-none tabular-nums text-brand">
        {current.toLocaleString("de-DE")}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <p className="text-[13px] text-muted-foreground">
          Anrufe diese Woche
        </p>
        <span className="text-[11px] text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
          (lfd.)
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[12px] text-muted-foreground">
        <span>Letzte Woche: {previous.toLocaleString("de-DE")}</span>
        {isUp && <ArrowUp className="h-3.5 w-3.5 text-green-600" aria-hidden />}
        {isDown && (
          <ArrowDown className="h-3.5 w-3.5 text-red-600" aria-hidden />
        )}
      </div>
    </div>
  );
}

function StageWechselRow({
  icon,
  label,
  current,
  previous,
}: {
  icon: string;
  label: string;
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  const trendUp = current >= previous;
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span aria-hidden className="mr-2">
          {icon}
        </span>
        {label}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {current.toLocaleString("de-DE")}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {previous.toLocaleString("de-DE")}
      </TableCell>
      <TableCell className="text-right">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[12px] font-medium tabular-nums",
            trendUp ? "text-green-600" : "text-red-600",
          )}
        >
          {trendUp ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          )}
          {trendUp ? "+" : ""}
          {diff.toLocaleString("de-DE")}
        </span>
      </TableCell>
    </TableRow>
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
