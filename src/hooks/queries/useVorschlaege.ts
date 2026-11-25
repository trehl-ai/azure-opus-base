import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Offene Antwort-Vorschlaege (antwort_vorschlaege, status 'offen'), die der Nutzer sehen darf.
 * Sichtbarkeit liegt in get_vorschlaege_offen(): admin alle, sonst nur zustaendige Deals
 * (Projektleitung, sonst Owner) mit Pipeline-Zugriff. Nicht clientseitig nachfiltern.
 */
export type VorschlagArt = "verloren" | "wiedervorlage" | "einzelmail" | "adresse" | "keine_aktion";

export type Vorschlag = {
  vorschlag_id: string;
  deal_id: string;
  deal_title: string | null;
  art: VorschlagArt;
  begruendung: string;
  lost_reason: string | null;
  wiedervorlage_am: string | null;
  einzelmail_id: string | null;
  neue_email: string | null;
  reply_activity_id: string | null;
  erstellt_von: string;
  created_at: string;
};

export const VORSCHLAEGE_KEY = ["eic", "vorschlaege_offen"] as const;

export function useVorschlaegeOffen() {
  return useQuery({
    queryKey: VORSCHLAEGE_KEY,
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt get_vorschlaege_offen nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_vorschlaege_offen");
      if (error) throw error;
      return (data ?? []) as Vorschlag[];
    },
    staleTime: 30_000,
  });
}
