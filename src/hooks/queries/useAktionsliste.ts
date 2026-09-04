import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Offene Vorgaenge nach Liegezeit ("Was wartet auf mich").
 *
 * Die Auswahl der Stufen liegt in der DB: `pipeline_stages.braucht_aktion`
 * steuert, welche Stufe hier auftaucht. Hier steht bewusst KEINE Stufenliste —
 * eine im Frontend gehaertete Auswahl waere eine zweite Wahrheit, die beim
 * naechsten Pipeline-Umbau still falsch wird.
 *
 * Sichtbarkeit kommt ebenfalls aus der DB (`user_can_access_pipeline()`):
 * wer nur eine Pipeline sehen darf, bekommt hier auch nur diese. Nicht
 * clientseitig nachfiltern und erst recht nicht umgehen.
 */
export type Aktion = {
  deal_id: string;
  deal_title: string | null;
  company_id: string | null;
  company_name: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  stage_position: number | null;
  owner_user_id: string | null;
  owner_name: string | null;
  value_amount: number | null;
  /** Datum, seit dem der Vorgang unbewegt liegt. Heisst in der RPC NICHT
   *  `letzte_bewegung` — gemessen am 04.09.2026 gegen get_aktionsliste. */
  wartet_seit: string | null;
  liegetage: number;
  /** Der Vorgang wurde in dieser Stufe noch nie angefasst. Die RPC zieht
   *  diese Zeilen nach oben; die Liste sortiert trotzdem nach Liegezeit und
   *  zeigt das Merkmal stattdessen an der Zeile. */
  nie_bearbeitet: boolean;
  letzte_antwort: string | null;
  antwort_text: string | null;
  contact_id: string | null;
  kontakt_name: string | null;
  kontakt_email: string | null;
  bundesland: string | null;
};

/** Grenze zwischen den beiden Abschnitten: "ueber 30 Tage" heisst ab 31. */
export const LIEGE_SCHWELLE = 30;

/** Ab hier wird die Liegezeit dezent hervorgehoben. */
export const LIEGE_HINWEIS = 14;

export function useAktionsliste() {
  return useQuery({
    queryKey: ["eic", "aktionsliste"],
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt get_aktionsliste nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_aktionsliste", { p_limit: 100 });
      if (error) throw error;
      // ⚠ Die RPC sortiert NICHT rein nach Liegezeit, sondern zuerst nach
      // `nie_bearbeitet` (gemessen 04.09.2026: ein 7-Tage-Vorgang stand vor
      // einem 87-Tage-Vorgang). Die Sortierung nach Liegezeit passiert deshalb
      // in der Ansicht, siehe Aktionen.tsx.
      return (data ?? []) as Aktion[];
    },
  });
}
