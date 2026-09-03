import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PHASEN, textOderNull, type Linie } from "./linienDaten";

const LINK_UNGUELTIG =
  "Der Buchungslink muss mit http:// oder https:// beginnen. Bitte prüfen oder Feld leer lassen.";
const KEINE_BERECHTIGUNG = "Keine Berechtigung zum Bearbeiten dieser Kampagne. Bitte Tomi ansprechen.";

/**
 * Stammdaten einer Linie. BEWUSST NICHT enthalten: pipeline_id, segmente,
 * bundesland_modus, bundeslaender. Das ist die Zielgruppenregel — sie bestimmt die
 * Zahlen JEDER Kachel, und eine beilaeufige Aenderung hier saehe aus wie ein
 * Textfeld und waere eine Auswertungsaenderung. Die Regel wird in der Detailseite
 * nur angezeigt.
 */
export function EditLinieSheet({
  linie,
  open,
  onOpenChange,
}: {
  linie: Linie;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: linie.name,
    phase: linie.phase,
    verantwortlich: linie.verantwortlich ?? "",
    zielgruppe_text: linie.zielgruppe_text ?? "",
    themen: linie.themen ?? "",
    ziel_2026: linie.ziel_2026 ?? "",
    ziel_2027: linie.ziel_2027 ?? "",
    buchungslink: linie.buchungslink ?? "",
    notiz: linie.notiz ?? "",
  });

  const setzen = (feld: string, wert: string) => setForm((v) => ({ ...v, [feld]: wert }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Der Name ist ein Pflichtfeld.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .update({
          name: form.name.trim(),
          phase: form.phase,
          // Leere Textfelder als null, nicht als "": der CHECK auf buchungslink
          // lehnt den Leerstring ab (23514) und liesse das ganze UPDATE scheitern.
          verantwortlich: textOderNull(form.verantwortlich),
          zielgruppe_text: textOderNull(form.zielgruppe_text),
          themen: textOderNull(form.themen),
          ziel_2026: textOderNull(form.ziel_2026),
          ziel_2027: textOderNull(form.ziel_2027),
          buchungslink: textOderNull(form.buchungslink),
          notiz: textOderNull(form.notiz),
        })
        .eq("id", linie.campaign_id)
        .select("id");

      // Ein von RLS abgelehntes UPDATE ist PostgREST-seitig 204 ohne Zeilen und
      // KEIN Fehler; ohne .select() saehe die Ablehnung wie ein Erfolg aus.
      if (error) {
        if (error.code === "23514") throw new Error(LINK_UNGUELTIG);
        if (error.code === "42501") throw new Error(KEINE_BERECHTIGUNG);
        throw error;
      }
      if (!data || data.length === 0) throw new Error(KEINE_BERECHTIGUNG);
    },
    onSuccess: () => {
      toast({ title: "Kampagne aktualisiert" });
      qc.invalidateQueries({ queryKey: ["eic", "campaign_overview"] });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-section-title">Kampagne bearbeiten</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-label">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={form.name} onChange={(e) => setzen("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Phase</Label>
              <Select value={form.phase} onValueChange={(v) => setzen("phase", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASEN.map((p) => (
                    <SelectItem key={p.wert} value={p.wert}>
                      {p.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Verantwortlich</Label>
              <Input
                value={form.verantwortlich}
                onChange={(e) => setzen("verantwortlich", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">Zielgruppe (Beschreibung)</Label>
            <Input
              value={form.zielgruppe_text}
              onChange={(e) => setzen("zielgruppe_text", e.target.value)}
              placeholder="z.B. Grundschulen bundesweit"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">Themen</Label>
            <Textarea value={form.themen} onChange={(e) => setzen("themen", e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Ziel 2026</Label>
              <Input value={form.ziel_2026} onChange={(e) => setzen("ziel_2026", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Ziel 2027</Label>
              <Input value={form.ziel_2027} onChange={(e) => setzen("ziel_2027", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">Buchungslink</Label>
            <Input
              value={form.buchungslink}
              onChange={(e) => setzen("buchungslink", e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">Notiz</Label>
            <Textarea value={form.notiz} onChange={(e) => setzen("notiz", e.target.value)} rows={3} />
          </div>

          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim()}
          >
            {mutation.isPending ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
