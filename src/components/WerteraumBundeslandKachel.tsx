// Card "WerteRaum — Schulen je Bundesland": pro Bundesland zwei gestapelte Balken
// (recherchiert = Scraping, im Outreach = Deals). Datenquelle: RPC
// get_werteraum_bundesland_stats (SECURITY DEFINER) über den Session-Client.
// Reine divs, kein Chart.js. Beide Balken auf dieselbe Skala (MAX = größter recherchiert-Wert).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type BundeslandStat = {
  bundesland: string;
  recherchiert: number;
  outreach: number;
};

const REC_COLOR = "#185FA5"; // recherchiert (Scraping)
const OUT_COLOR = "#85B7EB"; // im Outreach (Deals)
const TRACK = "#EDF2F7";
const EMPTY_DARK = "#2D3748"; // "leerer dunkler Balken" bei recherchiert=0

const nf = new Intl.NumberFormat("de-DE");

function LegendDot({ color }: { color: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />;
}

function Bar({ pct, fill, track = TRACK }: { pct: number; fill: string; track?: string }) {
  return (
    <div style={{ flex: 1, height: 15, borderRadius: 3, background: track, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: fill }} />
    </div>
  );
}

export default function WerteraumBundeslandKachel() {
  const { data, isLoading } = useQuery<BundeslandStat[]>({
    queryKey: ["werteraum-bundesland-stats"],
    queryFn: async () => {
      // as-any-Cast: generierte types.ts kennt diese neue RPC (noch) nicht.
      const { data, error } = await (supabase as any).rpc("get_werteraum_bundesland_stats");
      if (error) throw error;
      return (data ?? []) as BundeslandStat[];
    },
  });

  const rows = data ?? [];
  // Skala über den größten recherchiert-Wert — beide Balkenzeilen sind damit vergleichbar.
  const MAX = rows.reduce((m, r) => Math.max(m, r.recherchiert || 0), 0);

  return (
    <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-[16px] font-medium text-foreground">WerteRaum — Schulen je Bundesland</h2>
      </div>

      {/* Legende */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <LegendDot color={REC_COLOR} /> recherchiert (Scraping)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LegendDot color={OUT_COLOR} /> im Outreach (Deals)
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-6 text-center">Noch keine Daten</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((r) => {
            const recherchiert = Math.round(r.recherchiert) || 0;
            const outreach = Math.round(r.outreach) || 0;
            // Bayern-Sonderfall: recherchiert=0 → nur Direkt-Import, nichts gescraped.
            const nurDirektImport = recherchiert === 0;
            const recPct = MAX > 0 ? (recherchiert / MAX) * 100 : 0;
            const outPct = MAX > 0 ? (outreach / MAX) * 100 : 0;
            return (
              <div key={r.bundesland}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{r.bundesland}</span>
                  {nurDirektImport && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ color: "#854F0B", background: "#FAEEDA" }}
                    >
                      nur Direkt-Import, 0 gescraped
                    </span>
                  )}
                </div>

                {/* recherchiert */}
                <div className="flex items-center gap-2">
                  {nurDirektImport ? (
                    // leerer dunkler Balken statt heller Track
                    <div style={{ flex: 1, height: 15, borderRadius: 3, background: EMPTY_DARK }} />
                  ) : (
                    <Bar pct={recPct} fill={REC_COLOR} />
                  )}
                  <span
                    className="text-[13px] font-semibold tabular-nums text-foreground"
                    style={{ minWidth: 48, textAlign: "right" }}
                  >
                    {nf.format(recherchiert)}
                  </span>
                </div>

                {/* im Outreach */}
                <div className="mt-1 flex items-center gap-2">
                  <Bar pct={outPct} fill={OUT_COLOR} />
                  <span
                    className="text-[13px] tabular-nums text-muted-foreground"
                    style={{ minWidth: 48, textAlign: "right" }}
                  >
                    {nf.format(outreach)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
