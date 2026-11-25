import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import { useEinzelmailsOffen } from "@/hooks/queries/useEinzelmailsOffen";
import { useVorschlagEntscheiden } from "@/hooks/mutations";
import type { Vorschlag } from "@/hooks/queries/useVorschlaege";
import { FreigebenDialog } from "@/components/aktionen/EinzelmailsFreigabeKarte";
import { alsKalendertag, ausKalendertag, berlinHeute, wiedervorlageDe } from "@/lib/wiedervorlage";

const ART_LABEL: Record<Vorschlag["art"], string> = {
  verloren: "Als verloren markieren",
  wiedervorlage: "Wiedervorlage",
  einzelmail: "Einzelmail freigeben",
  adresse: "Mailadresse korrigieren",
  keine_aktion: "Keine Aktion nötig",
};

function Detail({ v }: { v: Vorschlag }) {
  if (v.art === "verloren") return <>Grund: {v.lost_reason}</>;
  if (v.art === "wiedervorlage") return <>ab {wiedervorlageDe(v.wiedervorlage_am)}</>;
  if (v.art === "adresse") return <>neu: {v.neue_email} <span className="text-muted-foreground">(Stufe zurück auf Quellstufe, ggf. neue Erstmail)</span></>;
  return null;
}

/** Vorschlag des Antwort-Assistenten an einer Zeile in "Zu erledigen". */
export function VorschlagFeld({ v }: { v: Vorschlag }) {
  const { isAdmin } = useUserRole();
  const entscheiden = useVorschlagEntscheiden();
  const [aendernOffen, setAendernOffen] = useState(false);
  const [ablehnenOffen, setAblehnenOffen] = useState(false);
  const [ansehenOffen, setAnsehenOffen] = useState(false);
  const [grund, setGrund] = useState(v.lost_reason ?? "");
  const [datum, setDatum] = useState<string | null>(v.wiedervorlage_am);
  const [ablehnGrund, setAblehnGrund] = useState("");
  const { data: einzelmails } = useEinzelmailsOffen(isAdmin && v.art === "einzelmail");
  const einzelmail = einzelmails?.find((m) => m.einzelmail_id === v.einzelmail_id);
  const heute = berlinHeute();
  const laeuft = entscheiden.isPending;
  const aenderbar = v.art === "verloren" || v.art === "wiedervorlage";
  const nurAdmin = v.art === "einzelmail" && !isAdmin;

  const bestaetigen = (extra?: { lostReason?: string; datum?: string | null }) =>
    entscheiden.mutate({ id: v.vorschlag_id, aktion: "bestaetigen", ...extra }, {
      onSuccess: () => { setAendernOffen(false); setAnsehenOffen(false); },
    });

  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-[13px]">
          <p className="flex items-center gap-1.5 font-medium text-violet-900">
            <Sparkles className="h-3.5 w-3.5" /> Vorschlag: {ART_LABEL[v.art]}
            <Badge variant="outline" className="ml-1 font-normal">{v.erstellt_von}</Badge>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-foreground">{v.begruendung}</p>
          <p className="mt-0.5 text-[12px] text-foreground"><Detail v={v} /></p>
          {nurAdmin && <p className="mt-0.5 text-[12px] text-muted-foreground">Freigabe nur durch admin.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {v.art === "einzelmail" && isAdmin && (
            <Button size="sm" variant="outline" disabled={!einzelmail} onClick={() => setAnsehenOffen(true)}
              title={einzelmail ? undefined : "Einzelmail ist nicht (mehr) im Entwurf"}>
              Ansehen
            </Button>
          )}
          {v.art !== "einzelmail" && (
            <Button size="sm" disabled={laeuft} onClick={() => bestaetigen()}>Bestätigen</Button>
          )}
          {aenderbar && (
            <Button size="sm" variant="outline" disabled={laeuft} onClick={() => setAendernOffen(true)}>Ändern</Button>
          )}
          <Button size="sm" variant="ghost" disabled={laeuft} onClick={() => setAblehnenOffen(true)}>Ablehnen</Button>
        </div>
      </div>

      {/* Einzelmail: bestehender Freigabe-Dialog, Freigeben laeuft ueber den Vorschlag */}
      {einzelmail && (
        <FreigebenDialog m={einzelmail} offen={ansehenOffen} setOffen={setAnsehenOffen}
          onFreigeben={() => bestaetigen()} laeuft={laeuft} />
      )}

      <Dialog open={aendernOffen} onOpenChange={setAendernOffen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vorschlag ändern – {v.deal_title ?? ""}</DialogTitle></DialogHeader>
          {v.art === "verloren" ? (
            <div className="space-y-1.5">
              <Label className="text-label">Grund für den Verlust</Label>
              <Textarea value={grund} onChange={(e) => setGrund(e.target.value)} rows={3} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-label">Wiedervorlage ab</Label>
              <Calendar mode="single" selected={datum ? alsKalendertag(datum) : undefined}
                onSelect={(d) => d && setDatum(ausKalendertag(d))}
                disabled={(d) => ausKalendertag(d) <= heute} className="p-3 pointer-events-auto" />
            </div>
          )}
          <div className="flex gap-3">
            <Button className="flex-1"
              disabled={laeuft || (v.art === "verloren" ? grund.trim() === "" : !datum)}
              onClick={() => bestaetigen(v.art === "verloren" ? { lostReason: grund.trim() } : { datum })}>
              {laeuft ? "Speichern…" : "Geändert bestätigen"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setAendernOffen(false)}>Abbrechen</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ablehnenOffen} onOpenChange={(o) => { setAblehnenOffen(o); if (!o) setAblehnGrund(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vorschlag ablehnen – {v.deal_title ?? ""}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-label">Grund (Pflicht)</Label>
            <Textarea value={ablehnGrund} onChange={(e) => setAblehnGrund(e.target.value)} rows={3}
              placeholder="Warum passt der Vorschlag nicht?" />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" variant="destructive" disabled={laeuft || ablehnGrund.trim() === ""}
              onClick={() => entscheiden.mutate({ id: v.vorschlag_id, aktion: "ablehnen", grund: ablehnGrund.trim() },
                { onSuccess: () => { setAblehnenOffen(false); setAblehnGrund(""); } })}>
              {laeuft ? "Speichern…" : "Ablehnen"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setAblehnenOffen(false)}>Abbrechen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
