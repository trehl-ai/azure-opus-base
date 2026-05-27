import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone } from "lucide-react";

const CLUSTER_COLORS = { A: "#1D9E75", B: "#378ADD", C: "#BA7517", D: "#9ca3af" } as const;

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

export default function Campaigns() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["outreach-stats"],
    queryFn: async () => {
      // get_outreach_stats() ist (noch) nicht in den generierten Typen — daher der Cast.
      const { data, error } = await (supabase as any).rpc("get_outreach_stats");
      if (error) throw error;
      return data as OutreachStats;
    },
  });

  const campaigns = stats
    ? [
        {
          slug: "werteraum",
          name: "WerteRaum Mailing 2026",
          status: "Aktiv",
          total: stats.gesamt,
          emailSent: stats.email_sent,
          linkClicked: stats.link_clicked,
          clusters: { A: stats.cluster_a, B: stats.cluster_b, C: stats.cluster_c, D: stats.cluster_d },
        },
      ]
    : [];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <h1 className="text-[28px] font-semibold tracking-tight">Kampagnen</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <Skeleton className="h-[168px] w-full rounded-lg" />}

        {campaigns.map((c) => {
          const clusterTotal = c.clusters.A + c.clusters.B + c.clusters.C + c.clusters.D || 1;
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

        {!isLoading && campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Kampagnen-Daten verfügbar.</p>
        )}
      </div>
    </div>
  );
}
