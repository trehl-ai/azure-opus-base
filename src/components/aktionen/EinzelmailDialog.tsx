import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { useAuth } from "@/contexts/AuthContext";
import { useEinzelmailVorlage, type VorlageKontakt } from "@/hooks/queries/useEinzelmailVorlage";
import type { OffeneEinzelmail } from "@/hooks/queries/useEinzelmailsOffen";
import { useEinzelmailAnlegen, useEinzelmailBearbeiten } from "@/hooks/mutations";
import { anredeTauschen, istFreemail, mailtextVorlage } from "@/lib/einzelmail";

/** Warnungen vor Freigabe/Speichern: private Adresse, fremde Zustaendigkeit. */
export function EinzelmailWarnungen({ email, zustaendigId, zustaendigName }: {
  email: string | null | undefined; zustaendigId: string | null | undefined; zustaendigName: string | null | undefined;
}) {
  const { user } = useAuth();
  const fremd = !!zustaendigId && !!user?.id && zustaendigId !== user.id;
  if (!istFreemail(email) && !fremd) return null;
  return (
    <div className="space-y-1">
      {istFreemail(email) && (
        <p className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[12px] text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Private Adresse ({email}) – bewusst?
        </p>
      )}
      {fremd && (
        <p className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[12px] text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Deal von {zustaendigName ?? "anderer Projektleitung"} – abgestimmt?
        </p>
      )}
    </div>
  );
}

type Props =
  | { modus: "bearbeiten"; m: OffeneEinzelmail; offen: boolean; setOffen: (v: boolean) => void }
  | { modus: "anlegen"; dealId: string; titel: string; offen: boolean; setOffen: (v: boolean) => void };

/**
 * Einzelmail bearbeiten (bestehender Entwurf/Freigabe/Fehler) oder neu schreiben (nur admin).
 * Empfaenger nur aus den Kontakten des Deals (get_einzelmail_vorlage); die DB prueft das ein
 * zweites Mal. Nach dem Speichern steht die Mail im Entwurf und muss erneut freigegeben werden.
 */
export function EinzelmailDialog(props: Props) {
  const { offen, setOffen } = props;
  const dealId = props.modus === "bearbeiten" ? props.m.deal_id : props.dealId;
  const vorlage = useEinzelmailVorlage(dealId, offen);
  const bearbeiten = useEinzelmailBearbeiten();
  const anlegen = useEinzelmailAnlegen();
  const [kontaktId, setKontaktId] = useState<string>("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [geladen, setGeladen] = useState(false);

  const v = vorlage.data;
  const kontakte: VorlageKontakt[] = v?.kontakte ?? [];
  const kontakt = kontakte.find((k) => k.contact_id === kontaktId);

  // Einmal je Oeffnen vorbefuellen, danach gehoert der Inhalt dem Nutzer.
  useEffect(() => {
    if (!offen) { setGeladen(false); return; }
    if (geladen || !v) return;
    if (props.modus === "bearbeiten") {
      setKontaktId(props.m.contact_id);
      setBetreff(props.m.betreff);
      setText(props.m.text);
    } else {
      const start = v.kontakte.find((k) => k.hauptkontakt) ?? v.kontakte[0];
      setKontaktId(start?.contact_id ?? "");
      setBetreff("");
      setText(mailtextVorlage(start?.anrede_vorschlag ?? v.anrede_vorschlag, v.absender_domain));
    }
    setGeladen(true);
  }, [offen, geladen, v, props]);

  const kontaktWechseln = (id: string) => {
    if (props.modus === "anlegen") {
      const neu = kontakte.find((k) => k.contact_id === id);
      setText((t) => anredeTauschen(t, kontakt?.anrede_vorschlag ?? null, neu?.anrede_vorschlag ?? null));
    }
    setKontaktId(id);
  };

  const laeuft = bearbeiten.isPending || anlegen.isPending;
  const unvollstaendig = !kontakt || betreff.trim() === "" || text.trim() === "";
  const offeneVorhanden = props.modus === "anlegen" && !!v?.offene_einzelmail_id;
  const ohneKampagne = props.modus === "anlegen" && !!v && !v.campaign_id;
  const domain = props.modus === "bearbeiten" ? props.m.absender_domain : v?.absender_domain;

  const speichern = () => {
    if (!kontakt) return;
    const fertig = { onSuccess: () => setOffen(false) };
    if (props.modus === "bearbeiten") {
      bearbeiten.mutate({ id: props.m.einzelmail_id, betreff: betreff.trim(), text, email: kontakt.email }, fertig);
    } else {
      anlegen.mutate({ dealId: props.dealId, betreff: betreff.trim(), text, contactId: kontakt.contact_id }, fertig);
    }
  };

  const titel = props.modus === "bearbeiten"
    ? `Einzelmail bearbeiten – ${props.m.schule ?? "(ohne Schule)"}`
    : `Einzelmail schreiben – ${props.titel}`;

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{titel}</DialogTitle></DialogHeader>
        {vorlage.isLoading || vorlage.error ? (
          <ListenHinweis laedt={vorlage.isLoading} fehler={(vorlage.error as Error) ?? null} leerText="" />
        ) : (
          <div className="space-y-3 text-[13px]">
            <p className="text-[12px] text-muted-foreground">
              {[v?.stufe, v?.kampagne].filter(Boolean).join(" · ")}
              {domain ? ` · von ${domain}` : ""}
              {v?.zustaendig_name ? ` · Projektleitung: ${v.zustaendig_name}` : ""}
            </p>
            {offeneVorhanden && (
              <p className="rounded bg-red-50 px-2 py-1 text-[12px] text-red-800">
                Am Deal liegt schon eine offene Einzelmail – bitte dort bearbeiten.
              </p>
            )}
            {ohneKampagne && (
              <p className="rounded bg-red-50 px-2 py-1 text-[12px] text-red-800">
                Keine Kampagne bestimmbar (Pipeline ohne Standard oder Bundesland fehlt).
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-label">Empfänger</Label>
              {kontakte.length === 0 ? (
                <p className="text-[12px] text-red-800">Kein Kontakt mit Mailadresse am Deal.</p>
              ) : (
                <Select value={kontaktId} onValueChange={kontaktWechseln}>
                  <SelectTrigger><SelectValue placeholder="Kontakt wählen" /></SelectTrigger>
                  <SelectContent>
                    {kontakte.map((k) => (
                      <SelectItem key={k.contact_id} value={k.contact_id}>
                        {[k.name, k.email].filter(Boolean).join(" · ")}{k.hauptkontakt ? " (Hauptkontakt)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <EinzelmailWarnungen email={kontakt?.email} zustaendigId={v?.zustaendig_id} zustaendigName={v?.zustaendig_name} />
            <div className="space-y-1.5">
              <Label className="text-label">Betreff</Label>
              <Input value={betreff} onChange={(e) => setBetreff(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Text</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} className="font-sans text-[13px]" />
            </div>
            <p className="text-[12px] text-muted-foreground">
              Nach dem Speichern steht die Mail im Entwurf und muss erneut freigegeben werden.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" disabled={laeuft || unvollstaendig || offeneVorhanden || ohneKampagne} onClick={speichern}>
                {laeuft ? "Speichern…" : props.modus === "bearbeiten" ? "Speichern" : "Als Entwurf anlegen"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setOffen(false)}>Abbrechen</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
