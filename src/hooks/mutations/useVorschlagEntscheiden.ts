import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VORSCHLAEGE_KEY } from "@/hooks/queries/useVorschlaege";
import { EINZELMAILS_OFFEN_KEY } from "@/hooks/queries/useEinzelmailsOffen";

export type Entscheidung = {
  id: string;
  aktion: "bestaetigen" | "ablehnen";
  lostReason?: string | null;
  datum?: string | null;   // YYYY-MM-DD
  grund?: string | null;
};

type Antwort = { ok: boolean; status: string; detail: string | null } | null;

const STATUS_TEXT: Record<string, string> = {
  bestaetigt: "Vorschlag bestätigt",
  geaendert: "Vorschlag geändert bestätigt",
  abgelehnt: "Vorschlag abgelehnt",
};

/**
 * Entscheidet einen Antwort-Vorschlag (vorschlag_entscheiden). ok=false ist ein FEHLER
 * (Toast mit status und detail), nie ein stiller Erfolg. Danach Liste, Zaehler,
 * Vorschlaege und Einzelmail-Karte neu laden.
 */
export function useVorschlagEntscheiden() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (e: Entscheidung) => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt vorschlag_entscheiden nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("vorschlag_entscheiden", {
        p_id: e.id,
        p_aktion: e.aktion,
        p_lost_reason: e.lostReason ?? null,
        p_datum: e.datum ?? null,
        p_grund: e.grund ?? null,
      });
      if (error) throw error;
      const a = data as Antwort;
      if (!a?.ok) {
        throw new Error([a?.status ?? "keine Antwort von der Datenbank", a?.detail].filter(Boolean).join(": "));
      }
      return a;
    },
    onSuccess: (a) => toast({ title: STATUS_TEXT[a!.status] ?? "Vorschlag entschieden", description: a!.detail ?? undefined }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Vorschlag nicht ausgeführt", description: err.message }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: VORSCHLAEGE_KEY });
      qc.invalidateQueries({ queryKey: ["eic", "aktionsliste"] });
      qc.invalidateQueries({ queryKey: EINZELMAILS_OFFEN_KEY });
    },
  });
}
