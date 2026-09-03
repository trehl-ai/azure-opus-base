import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { MAILING_STATUS, datumDe, textOderNull, useMailings, type Mailing } from "./linienDaten";

const KEINE_BERECHTIGUNG = "Keine Berechtigung für diese Änderung. Bitte Tomi ansprechen.";
const NUMMER_VERGEBEN = "Diese Nummer ist in dieser Kampagne schon vergeben.";
const FREIGABE_UNVOLLSTAENDIG =
  "Die Freigabe braucht einen Text. Bitte zuerst den Mailingtext hinterlegen.";

/** Fehlercodes der drei CHECKs/UNIQUEs an campaign_mailings in Klartext uebersetzen. */
function meldung(error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error(NUMMER_VERGEBEN);
  if (error.code === "23514") return new Error(FREIGABE_UNVOLLSTAENDIG);
  if (error.code === "42501") return new Error(KEINE_BERECHTIGUNG);
  return new Error(error.message);
}

function Zeitraum({ m }: { m: Mailing }) {
  const ab = datumDe(m.versendet_ab);
  const bis = datumDe(m.versendet_bis);
  // "laeuft" statt eines offenen Bindestrichs: ein Versand ohne Enddatum ist nicht
  // unbekannt, sondern noch nicht fertig.
  if (ab && !bis && m.status === "versendet") return <>{ab} – läuft</>;
  if (ab && bis) return <>{ab} – {bis}</>;
  if (ab) return <>ab {ab}</>;
  const geplant = datumDe(m.geplant_ab);
  return geplant ? <>geplant ab {geplant}</> : <>—</>;
}

