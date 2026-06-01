import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabaseEIC, type OutreachStats } from "@/lib/supabaseEIC";

const CLUSTER_COLORS = { A: "#1D9E75", B: "#378ADD", C: "#BA7517", D: "#9ca3af" } as const;

type CampaignCardData = {
  slug: string;
  name: string;
  status: string;
  total: number;
  emailSent: number;
  linkClicked: number;
  clusters: { A: number; B: number; C: number; D: number };
  /** Detail route. Omit for campaigns without a detail page (card renders non-clickable). */
  to?: string;
};

function useOutreachStats() {
  return useQuery({
    queryKey: ["eic", "outreach_stats"],
    queryFn: async () => {
      const { data, error } = await supabaseEIC.rpc("get_outreach_stats");
      if (error) throw error;
      return data as OutreachStats;
    },
  });
}

function useVrStiftungenStats() {
  return useQuery({
    queryKey: ["eic", "vr_stiftungen_stats"],
    queryFn: async () => {
      const { data, error } = await supabaseEIC.rpc("get_vr_stiftungen_stats");
      if (error) throw error;
      return data as OutreachStats;
    },
  });
}

function CampaignCard({ c }: { c: CampaignCardData }) {
  const clusterTotal = Math.max(1, c.clusters.A + c.clusters.B + c.clusters.C + c.clusters.D);
  const card = (
    <Card
      className={`p-5 h-full ${c.to ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-[16px] leading-tight">{c.name}</h3>
        <Badge className="bg-success/15 text-success hover:bg-success/15">{c.status}</Badge>
      </div>

      <div className="flex items-baseline gap-1.5 text-sm text-muted-foreground mb-4 flex-wrap">
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
  );

  return c.to ? <Link to={c.to}>{card}</Link> : card;
}

export default function Campaigns() {
  const { data, isLoading, error } = useOutreachStats();
  const { data: vrData, isLoading: vrLoading, error: vrError } = useVrStiftungenStats();

  const werteraum: CampaignCardData | null = data
    ? {
        slug: "werteraum",
        name: "WerteRaum Mailing 2026",
        status: "Aktiv",
        total: data.gesamt,
        emailSent: data.email_sent,
        linkClicked: data.link_clicked,
        clusters: { A: data.cluster_a, B: data.cluster_b, C: data.cluster_c, D: data.cluster_d },
        to: "/campaigns/werteraum",
      }
    : null;

  const vrStiftungen: CampaignCardData | null = vrData
    ? {
        slug: "vr-stiftungen",
        name: "VR Stiftungen 2026",
        status: "Aktiv",
        total: vrData.gesamt,
        emailSent: vrData.email_sent,
        linkClicked: vrData.link_clicked,
        clusters: { A: vrData.cluster_a, B: vrData.cluster_b, C: vrData.cluster_c, D: vrData.cluster_d },
      }
    : null;

  const campaigns = [werteraum, vrStiftungen].filter(Boolean) as CampaignCardData[];
  const anyLoading = isLoading || vrLoading;
  const firstError = (error || vrError) as Error | null;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <h1 className="text-[28px] font-semibold tracking-tight">Kampagnen</h1>
      </header>

      {anyLoading && campaigns.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Kampagnen…
        </div>
      )}
      {firstError && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">
          Fehler beim Laden: {firstError.message}
        </Card>
      )}

      {campaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.slug} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
