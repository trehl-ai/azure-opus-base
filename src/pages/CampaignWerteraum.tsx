import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const CLUSTER_COLORS = { A: "#1D9E75", B: "#378ADD", C: "#BA7517", D: "#9ca3af" } as const;
type ClusterKey = keyof typeof CLUSTER_COLORS;
const CLUSTER_LABEL: Record<ClusterKey, string> = {
  A: "Cluster A — Hot",
  B: "Cluster B — Warm",
  C: "Cluster C — Cold",
  D: "Cluster D — Unsortiert",
};
const clusterOf = (v: string | null): ClusterKey =>
  v && (v in CLUSTER_COLORS) ? (v as ClusterKey) : "D";

interface OutreachStats {
  gesamt: number;
  pending: number;
  email_sent: number;
  link_clicked: number;
  terminated: number;
  cluster_a: number;
  cluster_b: number;
  cluster_c: number;
  cluster_d: number;
}

interface LeadRow {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  outreach_cluster: string | null;
  outreach_score: number | null;
  outreach_status: string | null;
  outreach_hook: string | null;
}

interface ActivityRow {
  id: string;
  title: string | null;
  created_at: string;
}

export default function CampaignWerteraum() {
  const { data: stats } = useQuery({
    queryKey: ["outreach-stats"],
    queryFn: async () => {
      // get_outreach_stats() ist (noch) nicht in den generierten Typen — daher der Cast.
      const { data, error } = await (supabase as any).rpc("get_outreach_stats");
      if (error) throw error;
      return data as OutreachStats;
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["werteraum-leads"],
    queryFn: async () => {
      // v_werteraum_outreach ist (noch) nicht in den generierten Typen — daher der Cast.
      const { data, error } = await (supabase as any)
        .from("v_werteraum_outreach")
        .select(
          "contact_id, first_name, last_name, company_name, outreach_cluster, outreach_score, outreach_status, outreach_hook"
        )
        .not("outreach_score", "is", null)
        .order("outreach_score", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["werteraum-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("id, title, created_at")
        .or("title.ilike.*Vertiefung*,title.ilike.*Landing Page besucht*,title.ilike.*Outreach*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const kpis = [
    { label: "Gesamt", value: stats?.gesamt ?? "—" },
    { label: "Versendet", value: stats?.email_sent ?? "—" },
    { label: "Link geklickt", value: stats?.link_clicked ?? "—" },
    { label: "Terminiert", value: stats?.terminated ?? "—" },
    {
      label: "Conversion",
      value: stats && stats.gesamt > 0 ? `${((stats.terminated / stats.gesamt) * 100).toFixed(1)}%` : "—",
    },
  ];

  const funnel = [
    { label: "Pending", value: stats?.pending ?? 0, color: "#9ca3af" },
    { label: "Email versendet", value: stats?.email_sent ?? 0, color: "#378ADD" },
    { label: "Link geklickt", value: stats?.link_clicked ?? 0, color: "#1D9E75" },
    { label: "Terminiert", value: stats?.terminated ?? 0, color: "#7c3aed" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const clusters = [
    { key: "A" as const, count: stats?.cluster_a ?? 0, label: CLUSTER_LABEL.A },
    { key: "B" as const, count: stats?.cluster_b ?? 0, label: CLUSTER_LABEL.B },
    { key: "C" as const, count: stats?.cluster_c ?? 0, label: CLUSTER_LABEL.C },
    { key: "D" as const, count: stats?.cluster_d ?? 0, label: CLUSTER_LABEL.D },
  ];
  const clusterTotal = clusters.reduce((s, c) => s + c.count, 0) || 1;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kampagnen
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">WerteRaum Mailing 2026</h1>
        <Badge className="bg-success/15 text-success hover:bg-success/15">Aktiv</Badge>
      </header>

      {/* BLOCK 1 — KPI */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-[12px] font-medium text-muted-foreground tracking-wider uppercase">{k.label}</p>
            <p className="text-[28px] font-semibold mt-1">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* BLOCK 2 — Funnel */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Status-Funnel</h2>
            <div className="space-y-3">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground">{f.value}</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(f.value / funnelMax) * 100}%`, background: f.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* BLOCK 3 — Cluster Donut */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Cluster-Verteilung</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <DonutChart clusters={clusters} total={clusterTotal} />
              <div className="space-y-2">
                {clusters.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: CLUSTER_COLORS[c.key] }}
                    />
                    <span className="font-medium w-32">{c.label}</span>
                    <span className="text-muted-foreground">
                      {c.count} ({Math.round((c.count / clusterTotal) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* BLOCK 4 — Top Leads */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Top 20 Leads</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Schule</TableHead>
                    <TableHead>Cluster</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hook</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!leads && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  )}
                  {leads?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-sm">
                        Noch keine bewerteten Leads.
                      </TableCell>
                    </TableRow>
                  )}
                  {leads?.map((l) => {
                    const ck = clusterOf(l.outreach_cluster);
                    const name = [l.first_name, l.last_name].filter(Boolean).join(" ").trim() || "—";
                    const hook = l.outreach_hook ?? "";
                    return (
                      <TableRow key={l.contact_id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link to={`/contacts/${l.contact_id}`} className="hover:underline">
                            {name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{l.company_name ?? "—"}</TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                            style={{ background: CLUSTER_COLORS[ck] }}
                          >
                            {ck}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{l.outreach_score ?? "—"}</TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">{l.outreach_status ?? "—"}</TableCell>
                        <TableCell className="text-[12px] text-muted-foreground max-w-[260px] truncate">
                          {hook.length > 60 ? hook.slice(0, 60) + "…" : hook}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* BLOCK 5 — Aktivitäts-Feed */}
        <Card className="p-5 h-fit lg:sticky lg:top-6">
          <h2 className="font-semibold mb-4">Aktivitäten</h2>
          {!activities && <Skeleton className="h-24 w-full" />}
          {activities?.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Aktivitäten.</p>
          )}
          <ul className="space-y-3">
            {activities?.map((a) => (
              <li key={a.id} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-medium leading-tight">{a.title ?? "Aktivität"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: de })}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function DonutChart({ clusters, total }: { clusters: readonly { key: "A" | "B" | "C" | "D"; count: number }[]; total: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
      <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="18" />
      {clusters.map((cl) => {
        const len = (cl.count / total) * c;
        const el = (
          <circle
            key={cl.key}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={CLUSTER_COLORS[cl.key]}
            strokeWidth="18"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
