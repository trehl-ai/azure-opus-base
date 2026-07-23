import { useEffect, useState, useCallback } from "react";
import { supabaseEIC } from "@/lib/supabaseEIC";

type DF = Record<string, any>;

const NUM = ["angebotspreis","bestellpreis","fremdkosten_plan","fremdkosten_ist"];
const TXT = ["kalk_nr","bestellnr","kostencode","leistungszeitraum","rechnungs_nr","leistung_details","anmerkung"];
const DATE = ["angebots_datum","bestell_datum","rechnungs_datum","bezahlt_am"];

const eur = (n: any) => n == null || n === "" ? "–" :
  new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n));
const pct = (f: any) => f == null ? "–" :
  new Intl.NumberFormat("de-DE",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(f));

const inputCls = "w-full rounded border border-border bg-background px-2 py-1 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[170px_1fr] items-center gap-2 py-1 border-b border-border/40 last:border-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function DealFinancePanel({ dealId }: { dealId: string }) {
  const [row, setRow] = useState<DF | null>(null);
  const [draft, setDraft] = useState<DF>({});
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const { data, error } = await (supabaseEIC as any)
      .from("deal_finance").select("*").eq("deal_id", dealId).maybeSingle();
    if (error) setErr(error.message);
    setRow(data ?? null);
    setDraft(data ?? { deal_id: dealId });
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    const payload: DF = { deal_id: dealId };
    for (const k of NUM) payload[k] = draft[k] === "" || draft[k] == null ? null : Number(draft[k]);
    for (const k of TXT) payload[k] = draft[k] === "" ? null : draft[k] ?? null;
    for (const k of DATE) payload[k] = draft[k] === "" ? null : draft[k] ?? null;
    payload.zahlung_status = draft.zahlung_status === "" ? null : draft.zahlung_status ?? null;
    payload.leistung_art = draft.leistung_art === "" ? null : draft.leistung_art ?? null;
    const { error } = await (supabaseEIC as any)
      .from("deal_finance").upsert(payload, { onConflict: "deal_id" });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEdit(false); setMsg("Gespeichert."); await load();
    setTimeout(() => setMsg(null), 3000);
  }

  if (loading) return <div className="text-sm text-muted-foreground">Controlling wird geladen …</div>;

  const src = edit ? draft : (row ?? {});
  const margePlan = row?.fk_anteil_plan == null ? null : 1 - Number(row.fk_anteil_plan);
  const margeIst = row?.fk_anteil_ist == null ? null : 1 - Number(row.fk_anteil_ist);

  const numField = (k: string, label: string) => (
    <Field label={label}>
      {edit
        ? <input type="number" step="0.01" className={inputCls} value={src[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        : eur(src[k])}
    </Field>
  );
  const txtField = (k: string, label: string) => (
    <Field label={label}>
      {edit
        ? <input type="text" className={inputCls} value={src[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        : (src[k] ?? "–")}
    </Field>
  );
  const dateField = (k: string, label: string) => (
    <Field label={label}>
      {edit
        ? <input type="date" className={inputCls} value={src[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        : (src[k] ? new Intl.DateTimeFormat("de-DE").format(new Date(src[k])) : "–")}
    </Field>
  );

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-primary">PL-Controlling</div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          {edit ? (
            <>
              <button onClick={save} disabled={saving}
                className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">
                {saving ? "Speichert …" : "Speichern"}
              </button>
              <button onClick={() => { setDraft(row ?? { deal_id: dealId }); setEdit(false); setErr(null); }}
                className="rounded border border-border px-3 py-1 text-xs">Abbrechen</button>
            </>
          ) : (
            <button onClick={() => setEdit(true)}
              className="rounded border border-border px-3 py-1 text-xs">Bearbeiten</button>
          )}
        </div>
      </div>
      {err && <div className="mb-2 text-sm text-destructive">Fehler: {err}</div>}

      {numField("angebotspreis","Angebotspreis")}
      {numField("bestellpreis","Bestellpreis")}
      {numField("fremdkosten_plan","Fremdkosten (Plan)")}
      {numField("fremdkosten_ist","Fremdkosten (Ist)")}
      <Field label="FK-Anteil Plan / Ist">
        <span className="tabular-nums">{pct(row?.fk_anteil_plan)} / {pct(row?.fk_anteil_ist)}</span>
        <span className="ml-2 text-xs text-muted-foreground">(berechnet)</span>
      </Field>
      <Field label="Marge Plan / Ist">
        <span className="tabular-nums">{pct(margePlan)} / {pct(margeIst)}</span>
      </Field>
      {txtField("leistung_details","Details / Leistung")}
      <Field label="Leistungsart">
        {edit ? (
          <select className={inputCls} value={src.leistung_art ?? ""} onChange={(e) => set("leistung_art", e.target.value)}>
            <option value="">–</option><option value="K">K – Konzept</option>
            <option value="VA">VA – Veranstaltung</option><option value="P">P – Produktion</option>
          </select>
        ) : (src.leistung_art ?? "–")}
      </Field>
      {txtField("kalk_nr","Kalk-Nr.")}
      {txtField("bestellnr","Bestellnr. (SAP)")}
      {txtField("kostencode","Kostencode")}
      {dateField("angebots_datum","Angebotsdatum")}
      {dateField("bestell_datum","Bestelldatum")}
      {txtField("leistungszeitraum","Leistungszeitraum")}
      {txtField("rechnungs_nr","Rechnungsnr.")}
      {dateField("rechnungs_datum","Rechnungsdatum")}
      <Field label="Zahlung">
        {edit ? (
          <select className={inputCls} value={src.zahlung_status ?? ""} onChange={(e) => set("zahlung_status", e.target.value)}>
            <option value="">–</option><option value="offen">offen</option><option value="bezahlt">bezahlt</option>
          </select>
        ) : (src.zahlung_status ?? "–")}
      </Field>
      {dateField("bezahlt_am","Zahlungseingang")}
      {txtField("anmerkung","Anmerkung")}
    </div>
  );
}
