import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { useEinzelmailsOffen, type OffeneEinzelmail } from "@/hooks/queries/useEinzelmailsOffen";
import { useEinzelmailFreigeben, useEinzelmailZurueckstellen } from "@/hooks/mutations";
import { cn } from "@/lib/utils";
import { EinzelmailDialog, EinzelmailWarnungen } from "@/components/aktionen/EinzelmailDialog";

/**
 * "Einzelmails zur Freigabe" auf /aktionen — nur fuer admin (die RPCs pruefen is_admin()
 * ohnehin und werfen sonst 42501). Ausgeblendet, wenn nichts offen ist.
 */

const DOMAIN_KURZ: Record<string, string> = {
  "werteraum-schule.de": "werteraum",
  "viktoria-roadshow.com": "viktoria",
};

const STATUS: Record<OffeneEinzelmail["status"], { label: string; klasse: string }> = {
  entwurf: { label: "Entwurf", klasse: "border-border bg-muted text-foreground" },
  freigegeben: { label: "Freigegeben", klasse: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  fehler: { label: "Fehler", klasse: "border-red-300 bg-red-50 text-red-800" },
};

function Mailtext({ text }: { text: string }) {
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 font-sans text-[13px] leading-relaxed text-foreground">
      {text}
    </pre>
  );
}

/** Auch vom Antwort-Assistenten genutzt ("Ansehen"): mit `onFreigeben` laeuft die Freigabe ueber
 *  den Vorschlag (vorschlag_entscheiden), damit der Vorschlag nicht offen liegen bleibt. */
