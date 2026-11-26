import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Einzelmails zur Freigabe (status entwurf / freigegeben / fehler).
 *
 * get_einzelmails_offen() prueft is_admin() selbst und wirft sonst 42501. Die Abfrage
 * laeuft deshalb nur mit `aktiv = true` (admin); fuer alle anderen wird sie gar nicht
 * gestellt. Die Tabelle einzelmailings ist fuer authenticated gesperrt — nur ueber die RPCs.
 */
export type OffeneEinzelmail = {
  einzelmail_id: string;
  status: "entwurf" | "freigegeben" | "fehler";
  deal_id: string;
  schule: string | null;
  stufe: string | null;
  empfaenger: string;
  betreff: string;
  text: string;
  absender_domain: string;
  kampagne: string | null;
  hinweis: string | null;
  kontext: string | null;
  fehler: string | null;
  reihenfolge: number | null;
  freigegeben_am: string | null;
  created_at: string;
  contact_id: string;
  kontakt_name: string | null;
  /** Projektleitung, sonst Owner des Deals (wie get_aktionsliste). */
  zustaendig_id: string | null;
  zustaendig_name: string | null;
};

export const EINZELMAILS_OFFEN_KEY = ["eic", "einzelmails_offen"] as const;

export function useEinzelmailsOffen(aktiv: boolean) {
  return useQuery({
    queryKey: EINZELMAILS_OFFEN_KEY,
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt get_einzelmails_offen nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_einzelmails_offen");
      if (error) throw error;
      return (data ?? []) as OffeneEinzelmail[];
    },
    enabled: aktiv,
    staleTime: 30_000,
  });
}
