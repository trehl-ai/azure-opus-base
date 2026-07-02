// Horizontales Balkendiagramm "Top Kunden — nach gewonnenem Umsatz".
// Datenquelle: RPC get_top_kunden_won (SECURITY DEFINER) über den Session-Client.
// Reine divs, kein Chart.js. Nur Blautöne, gestaffelt nach Rang.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type TopKunde = {
  company_id: string;
  company_name: string;
  won_revenue: number;
  won_deals: number;
};

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Blautöne gestaffelt nach Rang (0-basiert): Rang1 dunkel → Rang5-8 hell.
function rankColor(rank: number): string {
  if (rank === 0) return "#0C447C";       // Rang 1
  if (rank <= 2) return "#185FA5";        // Rang 2-3
  if (rank === 3) return "#378ADD";       // Rang 4
  return "#85B7EB";                       // Rang 5-8
}

export default function TopKundenChart() {
  const { data, isLoading } = useQuery<TopKunde[]>({
    queryKey: ["top-kunden-won"],
    queryFn: async () => {
      // as-any-Cast: generierte types.ts kennt diese neue RPC (noch) nicht.
      const { data, error } = await (supabase as any).rpc("get_top_kunden_won", { p_limit: 8 });
      if (error) throw error;
      return (data ?? []) as TopKunde[];
    },
  });

  const rows = data ?? [];
  const maxRevenue = rows.reduce((m, r) => Math.max(m, Math.round(r.won_revenue) || 0), 0);

  return (
    <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-[16px] font-medium text-foreground">Top Kunden</h2>
        <p className="text-[12px] text-muted-foreground shrink-0">nach gewonnenem Umsatz</p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[38px] rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-6 text-center">
          Noch keine gewonnenen Deals
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {rows.map((r, i) => {
            const revenue = Math.round(r.won_revenue) || 0;
            const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
            const deals = Math.round(r.won_deals) || 0;
            return (
              <div key={r.company_id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-foreground truncate">
                    {r.company_name}
                    <span className="text-muted-foreground"> · {deals} Deals</span>
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-foreground shrink-0">
                    {eur.format(revenue)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 15,
                    borderRadius: 3,
                    background: "#E6F1FB",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 3,
                      background: rankColor(i),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
