import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type WiedervorlageErgebnis = { dealId: string; vorher: string | null; neu: string | null };

/**
 * Setzt oder loescht deals.wiedervorlage_am (YYYY-MM-DD, Kalendertag Berlin).
 *
 * Gibt den vorherigen Wert zurueck, damit der Aufrufer "Rueckgaengig" anbieten kann.
 * Fehler werden hier sichtbar gemeldet (destruktiver Toast), nie still verschluckt.
 */
export function useWiedervorlageSetzen() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, datum }: { dealId: string; datum: string | null }): Promise<WiedervorlageErgebnis> => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt wiedervorlage_am nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: alt, error: leseFehler } = await db
        .from("deals").select("wiedervorlage_am").eq("id", dealId).maybeSingle();
      if (leseFehler) throw leseFehler;
      if (!alt) throw new Error("Deal nicht gefunden oder kein Zugriff.");

      const { data, error } = await db
        .from("deals").update({ wiedervorlage_am: datum }).eq("id", dealId).select("id");
      if (error) throw error;
      // RLS (deals_update) lehnt nicht mit einem Fehler ab, sondern aendert 0 Zeilen.
      // Ohne diese Pruefung saehe ein verweigertes Speichern aus wie ein erfolgreiches.
      if (!data || data.length !== 1) {
        throw new Error("Nicht gespeichert: keine Berechtigung für diesen Deal.");
      }
      return { dealId, vorher: alt.wiedervorlage_am ?? null, neu: datum };
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Wiedervorlage nicht gespeichert", description: err.message }),
    onSettled: (_daten, _fehler, vars) => {
      // Liste "Meine"/"Alle" und den Zaehler in der Seitenleiste (gleicher queryKey-Praefix).
      qc.invalidateQueries({ queryKey: ["eic", "aktionsliste"] });
      qc.invalidateQueries({ queryKey: ["deal", vars.dealId] });
    },
  });
}