export function FreigebenDialog({ m, offen, setOffen, onFreigeben, laeuft }: {
  m: OffeneEinzelmail; offen: boolean; setOffen: (v: boolean) => void;
  onFreigeben?: () => void; laeuft?: boolean;
}) {
  const freigeben = useEinzelmailFreigeben();
  const beschaeftigt = laeuft ?? freigeben.isPending;
  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Einzelmail freigeben – {m.schule ?? "(ohne Schule)"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <p><span className="text-muted-foreground">An:</span> {m.empfaenger}</p>
          <p><span className="text-muted-foreground">Von:</span> {m.absender_domain}</p>
          <EinzelmailWarnungen email={m.empfaenger} zustaendigId={m.zustaendig_id} zustaendigName={m.zustaendig_name} />
          <p><span className="text-muted-foreground">Betreff:</span> <span className="font-medium">{m.betreff}</span></p>
          <Mailtext text={m.text} />
          <p className="text-[12px] text-muted-foreground">
            Nach der Freigabe geht die Mail beim nächsten Lauf (werktags 08:30) raus, sofern das Tageslimit der Domain reicht.
          </p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={beschaeftigt}
              onClick={() =>
                onFreigeben ? onFreigeben() : freigeben.mutate(m.einzelmail_id, { onSuccess: () => setOffen(false) })
              }
            >
              {beschaeftigt ? "Freigeben…" : "Freigeben"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setOffen(false)}>Abbrechen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZurueckstellenDialog({ m, offen, setOffen }: { m: OffeneEinzelmail; offen: boolean; setOffen: (v: boolean) => void }) {
  const zurueckstellen = useEinzelmailZurueckstellen();
  const [grund, setGrund] = useState("");
  const leer = grund.trim().length === 0;
  return (
    <Dialog open={offen} onOpenChange={(v) => { setOffen(v); if (!v) setGrund(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Einzelmail zurückstellen – {m.schule ?? "(ohne Schule)"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-label">Grund (Pflicht)</Label>
            <Textarea value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="Warum wird diese Mail nicht versendet?" rows={3} />
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="destructive"
              disabled={leer || zurueckstellen.isPending}
              onClick={() =>
                zurueckstellen.mutate(
                  { id: m.einzelmail_id, grund: grund.trim() },
                  { onSuccess: () => { setOffen(false); setGrund(""); } },
                )
              }
            >
              {zurueckstellen.isPending ? "Speichern…" : "Zurückstellen"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setOffen(false)}>Abbrechen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Zeile({ m }: { m: OffeneEinzelmail }) {
  const [details, setDetails] = useState(false);
  const [freigabeOffen, setFreigabeOffen] = useState(false);
  const [zurueckOffen, setZurueckOffen] = useState(false);
  const [bearbeitenOffen, setBearbeitenOffen] = useState(false);
  const status = STATUS[m.status] ?? { label: m.status, klasse: "" };

  return (
    <div className="py-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <Link to={`/deals/${m.deal_id}`} className="block truncate text-body font-medium text-foreground hover:underline">
            {m.schule || "(ohne Schule)"}
          </Link>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {[m.stufe, m.kampagne].filter(Boolean).join(" · ") || "–"}
          </p>
          <p className="mt-1 truncate text-[13px] text-foreground">{m.betreff}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            an {[m.kontakt_name, m.empfaenger].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            Projektleitung: {m.zustaendig_name ?? "–"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
          <Badge variant="outline" className="font-normal">{DOMAIN_KURZ[m.absender_domain] ?? m.absender_domain}</Badge>
          <Badge variant="outline" className={cn("font-normal", status.klasse)}>{status.label}</Badge>
          {m.status === "entwurf" && (
            <Button size="sm" onClick={() => setFreigabeOffen(true)}>Freigeben</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setBearbeitenOffen(true)}>Bearbeiten</Button>
          <Button size="sm" variant="outline" onClick={() => setZurueckOffen(true)}>Zurückstellen</Button>
        </div>
      </div>

      <div className="mt-1.5">
        <EinzelmailWarnungen email={m.empfaenger} zustaendigId={m.zustaendig_id} zustaendigName={m.zustaendig_name} />
      </div>

      {m.status === "fehler" && m.fehler && (
        <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[12px] text-red-800 break-words">Fehler: {m.fehler}</p>
      )}

      <button
        type="button"
        onClick={() => setDetails((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={details}
      >
        {details ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Text{m.hinweis ? ", Hinweis" : ""}{m.kontext ? ", Kontext" : ""} {details ? "ausblenden" : "anzeigen"}
      </button>
      {details && (
        <div className="mt-2 space-y-2">
          <Mailtext text={m.text} />
          {m.hinweis && <p className="whitespace-pre-wrap text-[12px] text-muted-foreground"><span className="font-medium">Hinweis:</span> {m.hinweis}</p>}
          {m.kontext && <p className="whitespace-pre-wrap text-[12px] text-muted-foreground"><span className="font-medium">Kontext:</span> {m.kontext}</p>}
        </div>
      )}

      <FreigebenDialog m={m} offen={freigabeOffen} setOffen={setFreigabeOffen} />
      <ZurueckstellenDialog m={m} offen={zurueckOffen} setOffen={setZurueckOffen} />
      <EinzelmailDialog modus="bearbeiten" m={m} offen={bearbeitenOffen} setOffen={setBearbeitenOffen} />
    </div>
  );
}

export function EinzelmailsFreigabeKarte() {
  const { data, isLoading, error } = useEinzelmailsOffen(true);
  const zeilen = data ?? [];
  // Ausgeblendet bei N = 0 und waehrend des Ladens. Ein FEHLER wird dagegen gezeigt, nie verschluckt.
  if (!error && (isLoading || zeilen.length === 0)) return null;

  return (
    <section className="mb-8 rounded-[12px] border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3">
        <h2 className="text-[16px] font-semibold text-foreground">
          Einzelmails zur Freigabe {!error && <span className="text-muted-foreground">({zeilen.length})</span>}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Freigegebene Einzelmails gehen werktags um 08:30 raus (Tageslimit je Domain). Beleg ist das CRM, nicht der Ordner Gesendet.
        </p>
      </div>
      {error ? (
        <ListenHinweis laedt={false} fehler={error as Error} leerText="" />
      ) : (
        <div className="divide-y divide-border">
          {zeilen.map((m) => <Zeile key={m.einzelmail_id} m={m} />)}
        </div>
      )}
    </section>
  );
}
