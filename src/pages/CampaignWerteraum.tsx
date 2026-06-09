import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseEIC, type OutreachStats, type WerteraumOutreachRow } from "@/lib/supabaseEIC";

const WERTERAUM_PIPELINE_ID = "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e";

const CLUSTER_COLORS: Record<string, string> = {
  A: "#1D9E75",
  B: "#378ADD",
  C: "#BA7517",
  D: "#9ca3af",
};

function useStats() {
  return useQuery({
    queryKey: ["eic", "outreach_stats"],
    queryFn: async () => {
      const { data, error } = await (supabaseEIC as any).rpc("get_outreach_stats");
      if (error) throw error;
      return data as OutreachStats;
    },
  });
}

function useTopLeads() {
  return useQuery({
    queryKey: ["eic", "v_werteraum_outreach", "top20"],
    queryFn: async () => {
      const { data, error } = await (supabaseEIC as any).from("v_werteraum_outreach")
        .select("*")
        .order("outreach_score", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as WerteraumOutreachRow[];
    },
  });
}

type ActivityRow = {
  title: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  activity_type: string | null;
};

function useActivities() {
  return useQuery({
    queryKey: ["eic", "outreach_activities", "werteraum"],
    queryFn: async () => {
      // deal_activities ist nicht anon-lesbar (RLS) — der anon `supabaseEIC` bekommt 401.
      // Session-Client `supabase` (gleiche DB ttgvhqygmgtnjgwunuwz) trägt die auth.uid()-Session,
      // die die RLS-Policy braucht. Gleicher Fix wie PR #96/#97. get_outreach_activities ist
      // der gemeinsame SECURITY-DEFINER-Feed — p_pipeline_id grenzt auf die WerteRaum-Pipeline ein.
      const { data, error } = await (supabase as any).rpc("get_outreach_activities", {
        p_limit: 20,
        p_pipeline_id: "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e",
      });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });
}

type LinkClickedRow = {
  id: string; // deal_id
  title: string; // school name
  contacts: {
    first_name: string | null;
    last_name: string | null;
    outreach_cluster: string | null;
    lead_score: number | null;
  } | null;
};

function useLinkClicked() {
  return useQuery({
    queryKey: ["eic", "werteraum_link_clicked"],
    queryFn: async () => {
      // deals + contacts sind RLS-geschützt → Session-Client `supabase` (trägt auth.uid()),
      // NICHT der anon `supabaseEIC` (→ 401). Inner-Join über die einzige FK deals→contacts
      // (primary_contact_id), gefiltert auf link_clicked + WerteRaum-Pipeline.
      const { data, error } = await (supabase as any)
        .from("deals")
        .select("id, title, contacts!inner ( first_name, last_name, outreach_cluster, lead_score )")
        .eq("pipeline_id", WERTERAUM_PIPELINE_ID)
        .eq("contacts.outreach_status", "link_clicked")
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LinkClickedRow[];
    },
  });
}

export default function CampaignWerteraum() {
  const statsQ = useStats();
  const leadsQ = useTopLeads();
  const activitiesQ = useActivities();
  const linkClickedQ = useLinkClicked();

  const stats = statsQ.data;
  const total = stats?.gesamt ?? 0;
  const conversion = total > 0 ? ((stats?.terminated ?? 0) / total) * 100 : 0;

  const funnel = stats
    ? [
        { label: "Pending", value: stats.pending, color: "#9ca3af" },
        { label: "Email versendet", value: stats.email_sent, color: "#378ADD" },
        { label: "Link geklickt", value: stats.link_clicked, color: "#1D9E75" },
        { label: "Geantwortet", value: stats.replied, color: "#16a34a" },
        { label: "Opt-Out", value: stats.terminated, color: "#7c3aed" },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const clusters = stats
    ? ([
        { key: "A", count: stats.cluster_a, label: "Cluster A — Hot" },
        { key: "B", count: stats.cluster_b, label: "Cluster B — Warm" },
        { key: "C", count: stats.cluster_c, label: "Cluster C — Cold" },
        { key: "D", count: stats.cluster_d, label: "Cluster D — Unsortiert" },
      ] as const)
    : [];
  const clusterTotal = Math.max(1, clusters.reduce((s, c) => s + c.count, 0));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kampagnen
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">WerteRaum Mailing 2026</h1>
        <Badge className="bg-success/15 text-success hover:bg-success/15">Aktiv</Badge>
      </header>

      {statsQ.error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">
          Fehler: {(statsQ.error as Error).message}
        </Card>
      )}

      {/* BLOCK 1 — KPI */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
        {(
          [
            { label: "Gesamt", value: total },
            { label: "Versendet", value: stats?.email_sent ?? 0 },
            { label: "Link geklickt", value: stats?.link_clicked ?? 0 },
            { label: "Geantwortet", value: stats?.replied ?? 0, tone: "success" as const },
            { label: "Opt-Out", value: stats?.terminated ?? 0, subtitle: "Nicht kontaktieren" },
            { label: "Conversion", value: `${conversion.toFixed(1)}%` },
          ] satisfies {
            label: string;
            value: number | string;
            subtitle?: string;
            tone?: "success";
          }[]
        ).map((k) => (
          <Card key={k.label} className="p-4">
            <p
              className={`text-[12px] font-medium tracking-wider uppercase ${
                k.tone === "success" ? "text-success" : "text-muted-foreground"
              }`}
            >
              {k.label}
            </p>
            <p
              className={`text-[28px] font-semibold mt-1 ${
                k.tone === "success" ? "text-success" : ""
              }`}
            >
              {statsQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : k.value}
            </p>
            {k.subtitle && (
              <p className="text-[11px] text-muted-foreground mt-1">{k.subtitle}</p>
            )}
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
              {!stats && !statsQ.isLoading && (
                <p className="text-sm text-muted-foreground">Keine Daten</p>
              )}
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
            {leadsQ.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Leads…
              </div>
            )}
            {leadsQ.error && (
              <p className="text-sm text-destructive">{(leadsQ.error as Error).message}</p>
            )}
            {leadsQ.data && (
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
                    {leadsQ.data.map((l) => {
                      const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
                      const cluster = (l.outreach_cluster ?? "D").toUpperCase();
                      const color = CLUSTER_COLORS[cluster] ?? CLUSTER_COLORS.D;
                      const hook = (l.outreach_hook ?? "").trim();
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
                              style={{ background: color }}
                            >
                              {cluster}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold">{l.outreach_score ?? "—"}</TableCell>
                          <TableCell className="text-[12px] text-muted-foreground">
                            {l.outreach_status ?? "—"}
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground max-w-[260px] truncate">
                            {hook.length > 60 ? hook.slice(0, 60) + "…" : hook || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {leadsQ.data.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground text-center">
                          Keine Leads
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN — Aktivitäten + Link geklickt */}
        <div className="space-y-6 h-fit lg:sticky lg:top-6">
          {/* BLOCK 5 — Aktivitäts-Feed */}
          <Card className="p-5">
          <h2 className="font-semibold mb-4">Aktivitäten</h2>
          {activitiesQ.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade…
            </div>
          )}
          {activitiesQ.error && (
            <p className="text-sm text-destructive">{(activitiesQ.error as Error).message}</p>
          )}
          {activitiesQ.data && (
            <ul className="space-y-3">
              {activitiesQ.data.map((a, i) => (
                <li key={i} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-sm font-medium leading-tight">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {[a.company_name, formatRelative(a.created_at)].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
              {activitiesQ.data.length === 0 && (
                <li className="text-sm text-muted-foreground">Keine Aktivitäten</li>
              )}
            </ul>
          )}
          </Card>

          {/* BLOCK 6 — Link geklickt */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              Link geklickt
              <span className="font-normal text-muted-foreground">
                ({linkClickedQ.data?.length ?? 0})
              </span>
            </h2>
            {linkClickedQ.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade…
              </div>
            )}
            {linkClickedQ.error && (
              <p className="text-sm text-destructive">{(linkClickedQ.error as Error).message}</p>
            )}
            {linkClickedQ.data && (
              <ul className="space-y-3">
                {linkClickedQ.data.map((row) => {
                  const c = row.contacts;
                  const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "—";
                  const cluster = (c?.outreach_cluster ?? "D").toUpperCase();
                  const color = CLUSTER_COLORS[cluster] ?? CLUSTER_COLORS.D;
                  return (
                    <li key={row.id} className="border-l-2 border-success/40 pl-3">
                      <Link
                        to={`/deals/${row.id}`}
                        className="text-sm font-medium leading-tight hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ background: color }}
                        >
                          {cluster}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Score {c?.lead_score ?? "—"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                          🔗 Link geklickt
                        </span>
                      </div>
                    </li>
                  );
                })}
                {linkClickedQ.data.length === 0 && (
                  <li className="text-sm text-muted-foreground">Noch keine Klicks</li>
                )}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tg.`;
}

function DonutChart({
  clusters,
  total,
}: {
  clusters: readonly { key: string; count: number }[];
  total: number;
}) {
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
            stroke={CLUSTER_COLORS[cl.key] ?? CLUSTER_COLORS.D}
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
