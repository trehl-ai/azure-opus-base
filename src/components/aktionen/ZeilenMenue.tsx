import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EinzelmailDialog } from "@/components/aktionen/EinzelmailDialog";
import { useDealVerlorenSetzen, useNotizAnlegen } from "@/hooks/mutations";

/** Dialog mit Pflichttext; gemeinsam fuer "Verloren…" und "Notiz…". */
function TextDialog({ titel, label, platzhalter, knopf, destruktiv, offen, setOffen, laeuft, absenden }: {
  titel: string; label: string; platzhalter: string; knopf: string; destruktiv?: boolean;
  offen: boolean; setOffen: (v: boolean) => void; laeuft: boolean; absenden: (text: string, fertig: () => void) => void;
}) {
  const [text, setText] = useState("");
  const schliessen = (v: boolean) => { setOffen(v); if (!v) setText(""); };
  return (
    <Dialog open={offen} onOpenChange={schliessen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{titel}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-label">{label}</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={platzhalter} rows={4} />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" variant={destruktiv ? "destructive" : "default"}
              disabled={laeuft || text.trim() === ""}
              onClick={() => absenden(text.trim(), () => schliessen(false))}>
              {laeuft ? "Speichern…" : knopf}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => schliessen(false)}>Abbrechen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Menue "…" je Zeile in "Zu erledigen": Einzelmail schreiben (nur admin), Verloren, Notiz.
 * Die Wiedervorlage bleibt der eigene Knopf daneben. Zugriff prueft jeweils die DB
 * (deal_verloren_setzen: admin oder zustaendig + Pipeline; Notiz: RLS auf deal_activities).
 */
export function ZeilenMenue({ dealId, titel, isAdmin, offeneEinzelmail }: {
  dealId: string; titel: string; isAdmin: boolean; offeneEinzelmail: boolean;
}) {
  const [mailOffen, setMailOffen] = useState(false);
  const [verlorenOffen, setVerlorenOffen] = useState(false);
  const [notizOffen, setNotizOffen] = useState(false);
  const verloren = useDealVerlorenSetzen();
  const notiz = useNotizAnlegen();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" aria-label={`Weitere Aktionen – ${titel}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isAdmin && (
            <DropdownMenuItem disabled={offeneEinzelmail} onSelect={() => setMailOffen(true)}>
              Einzelmail schreiben…{offeneEinzelmail ? " (schon offen)" : ""}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setNotizOffen(true)}>Notiz…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setVerlorenOffen(true)}>
            Verloren…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isAdmin && (
        <EinzelmailDialog modus="anlegen" dealId={dealId} titel={titel} offen={mailOffen} setOffen={setMailOffen} />
      )}
      <TextDialog
        titel={`Deal verloren – ${titel}`} label="Grund (Pflicht)" platzhalter="Warum ist der Deal verloren?"
        knopf="Als verloren markieren" destruktiv offen={verlorenOffen} setOffen={setVerlorenOffen}
        laeuft={verloren.isPending}
        absenden={(grund, fertig) => verloren.mutate({ dealId, grund }, { onSuccess: fertig })}
      />
      <TextDialog
        titel={`Notiz – ${titel}`} label="Notiz" platzhalter="Notiz zum Deal"
        knopf="Notiz speichern" offen={notizOffen} setOffen={setNotizOffen}
        laeuft={notiz.isPending}
        absenden={(text, fertig) => notiz.mutate({ dealId, text }, { onSuccess: fertig })}
      />
    </>
  );
}
