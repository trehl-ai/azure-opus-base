import { useEffect, useState } from "react";
import { supabaseEIC } from "@/lib/supabaseEIC";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Row = { jahr: number | null; betrag: number | null; deal_status: string | null };

const eur0 = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function RevenueByYearCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setErr(null);
      const { data, error } = await (supabaseEIC as any)
        .from("deal_revenue_periods")
        .select("jahr,betrag,deal_status")
        .eq("deal_status", "won");
      if (!active) return;
      if (error) setErr(error.message);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const byYear = new Map<string, number>();
  let undatiert = 0;
  for (const r of rows) {
    const b = Number(r.betrag) || 0;
    if (r.jahr == null) { undatiert += b; continue; }
    const k = String(r.jahr);
    byYear.set(k, (byYear.get(k) ?? 0) + b);
  }
  const chart = Array.from(byYear.entries())
    .map(([jahr, umsatz]) => ({ jahr, umsatz: Math.round(umsatz) }))
    .sort((a, b) => a.jahr.localeCompare(b.jahr));
  const gesamt = chart.reduce((a, c) => a + c.umsatz, 0);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-primary">Umsatz nach Jahr</h3>
        <span className="text-xs text-muted-foreground">Basis: Rechnungsstellung</span>
      </div>
      <div className="mb-3 text-2xl font-semibold tabular-nums">{eur0(gesamt)}</div>

      {loading && <div className="text-sm text-muted-foreground">Lade …</div>}
      {err && <div className="text-sm text-destructive">Fehler: {err}</div>}

      {!loading && !err && chart.length > 0 && (
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

      {!loading && !err && chart.length === 0 && (
        <div className="text-sm text-muted-foreground">Keine datierten Umsätze vorhanden.</div>
      )}

      {undatiert > 0 && (
        <div className="mt-3 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {eur0(undatiert)} ohne Datum — Fälligkeit im Zahlungsplan setzen, sonst fehlen sie im Jahresbild.
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        Zählt gewonnene Deals. Datum = Rechnungsdatum, sonst geplante Fälligkeit.
      </div>
    </div>
  );
}
