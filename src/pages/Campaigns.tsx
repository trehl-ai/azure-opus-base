import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

// Mock data — wird später durch get_outreach_stats() ersetzt
const campaigns = [
  {
    slug: "werteraum",
    name: "WerteRaum Mailing 2026",
    status: "Aktiv",
    total: 248,
    emailSent: 187,
    linkClicked: 54,
    clusters: { A: 62, B: 91, C: 58, D: 37 },
  },
];

const CLUSTER_COLORS = { A: "#1D9E75", B: "#378ADD", C: "#BA7517", D: "#9ca3af" } as const;

export default function Campaigns() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <h1 className="text-[28px] font-semibold tracking-tight">Kampagnen</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => {
          const clusterTotal = c.clusters.A + c.clusters.B + c.clusters.C + c.clusters.D;
          return (
            <Link key={c.slug} to={`/campaigns/${c.slug}`}>
              <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-[16px] leading-tight">{c.name}</h3>
                  <Badge className="bg-success/15 text-success hover:bg-success/15">{c.status}</Badge>
                </div>

                <div className="flex items-baseline gap-1.5 text-sm text-muted-foreground mb-4">
                  <span className="font-semibold text-foreground text-base">{c.total}</span>
                  <span>Kontakte</span>
                  <span>·</span>
                  <span className="font-semibold text-foreground text-base">{c.emailSent}</span>
                  <span>versendet</span>
                  <span>·</span>
                  <span className="font-semibold text-foreground text-base">{c.linkClicked}</span>
                  <span>geklickt</span>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5 tracking-wider">CLUSTER</p>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    {(["A", "B", "C", "D"] as const).map((k) => (
                      <div
                        key={k}
                        style={{
                          width: `${(c.clusters[k] / clusterTotal) * 100}%`,
                          background: CLUSTER_COLORS[k],
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                    {(["A", "B", "C", "D"] as const).map((k) => (
                      <span key={k} className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: CLUSTER_COLORS[k] }}
                        />
                        {k} {c.clusters[k]}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
