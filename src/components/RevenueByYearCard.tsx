import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Row = { jahr: number | null; umsatz: number | string | null };

const eur0 = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/**
 * Umsatz nach Jahr.
 *
 * Zeitachse = Rechnungsstellung: Rechnungsdatum der Zahlungsplan-Position,
 * ersatzweise deren geplante Faelligkeit, zuletzt won_at. NICHT created_at —
 * alle Deals wurden 2026 migriert, ihr created_at traegt keine Aussage.
 *
 * Aggregiert wird in der RPC get_revenue_by_year: der frueher hier stehende
 * Select auf deal_revenue_periods haette bei ueber 1000 Zeilen ohne Fehler zu
 * niedrige Summen geliefert, und die View gibt nur den Pipeline-Namen heraus,
 * nicht die id, die der Umschalter braucht.
 */
export function RevenueByYearCard({ pipelineId }: { pipelineId: string | null }) {
  const { data, isLoading, error } = useQuery<Row[]>({
    queryKey: ["revenue_by_year", pipelineId],
    queryFn: async () => {
      // as-any-Cast: generierte types.ts kennt diese neue RPC (noch) nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_revenue_by_year", {
        p_pipeline_id: pipelineId,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const chart = rows
    .filter((r) => r.jahr != null)
    .map((r) => ({ jahr: String(r.jahr), umsatz: Math.round(Number(r.umsatz) || 0) }))
    .sort((a, b) => a.jahr.localeCompare(b.jahr));
  // jahr IS NULL = weder Rechnungs- noch Faelligkeitsdatum noch won_at.
  const undatiert = rows
    .filter((r) => r.jahr == null)
    .reduce((sum, r) => sum + (Number(r.umsatz) || 0), 0);
  const gesamt = chart.reduce((a, c) => a + c.umsatz, 0);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-primary">Umsatz nach Jahr</h3>
        <span className="text-xs text-muted-foreground">Basis: Rechnungsstellung</span>
      </div>
      <div className="mb-3 text-2xl font-semibold tabular-nums">{eur0(gesamt)}</div>

      {isLoading && <div className="text-sm text-muted-foreground">Lade …</div>}
      {error && (
        <div className="text-sm text-destructive">
          Fehler: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && chart.length > 0 && (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="jahr" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                     tickLine={false} axisLine={false} fontSize={12} width={44} />
              <Tooltip formatter={(v) => eur0(Number(v))} labelFormatter={(l) => `Jahr ${l}`} />
              <Bar dataKey="umsatz" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && !error && chart.length === 0 && (
        <div className="text-sm text-muted-foreground">Keine datierten Umsätze vorhanden.</div>
      )}

      {undatiert > 0 && (
        <div className="mt-3 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {eur0(undatiert)} ohne Datum — Fälligkeit im Zahlungsplan setzen, sonst fehlen sie im Jahresbild.
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        Zählt gewonnene Deals. Datum = Rechnungsdatum, sonst geplante Fälligkeit, sonst „gewonnen am“.
      </div>
    </div>
  );
}
