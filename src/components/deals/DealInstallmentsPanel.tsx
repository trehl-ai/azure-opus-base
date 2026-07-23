import { useEffect, useState, useCallback } from "react";
import { supabaseEIC } from "@/lib/supabaseEIC";

type Inst = Record<string, any>;
const STATUS = ["geplant","gestellt","bezahlt","storniert"];
const eur = (n: any) => n == null || n === "" ? "–" :
  new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n));
const cls = "w-full rounded border border-border bg-background px-2 py-1 text-xs";

export function DealInstallmentsPanel({ dealId }: { dealId: string }) {
  const [rows, setRows] = useState<Inst[]>([]);
  const [auftrag, setAuftrag] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Inst>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const [i, f] = await Promise.all([
      (supabaseEIC as any).from("deal_installments").select("*").eq("deal_id", dealId).order("position_nr"),
      (supabaseEIC as any).from("deal_finance").select("bestellpreis,angebotspreis").eq("deal_id", dealId).maybeSingle(),
    ]);
    if (i.error) setErr(i.error.message);
    setRows(i.data ?? []);
    setAuftrag(f.data ? Number(f.data.bestellpreis ?? f.data.angebotspreis ?? 0) || null : null);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const norm = (d: Inst) => ({
    deal_id: dealId,
    position_nr: Number(d.position_nr) || 1,
    bezeichnung: d.bezeichnung || null,
    betrag: d.betrag === "" || d.betrag == null ? null : Number(d.betrag),
    anteil_prozent: d.anteil_prozent === "" || d.anteil_prozent == null ? null : Number(d.anteil_prozent),
    faellig_am: d.faellig_am || null,
    status: d.status || "geplant",
    rechnungs_nr: d.rechnungs_nr || null,
    rechnungs_datum: d.rechnungs_datum || null,
    bezahlt_am: d.bezahlt_am || null,
    notiz: d.notiz || null,
  });

  async function saveRow() {
    setErr(null);
    const payload = norm(draft);
    const q = draft.id
      ? (supabaseEIC as any).from("deal_installments").update(payload).eq("id", draft.id)
      : (supabaseEIC as any).from("deal_installments").insert(payload);
    const { error } = await q;
    if (error) { setErr(error.message); return; }
    setEditId(null); setDraft({}); await load();
  }

  async function del(id: string) {
    if (!window.confirm("Position wirklich löschen?")) return;
    const { error } = await (supabaseEIC as any).from("deal_installments").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    await load();
  }

  function addRow() {
    const next = rows.length ? Math.max(...rows.map((r) => Number(r.position_nr) || 0)) + 1 : 1;
    setDraft({ position_nr: next, status: "geplant" });
    setEditId("new");
  }

  const summe = rows.reduce((a, r) => a + (Number(r.betrag) || 0), 0);
  const diff = auftrag == null ? null : summe - auftrag;
  const offen = rows.filter((r) => r.status !== "bezahlt" && r.status !== "storniert")
                    .reduce((a, r) => a + (Number(r.betrag) || 0), 0);

  if (loading) return <div className="text-sm text-muted-foreground">Zahlungsplan wird geladen …</div>;

  const editor = (
    <tr className="bg-muted/30">
      <td className="p-1"><input type="number" className={cls} value={draft.position_nr ?? ""} onChange={(e)=>setDraft({...draft,position_nr:e.target.value})} /></td>
      <td className="p-1"><input className={cls} placeholder="z.B. 1. Teilrechnung" value={draft.bezeichnung ?? ""} onChange={(e)=>setDraft({...draft,bezeichnung:e.target.value})} /></td>
      <td className="p-1"><input type="number" step="0.01" className={cls} value={draft.betrag ?? ""} onChange={(e)=>setDraft({...draft,betrag:e.target.value})} /></td>
      <td className="p-1"><input type="number" step="1" min="0" max="100" className={cls} value={draft.anteil_prozent ?? ""} onChange={(e)=>setDraft({...draft,anteil_prozent:e.target.value})} /></td>
      <td className="p-1"><input type="date" className={cls} value={draft.faellig_am ?? ""} onChange={(e)=>setDraft({...draft,faellig_am:e.target.value})} /></td>
      <td className="p-1">
        <select className={cls} value={draft.status ?? "geplant"} onChange={(e)=>setDraft({...draft,status:e.target.value})}>
          {STATUS.map((s)=><option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1"><input className={cls} placeholder="RG…" value={draft.rechnungs_nr ?? ""} onChange={(e)=>setDraft({...draft,rechnungs_nr:e.target.value})} /></td>
      <td className="p-1"><input type="date" className={cls} value={draft.bezahlt_am ?? ""} onChange={(e)=>setDraft({...draft,bezahlt_am:e.target.value})} /></td>
      <td className="p-1 whitespace-nowrap">
        <button onClick={saveRow} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Speichern</button>
        <button onClick={()=>{setEditId(null);setDraft({});}} className="ml-1 rounded border border-border px-2 py-1 text-xs">Abbrechen</button>
      </td>
    </tr>
  );

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-primary">Zahlungsplan / Abschlagszahlungen</div>
        <button onClick={addRow} className="rounded border border-border px-3 py-1 text-xs">+ Position</button>
      </div>
      {err && <div className="mb-2 text-sm text-destructive">Fehler: {err}</div>}

      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-1 text-left w-12">Pos</th><th className="p-1 text-left">Bezeichnung</th>
            <th className="p-1 text-left w-28">Betrag</th><th className="p-1 text-left w-16">%</th>
            <th className="p-1 text-left w-32">Fällig am</th><th className="p-1 text-left w-28">Status</th>
            <th className="p-1 text-left w-28">Rechnungsnr.</th><th className="p-1 text-left w-32">Bezahlt am</th>
            <th className="p-1 w-40"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => editId === r.id ? <tr key={r.id}>{editor.props.children}</tr> : (
            <tr key={r.id} className="border-b border-border/40">
              <td className="p-1">{r.position_nr}</td>
              <td className="p-1">{r.bezeichnung ?? "–"}</td>
              <td className="p-1 tabular-nums">{eur(r.betrag)}</td>
              <td className="p-1">{r.anteil_prozent != null ? r.anteil_prozent + "%" : "–"}</td>
              <td className="p-1">{r.faellig_am ? new Intl.DateTimeFormat("de-DE").format(new Date(r.faellig_am))
                : <span className="text-destructive">offen</span>}</td>
              <td className="p-1"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{r.status}</span></td>
              <td className="p-1">{r.rechnungs_nr ?? "–"}</td>
              <td className="p-1">{r.bezahlt_am ? new Intl.DateTimeFormat("de-DE").format(new Date(r.bezahlt_am)) : "–"}</td>
              <td className="p-1 whitespace-nowrap">
                <button onClick={()=>{setDraft(r);setEditId(r.id);}} className="rounded border border-border px-2 py-1">Bearbeiten</button>
                <button onClick={()=>del(r.id)} className="ml-1 rounded border border-border px-2 py-1 text-destructive">Löschen</button>
              </td>
            </tr>
          ))}
          {editId === "new" && editor}
          {rows.length === 0 && editId !== "new" && (
            <tr><td colSpan={9} className="p-3 text-center text-muted-foreground">Kein Zahlungsplan hinterlegt.</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Summe Positionen</span><span className="tabular-nums">{eur(summe)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Auftragswert</span><span className="tabular-nums">{eur(auftrag)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Noch offen (nicht bezahlt)</span><span className="tabular-nums">{eur(offen)}</span></div>
        {diff != null && Math.abs(diff) > 0.5 && (
          <div className="mt-1 rounded bg-destructive/10 px-2 py-1 text-destructive">
            Abweichung zum Auftragswert: {eur(diff)}
          </div>
        )}
      </div>
    </div>
  );
}
