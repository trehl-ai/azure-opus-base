import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Handshake, Users, Building2, TrendingDown, Plus, ArrowRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { KPICardSkeleton } from "@/components/shared/SkeletonLoaders";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEoIpsoKpis,
  useEoIpsoPipelines,
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
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useEoIpsoKpis();
  const { data: pipelines, isLoading: pipelinesLoading, error: pipelinesError } = useEoIpsoPipelines();
  const { data: flags, isLoading: flagsLoading, error: flagsError } = useEoIpsoCampaignFlags();
  const { data: recent, isLoading: recentLoading, error: recentError } = useEoIpsoRecentDeals();

  const today = useMemo(() => format(new Date(), "EEEE, d. MMMM yyyy", { locale: de }), []);
  const greeting = useMemo(() => getGreeting(), []);

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
        {kpisLoading ? (
          <><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /></>
        ) : kpisError ? (
          <FallbackCard message="KPIs konnten nicht geladen werden." span={4} />
        ) : (
          <>
            <KpiCard
              icon={Handshake}
              label="Aktive Deals"
              value={kpis!.activeDeals}
              tone="brand"
              onClick={() => navigate("/deals")}
            />
            <KpiCard
              icon={Users}
              label="Contacts"
              value={kpis!.contacts}
              tone="brand"
              subtext={`davon ${kpis!.werteraumPotential} mit WerteRaum Potential`}
              onClick={() => navigate("/contacts")}
            />
            <KpiCard
              icon={Building2}
              label="Unternehmen"
              value={kpis!.companies}
              tone="gold"
              onClick={() => navigate("/companies")}
            />
            <KpiCard
              icon={TrendingDown}
              label="Lost diese Woche"
              value={kpis!.lostThisWeek}
              tone="danger"
            />
          </>
        )}
      </section>

      {/* Pipeline-Übersicht */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">Pipeline-Übersicht</h2>
          <Link to="/deals" className="text-[12px] text-brand hover:underline inline-flex items-center gap-1">
            Alle Deals <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {pipelinesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-[12px]" />
            ))}
          </div>
        ) : pipelinesError ? (
          <FallbackCard message="Pipelines konnten nicht geladen werden." />
        ) : pipelines && pipelines.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">Keine aktiven Pipelines vorhanden.</p>
        )}
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
