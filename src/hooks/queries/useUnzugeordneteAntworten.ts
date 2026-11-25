import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Nicht zugeordnete Antworten (intake_unzugeordnet, status 'offen').
 *
 * Die Intake-Workflows (PWkk, DQWG) legen hier jede Mail ab, die sie keinem Kontakt
 * zuordnen konnten. Lesen erlaubt RLS fuer can_write_deals() (admin, management,
 * projektmanager); die Karte zeigt sie nur admin.
 */
export type UnzugeordneteAntwort = {
  id: string;
  eingang_at: string;
  absender: string | null;
  betreff: string | null;
  typ: string | null;
  grund: string | null;
};

export function useUnzugeordneteAntworten(aktiv: boolean) {
  return useQuery({
    queryKey: ["eic", "intake_unzugeordnet", "offen"],
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt intake_unzugeordnet nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("intake_unzugeordnet")
        .select("id, eingang_at, absender, betreff, typ, grund")
        .eq("status", "offen")
        .order("eingang_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as UnzugeordneteAntwort[];
    },
    enabled: aktiv,
    staleTime: 30_000,
  });
}
