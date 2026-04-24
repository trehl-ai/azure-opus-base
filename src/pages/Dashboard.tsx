import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Handshake, Users, Building2, TrendingDown, Plus, ArrowRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEoIpsoCampaignFlags,
  useEoIpsoRecentDeals,
} from "@/hooks/queries/useDashboardEoIpso";

function getGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: flags, isLoading: flagsLoading, error: flagsError } = useEoIpsoCampaignFlags();
  const { data: recent, isLoading: recentLoading, error: recentError } = useEoIpsoRecentDeals();

  const today = useMemo(() => format(new Date(), "EEEE, d. MMMM yyyy", { locale: de }), []);
  const greeting = useMemo(() => getGreeting(), []);

  // Hardcoded KPI values
  const kpis = {
    activeDeals: 1744,
    contacts: 1975,
    werteraumPotential: 83,
    companies: 826,
    lostThisWeek: 12,
  };

  // Hardcoded pipelines
  const pipelines = [
    { id: "p1", name: "VR Industrie", total: 999, lost: 37 },
    { id: "p2", name: "VR Stiftungen", total: 352, lost: 12 },
    { id: "p3", name: "Werteraum - Schulen", total: 270, lost: 25 },
    { id: "p4", name: "EXPO / Messen", total: 45, lost: 3 },
    { id: "p5", name: "Corporate Events", total: 37, lost: 2 },
    { id: "p6", name: "Ausschreibungen", total: 21, lost: 8 },
    { id: "p7", name: "VR Förderungen", total: 13, lost: 1 },
    { id: "p8", name: "Viktoria Rebensburg", total: 7, lost: 0 },
  ];

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-canvas p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-brand">EO IPSO CRM</h1>
        <p className="text-[14px] text-muted-foreground">
          {greeting} · <span className="capitalize">{today}</span>
        </p>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Handshake}
          label="Aktive Deals"
          value={kpis.activeDeals.toLocaleString("de-DE")}
          tone="brand"
          onClick={() => navigate("/deals")}
        />
        <KpiCard
          icon={Users}
          label="Contacts"
          value={kpis.contacts.toLocaleString("de-DE")}
          tone="brand"
          subtext={`davon ${kpis.werteraumPotential} mit WerteRaum Potential`}
          onClick={() => navigate("/contacts")}
        />
        <KpiCard
          icon={Building2}
          label="Unternehmen"
          value={kpis.companies.toLocaleString("de-DE")}
          tone="gold"
          onClick={() => navigate("/companies")}
        />
        <KpiCard
          icon={TrendingDown}
          label="Lost diese Woche"
          value={kpis.lostThisWeek}
          tone="danger"
        />
      </section>

      {/* Pipeline-Übersicht */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">Pipeline-Übersicht</h2>
          <Link to="/deals" className="text-[12px] text-brand hover:underline inline-flex items-center gap-1">
            Alle Deals <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate("/deals")}
              className="group text-left rounded-[12px] border border-border bg-canvas hover:border-brand hover:shadow-sm transition-all p-4"
            >
              <p className="text-[13px] font-medium text-foreground line-clamp-1" title={p.name}>
                {p.name}
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-[26px] font-bold text-brand leading-none">{p.total}</span>
                <span className="text-[12px] text-muted-foreground">Deals</span>
              </div>
              {p.lost > 0 && (
                <p className="mt-1.5 text-[12px] text-destructive font-medium">
                  {p.lost} Lost
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Row 3: Campaign Flags + Recent Deals */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campaign flags */}
        <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
          <h2 className="text-[16px] font-semibold text-foreground mb-4">Aktive Kampagnen-Flags</h2>
          {flagsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : flagsError ? (
            <FallbackCard message="Kampagnen konnten nicht geladen werden." />
          ) : (
            <ul className="divide-y divide-border">
              {flags?.map((f) => (
                <li key={f.name}>
                  <button
                    onClick={() => f.tagId && navigate(`/contacts?tag=${f.tagId}`)}
                    className="w-full flex items-center justify-between py-3 px-2 -mx-2 rounded-lg hover:bg-brand-soft transition-colors text-left"
                    disabled={!f.tagId}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl" aria-hidden>{f.icon}</span>
                      <span className="text-[14px] font-medium text-foreground">{f.name}</span>
                    </span>
                    <span className="text-[18px] font-bold text-brand tabular-nums">{f.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent deals */}
        <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
          <h2 className="text-[16px] font-semibold text-foreground mb-4">Zuletzt hinzugefügt</h2>
          {recentLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : recentError ? (
            <FallbackCard message="Aktivitäten konnten nicht geladen werden." />
          ) : recent && recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/deals/${d.id}`}
                    className="flex items-start justify-between gap-3 py-3 hover:bg-brand-soft -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-foreground truncate">{d.title}</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {d.company_name ?? "—"} · {d.pipeline_name ?? "—"}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: de })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Deals erfasst.</p>
          )}
        </div>
      </section>

      {/* Anruf-Aktivitäten */}
      <CallActivitiesWidget />

      {/* Quick Actions */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">Schnellaktionen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction label="Neuer Contact" onClick={() => navigate("/contacts?new=1")} />
          <QuickAction label="Neues Unternehmen" onClick={() => navigate("/companies?new=1")} />
          <QuickAction label="Neuer Deal" onClick={() => navigate("/deals?new=1")} accent />
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
  value: number | string;
  subtext?: string;
  tone: "brand" | "gold" | "danger";
  onClick?: () => void;
}) {
  const toneStyles =
    tone === "brand"
      ? "bg-brand-soft text-brand"
      : tone === "gold"
      ? "bg-gold-soft text-gold"
      : "bg-destructive/10 text-destructive";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "text-left rounded-[12px] border border-border bg-card shadow-sm p-5 transition-all",
        onClick && "hover:border-brand hover:shadow-md cursor-pointer"
      )}
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mb-3", toneStyles)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[28px] font-bold text-foreground leading-tight tabular-nums">{value}</p>
      <p className="text-[13px] text-muted-foreground mt-1">{label}</p>
      {subtext && <p className="text-[11px] text-gold mt-2 font-medium">{subtext}</p>}
    </button>
  );
}

function QuickAction({ label, onClick, accent }: { label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-3 text-[14px] font-medium transition-colors",
        accent
          ? "bg-brand text-brand-foreground hover:bg-brand/90"
          : "border border-border bg-canvas text-foreground hover:border-brand hover:text-brand"
      )}
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

function FallbackCard({ message, span }: { message: string; span?: number }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-dashed border-border bg-muted/40 p-5 text-[13px] text-muted-foreground",
        span && "sm:col-span-2 lg:col-span-4"
      )}
    >
      {message}
    </div>
  );
}

/* ---------- Call Activities Widget (hardcoded) ---------- */

function CallActivitiesWidget() {
  const Y_MAX = 70;
  const weeks = [
    { label: "KW 13–14", sub: "26.03. – 01.04.", wiedervorlage: 0, lost: 13 },
    { label: "KW 15–16", sub: "02.04. – 11.04.", wiedervorlage: 62, lost: 0 },
    { label: "KW 17–18", sub: "12.04. – 23.04.", wiedervorlage: 11, lost: 12 },
  ];
  const BRAND = "hsl(var(--brand))";
  const RED = "#dc2626";

  return (
    <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[20px] font-bold text-foreground">98 Schulkontakte in 3 Wochen</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Werteraum - Schulen Pipeline · Wiedervorlage &amp; Lost
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-6">
        {/* Chart */}
        <div>
          <div className="flex gap-3">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between text-[10px] text-muted-foreground tabular-nums h-[220px] pr-1 text-right">
              {[70, 60, 50, 40, 30, 20, 10, 0].map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
            {/* Bars area */}
            <div className="flex-1 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="border-t border-border/50 h-0" />
                ))}
              </div>
              {/* Bars */}
              <div className="relative h-[220px] flex items-end justify-around gap-4 px-2">
                {weeks.map((w) => {
                  const total = w.wiedervorlage + w.lost;
                  const totalPct = (total / Y_MAX) * 100;
                  const wvShare = total > 0 ? (w.wiedervorlage / total) * 100 : 0;
                  const lostShare = total > 0 ? (w.lost / total) * 100 : 0;
                  return (
                    <div key={w.label} className="relative flex-1 max-w-[80px] h-full flex flex-col justify-end items-center">
                      <div
                        className="w-full rounded-t-md overflow-hidden flex flex-col"
                        style={{ height: `${totalPct}%` }}
                      >
                        {w.wiedervorlage > 0 && (
                          <div
                            className="w-full flex items-center justify-center text-[11px] font-semibold text-white"
                            style={{ height: `${wvShare}%`, background: BRAND }}
                          >
                            {w.wiedervorlage}
                          </div>
                        )}
                        {w.lost > 0 && (
                          <div
                            className="w-full flex items-center justify-center text-[11px] font-semibold text-white"
                            style={{ height: `${lostShare}%`, background: RED }}
                          >
                            {w.lost}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-around gap-4 px-2 mt-2">
                {weeks.map((w) => (
                  <div key={w.label} className="flex-1 max-w-[80px] text-center">
                    <p className="text-[12px] font-medium text-foreground">{w.label}</p>
                    <p className="text-[10px] text-muted-foreground">{w.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: BRAND }} />
              <span className="text-[12px] text-foreground">Wiedervorlage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: RED }} />
              <span className="text-[12px] text-foreground">Lost / Kein Interesse</span>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[12px] border border-border bg-canvas p-4">
            <p className="text-[28px] font-bold text-foreground leading-none tabular-nums">98</p>
            <p className="text-[12px] text-muted-foreground mt-1.5">Kontakte gesamt</p>
          </div>
          <div className="rounded-[12px] border border-border bg-canvas p-4">
            <p className="text-[28px] font-bold leading-none tabular-nums text-brand">73</p>
            <p className="text-[12px] text-muted-foreground mt-1.5">Wiedervorlage</p>
          </div>
          <div className="rounded-[12px] border border-border bg-canvas p-4">
            <p className="text-[28px] font-bold leading-none tabular-nums" style={{ color: RED }}>25</p>
            <p className="text-[12px] text-muted-foreground mt-1.5">Kein Interesse</p>
          </div>
        </div>
      </div>
    </section>
  );
}
