import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Letzte Absagen: verlorene Deals mit der juengsten Antwortmail, neueste zuerst.
 *
 * Sichtbarkeit kommt aus der DB (`get_letzte_absagen` filtert ueber
 * `user_can_access_pipeline()`). Nicht clientseitig nachfiltern und nicht umgehen.
 * Die Aussage ist in der RPC bereits bereinigt (ohne Zitat und Metazeilen, max. 400 Zeichen).
 */
export type Absage = {
  antwort_am: string;
  deal_id: string;
  deal_titel: string | null;
  pipeline_name: string | null;
  art: "Stiftung" | "Schule" | "Sonstige";
  lost_reason: string | null;
  aussage: string | null;
};

export function useLetzteAbsagen(limit = 30) {
  return useQuery({
    queryKey: ["eic", "letzte_absagen", limit],
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt get_letzte_absagen nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_letzte_absagen", { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as Absage[];
    },
    staleTime: 60_000,
  });
}
