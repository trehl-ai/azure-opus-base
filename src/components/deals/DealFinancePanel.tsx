import { useEffect, useState } from "react";
import { supabaseEIC } from "@/lib/supabaseEIC";

type DealFinance = {
  deal_id: string;
  angebotspreis: number | null;
  bestellpreis: number | null;
  fremdkosten_plan: number | null;
  fremdkosten_ist: number | null;
  fk_anteil_plan: number | null; // 0..1 (generated)
  fk_anteil_ist: number | null;  // 0..1 (generated)
  kalk_nr: string | null;
  bestellnr: string | null;
  kostencode: string | null;
  angebots_datum: string | null;
  bestell_datum: string | null;
  leistungszeitraum: string | null;
  rechnungs_datum: string | null;
  zahlung_status: string | null;
  anmerkung: string | null;
};

const eur = (n: number | null) =>
  n == null ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const pct = (f: number | null) =>
  f == null ? "–" : new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(f);
const dt = (s: string | null) =>
  !s ? "–" : new Intl.DateTimeFormat("de-DE").format(new Date(s));

function FkBar({ f }: { f: number | null }) {
  if (f == null) return <span className="text-muted-foreground">–</span>;
  const w = Math.min(100, Math.max(0, f * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${w}%` }} />
      </div>
      <span className="tabular-nums text-sm">{pct(f)}</span>
    </div>
  );
}

export function DealFinancePanel({ dealId }: { dealId: string }) {
  const [row, setRow] = useState<DealFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setErr(null);
      const { data, error } = await (supabaseEIC as any)
        .from("deal_finance").select("*").eq("deal_id", dealId).maybeSingle();
      if (!active) return;
      if (error) setErr(error.message);
      setRow((data as DealFinance) ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [dealId]);

  if (loading) return <div className="text-sm text-muted-foreground">Controlling wird geladen …</div>;
  if (err) return <div className="text-sm text-destructive">Fehler: {err}</div>;
  if (!row) return <div className="text-sm text-muted-foreground">Keine Controlling-Daten zu diesem Deal.</div>;

  const marge_plan = row.fk_anteil_plan == null ? null : 1 - row.fk_anteil_plan;
  const marge_ist  = row.fk_anteil_ist == null ? null : 1 - row.fk_anteil_ist;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 border-b border-border/50 last:border-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );

  return (
    <div className="rounded-lg border border-border p-4 space-y-1">
      <div className="mb-2 text-sm font-semibold text-primary">PL-Controlling</div>
      <Row label="Angebotspreis">{eur(row.angebotspreis)}</Row>
      <Row label="Bestellpreis">{eur(row.bestellpreis)}</Row>
      <Row label="Fremdkosten (Plan)">{eur(row.fremdkosten_plan)}</Row>
      <Row label="Fremdkosten (Ist)">{eur(row.fremdkosten_ist)}</Row>
      <Row label="FK-Anteil (Plan)"><FkBar f={row.fk_anteil_plan} /></Row>
      <Row label="FK-Anteil (Ist)"><FkBar f={row.fk_anteil_ist} /></Row>
      <Row label="Marge (Plan)"><span className="tabular-nums">{pct(marge_plan)}</span></Row>
      <Row label="Marge (Ist)"><span className="tabular-nums">{pct(marge_ist)}</span></Row>
      <Row label="Kalk-Nr.">{row.kalk_nr ?? "–"}</Row>
      <Row label="Bestellnr. (SAP)">{row.bestellnr ?? "–"}</Row>
      <Row label="Kostencode">{row.kostencode ?? "–"}</Row>
      <Row label="Angebotsdatum">{dt(row.angebots_datum)}</Row>
      <Row label="Bestelldatum">{dt(row.bestell_datum)}</Row>
      <Row label="Leistungszeitraum">{row.leistungszeitraum ?? "–"}</Row>
      <Row label="Rechnungsdatum">{dt(row.rechnungs_datum)}</Row>
      {row.anmerkung ? <Row label="Anmerkung">{row.anmerkung}</Row> : null}
    </div>
  );
}
