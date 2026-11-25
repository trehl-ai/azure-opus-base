import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { umsatzNachLeistungsjahr, type WonDealRow } from "@/lib/umsatzLeistungsjahr";

const eur0 = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Seitengroesse der Abfrage. PostgREST kappt still bei 1000 Zeilen; deshalb wird
 *  in Seiten gelesen, bis eine Seite kuerzer ist. */
const SEITE = 1000;

/**
 * Umsatz nach Jahr.
 *
 * Seit 25.11.2026: Zeitachse = Leistungsjahr (service_start_date, Durchfuehrung),
 * sonst Abschlussjahr (won_at). Betrag = deals.value_amount der gewonnenen Deals.
 * Vorher: RPC get_revenue_by_year ueber deal_revenue_periods (Rechnungsstellung);
 * die RPC bleibt bestehen und wird hier nicht mehr gelesen.
 *
 * Gelesen wird ueber den Session-Client direkt aus deals, also unter RLS
 * (user_can_access_pipeline). Die Kachel "Gewonnen <Jahr>" zaehlt weiter nach
 * won_at (get_dashboard_stats) und ist davon unberuehrt.
 */
export function RevenueByYearCard({ pipelineId }: { pipelineId: string | null }) {
  const { data, isLoading, error } = useQuery<WonDealRow[]>({
    queryKey: ["revenue_by_leistungsjahr", pipelineId],
    queryFn: async () => {
      const alle: WonDealRow[] = [];
      for (let von = 0; ; von += SEITE) {
        // (supabase as any): types.ts ist Lovable-generiert und kennt service_start_date nicht.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any)
          .from("deals")
          .select("id, value_amount, service_start_date, won_at")
          .eq("status", "won")
          .is("deleted_at", null)
          .order("id")
          .range(von, von + SEITE - 1);
        if (pipelineId) q = q.eq("pipeline_id", pipelineId);
        const { data, error } = await q;
        if (error) throw error;
        const seite = (data ?? []) as WonDealRow[];
        alle.push(...seite);
        if (seite.length < SEITE) break;
      }
      return alle;
    },
    staleTime: 60_000,
  });

  const { chart, undatiert } = umsatzNachLeistungsjahr(data ?? []);
  const gesamt = chart.reduce((a, c) => a + c.umsatz, 0);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-primary">Umsatz nach Jahr</h3>
        <span className="text-xs text-muted-foreground">Basis: Leistungsjahr (Durchführung), sonst Abschlussjahr</span>
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
        <div className="text-sm text-muted-foreground">Keine gewonnenen Deals mit Datum vorhanden.</div>
      )}

      {undatiert > 0 && (
        <div className="mt-3 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {eur0(undatiert)} ohne Datum — weder Leistungsbeginn noch „gewonnen am“ gesetzt.
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        Zählt gewonnene Deals (Deal-Wert). Jahr = Leistungsbeginn, sonst „gewonnen am“.
      </div>
    </div>
  );
}
