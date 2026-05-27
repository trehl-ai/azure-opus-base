import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const CLUSTER_COLORS = { A: "#1D9E75", B: "#378ADD", C: "#BA7517", D: "#9ca3af" } as const;

// Mock data — Platzhalter bis get_outreach_stats() / v_werteraum_outreach existieren
const stats = {
  total: 248,
  email_sent: 187,
  link_clicked: 54,
  terminated: 12,
  conversion: 4.8,
};

const funnel = [
  { label: "Pending", value: 248, color: "#9ca3af" },
  { label: "Email versendet", value: 187, color: "#378ADD" },
  { label: "Link geklickt", value: 54, color: "#1D9E75" },
  { label: "Angerufen", value: 28, color: "#BA7517" },
  { label: "Terminiert", value: 12, color: "#7c3aed" },
];
const funnelMax = Math.max(...funnel.map((f) => f.value));

const clusters = [
  { key: "A", count: 62, label: "Cluster A — Hot" },
  { key: "B", count: 91, label: "Cluster B — Warm" },
  { key: "C", count: 58, label: "Cluster C — Cold" },
  { key: "D", count: 37, label: "Cluster D — Unsortiert" },
] as const;
const clusterTotal = clusters.reduce((s, c) => s + c.count, 0);

const topLeads = Array.from({ length: 12 }).map((_, i) => ({
  contact_id: `mock-${i}`,
  name: ["Anna Müller", "Tobias Schmidt", "Lisa Becker", "Markus Wolf", "Sarah Klein", "Jan Hoffmann", "Eva Krüger", "Paul Lang", "Nina Roth", "Felix Bauer", "Maria Frank", "David Sommer"][i],
  schule: ["Grundschule am Park", "GS Friedrichshain", "Montessori Berlin", "GS Schöneberg", "Karl-Marx-GS", "GS Prenzlauer Berg", "Anne-Frank-Schule", "GS Charlottenburg", "Pestalozzi-GS", "GS Mitte", "Albert-Einstein-GS", "GS Tempelhof"][i],
  cluster: (["A", "A", "B", "A", "B", "C", "B", "A", "C", "B", "D", "C"] as const)[i],
  score: [98, 94, 91, 88, 84, 81, 78, 75, 71, 68, 64, 60][i],
  status: ["link_clicked", "email_sent", "called", "terminated", "email_sent", "pending", "link_clicked", "called", "email_sent", "pending", "pending", "email_sent"][i],
  hook: [
    "Werteorientierung passt zu Schulkonzept - direktes Interesse",
    "Hat letztes Jahr ähnliches Projekt angefragt",
    "Empfehlung durch Frau Dr. Schmidt (Schulrätin)",
    "Termin bereits für KW12 vereinbart",
    "Aktiv im Bildungsausschuss tätig",
    "Neue Schulleitung sucht Profil-Themen",
    "Hat Landing Page 3x besucht",
    "Telefonisch sehr interessiert gewirkt",
    "Schule sucht Werteprogramm für Jahresplan",
    "Wartet auf Angebot",
    "Erstkontakt steht noch aus",
    "Mailing geöffnet, kein Klick",
  ][i],
}));

const activities = Array.from({ length: 10 }).map((_, i) => ({
  id: `act-${i}`,
  title: ["Outreach Mail versendet", "WerteRaum Landing Page besucht", "Outreach Anruf erfolgreich", "WerteRaum Termin terminiert", "Outreach Follow-Up", "Landing Page Conversion", "WerteRaum Anfrage erhalten", "Outreach Mail geöffnet", "WerteRaum Demo durchgeführt", "Outreach Reminder"][i],
  created_at: new Date(Date.now() - i * 1000 * 60 * 60 * 3).toISOString(),
}));

export default function CampaignWerteraum() {
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
        {[
          { label: "Gesamt", value: stats.total },
          { label: "Versendet", value: stats.email_sent },
          { label: "Link geklickt", value: stats.link_clicked },
          { label: "Terminiert", value: stats.terminated },
          { label: "Conversion", value: `${stats.conversion}%` },
        ].map((k) => (
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
                  {topLeads.map((l) => (
                    <TableRow key={l.contact_id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link to={`/contacts/${l.contact_id}`} className="hover:underline">
                          {l.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.schule}</TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ background: CLUSTER_COLORS[l.cluster] }}
                        >
                          {l.cluster}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{l.score}</TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">{l.status}</TableCell>
                      <TableCell className="text-[12px] text-muted-foreground max-w-[260px] truncate">
                        {l.hook.length > 60 ? l.hook.slice(0, 60) + "…" : l.hook}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* BLOCK 5 — Aktivitäts-Feed */}
        <Card className="p-5 h-fit lg:sticky lg:top-6">
          <h2 className="font-semibold mb-4">Aktivitäten</h2>
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-medium leading-tight">{a.title}</p>
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