export function MailingListe({ campaignId }: { campaignId: string }) {
  const { data, isLoading, error } = useMailings(campaignId);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [offen, setOffen] = useState<string | null>(null);
  const [freigabe, setFreigabe] = useState<Mailing | null>(null);
  const [bearbeiten, setBearbeiten] = useState<Mailing | null>(null);
  const [neu, setNeu] = useState(false);

  const [entwurf, setEntwurf] = useState({ betreff: "", text: "" });
  const [neuesMailing, setNeuesMailing] = useState({ nummer: "", name: "", geplant_ab: "" });

  const neuLaden = () => qc.invalidateQueries({ queryKey: ["eic", "campaign_mailings", campaignId] });
  const kachelnNeuLaden = () => qc.invalidateQueries({ queryKey: ["eic", "campaign_overview"] });

  /** Gemeinsamer Schreibweg. .select() ist Pflicht: ohne Rueckgabe ist eine von RLS abgelehnte Zeile nicht von einem Erfolg zu unterscheiden. */
  const schreiben = async (id: string, felder: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: zeilen, error: fehler } = await (supabase as any)
      .from("campaign_mailings")
      .update(felder)
      .eq("id", id)
      .select("id");
    if (fehler) throw meldung(fehler);
    if (!zeilen || zeilen.length === 0) throw new Error(KEINE_BERECHTIGUNG);
  };

  const freigabeMutation = useMutation({
    mutationFn: async (m: Mailing) =>
      schreiben(m.id, {
        status: "freigegeben",
        freigegeben_von: user?.id ?? null,
        freigegeben_am: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast({ title: "Mailing freigegeben" });
      setFreigabe(null);
      neuLaden();
      kachelnNeuLaden();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fehler", description: e.message }),
  });

  const textMutation = useMutation({
    mutationFn: async (m: Mailing) =>
      schreiben(m.id, { betreff: textOderNull(entwurf.betreff), text: textOderNull(entwurf.text) }),
    onSuccess: () => {
      toast({ title: "Mailing gespeichert" });
      setBearbeiten(null);
      neuLaden();
      kachelnNeuLaden();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fehler", description: e.message }),
  });

  const pausierenMutation = useMutation({
    mutationFn: async (m: Mailing) => schreiben(m.id, { status: "pausiert" }),
    onSuccess: () => {
      toast({ title: "Mailing pausiert" });
      neuLaden();
      kachelnNeuLaden();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fehler", description: e.message }),
  });

  const anlegenMutation = useMutation({
    mutationFn: async () => {
      const nummer = parseInt(neuesMailing.nummer, 10);
      if (!Number.isFinite(nummer)) throw new Error("Bitte eine Nummer angeben.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: zeilen, error: fehler } = await (supabase as any)
        .from("campaign_mailings")
        .insert({
          campaign_id: campaignId,
          nummer,
          name: textOderNull(neuesMailing.name),
          geplant_ab: textOderNull(neuesMailing.geplant_ab),
          status: "entwurf",
        })
        .select("id");
      if (fehler) throw meldung(fehler);
      if (!zeilen || zeilen.length === 0) throw new Error(KEINE_BERECHTIGUNG);
    },
    onSuccess: () => {
      toast({ title: "Mailing angelegt" });
      setNeu(false);
      setNeuesMailing({ nummer: "", name: "", geplant_ab: "" });
      neuLaden();
      kachelnNeuLaden();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fehler", description: e.message }),
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-body font-semibold text-foreground">Mailings</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setNeu(true)}>
          <Plus className="h-4 w-4" /> Neues Mailing
        </Button>
      </div>

      {isLoading || error || !data || data.length === 0 ? (
        <ListenHinweis
          laedt={isLoading}
          fehler={(error as Error) ?? null}
          leerText="Für diese Kampagne ist noch kein Mailing angelegt."
        />
      ) : (
        <div className="divide-y divide-border">
          {data.map((m) => {
            const aufgeklappt = offen === m.id;
            const hatText = !!m.text && m.text.trim().length > 0;
            return (
              <div key={m.id} className="py-3">
                <button
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => setOffen(aufgeklappt ? null : m.id)}
                >
                  {aufgeklappt ? (
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="w-8 shrink-0 text-body font-semibold text-muted-foreground">
                    {m.nummer}
                  </span>
                  <span className="flex-1">
                    <span className="text-body text-foreground">{m.name ?? "Ohne Namen"}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      <Zeitraum m={m} />
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {MAILING_STATUS[m.status] ?? m.status}
                  </Badge>
                </button>

                {aufgeklappt && (
                  <div className="ml-11 mt-3 space-y-3">
                    <div>
                      <p className="text-label text-muted-foreground">Betreff</p>
                      <p className="text-body text-foreground">{m.betreff ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-label text-muted-foreground">Text</p>
                      {/* whitespace-pre-wrap: der Mailtext traegt seine Absaetze selbst. */}
                      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-[12px] text-foreground">
                        {m.text ?? "— noch kein Text hinterlegt —"}
                      </pre>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.status === "entwurf" && hatText && (
                        <Button size="sm" onClick={() => setFreigabe(m)}>
                          Freigeben
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEntwurf({ betreff: m.betreff ?? "", text: m.text ?? "" });
                          setBearbeiten(m);
                        }}
                      >
                        Bearbeiten
                      </Button>
                      {m.status !== "pausiert" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pausierenMutation.mutate(m)}
                          disabled={pausierenMutation.isPending}
                        >
                          Pausieren
                        </Button>
                      )}
                    </div>
                    {/* Es gibt bewusst kein Loeschen: campaign_mailings erlaubt kein DELETE. */}
                    <p className="text-[12px] text-muted-foreground">
                      Mailings werden nicht gelöscht, sondern pausiert.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Freigabe: Volltext im Dialog, damit die Freigabe eine Pruefung ist und kein Klick. */}
      <Dialog open={!!freigabe} onOpenChange={(v) => !v && setFreigabe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mailing freigeben</DialogTitle>
          </DialogHeader>
          {freigabe && (
            <div className="space-y-3">
              <div>
                <p className="text-label text-muted-foreground">Betreff</p>
                <p className="text-body text-foreground">{freigabe.betreff ?? "—"}</p>
              </div>
              <div>
                <p className="text-label text-muted-foreground">Text</p>
                <pre className="mt-1 max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-[12px] text-foreground">
                  {freigabe.text}
                </pre>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Mit der Freigabe wird dieser Text zum Versand freigegeben und Ihr Name als
                freigebende Person hinterlegt.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreigabe(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => freigabe && freigabeMutation.mutate(freigabe)}
              disabled={freigabeMutation.isPending}
            >
              Freigeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bearbeiten */}
      <Dialog open={!!bearbeiten} onOpenChange={(v) => !v && setBearbeiten(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mailing bearbeiten</DialogTitle>
          </DialogHeader>
          {bearbeiten?.status === "freigegeben" && (
            // Der Trigger setzt die Freigabe bei jeder Text- oder Betreffaenderung
            // zurueck. Das ist gewollt — hier wird darauf hingewiesen, nicht dagegen
            // angearbeitet.
            <p className="rounded-lg bg-amber-50 p-3 text-[13px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
              Eine Änderung setzt die Freigabe zurück.
            </p>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-label">Betreff</Label>
              <Input
                value={entwurf.betreff}
                onChange={(e) => setEntwurf((v) => ({ ...v, betreff: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Text</Label>
              <Textarea
                className="font-mono text-[12px]"
                rows={16}
                value={entwurf.text}
                onChange={(e) => setEntwurf((v) => ({ ...v, text: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBearbeiten(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => bearbeiten && textMutation.mutate(bearbeiten)}
              disabled={textMutation.isPending}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neues Mailing */}
      <Dialog open={neu} onOpenChange={setNeu}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neues Mailing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-label">
                Nummer <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={neuesMailing.nummer}
                onChange={(e) => setNeuesMailing((v) => ({ ...v, nummer: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Name</Label>
              <Input
                value={neuesMailing.name}
                onChange={(e) => setNeuesMailing((v) => ({ ...v, name: e.target.value }))}
                placeholder="z.B. Erstansprache"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Geplant ab</Label>
              <Input
                type="date"
                value={neuesMailing.geplant_ab}
                onChange={(e) => setNeuesMailing((v) => ({ ...v, geplant_ab: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeu(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => anlegenMutation.mutate()}
              disabled={anlegenMutation.isPending || !neuesMailing.nummer.trim()}
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
