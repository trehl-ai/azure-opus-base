import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VorlageKontakt = {
  contact_id: string;
  name: string | null;
  email: string;
  hauptkontakt: boolean;
  anrede_vorschlag: string;
};

/** detail von get_einzelmail_vorlage(p_deal_id). */
export type EinzelmailVorlage = {
  deal_id: string;
  deal_status: string | null;
  schule: string | null;
  stufe: string | null;
  pipeline: string | null;
  contact_id: string | null;
  empfaenger: string | null;
  kontakt_name: string | null;
  anrede_vorschlag: string | null;
  campaign_id: string | null;
  kampagne: string | null;
  absender_domain: string | null;
  zustaendig_id: string | null;
  zustaendig_name: string | null;
  offene_einzelmail_id: string | null;
  /** Kontakte des Deals mit Adresse (Hauptkontakt zuerst). */
  kontakte: VorlageKontakt[];
};

type Antwort = { ok: boolean; status: string; detail: EinzelmailVorlage | string | null } | null;

/**
 * Vorlage fuer eine Einzelmail (nur admin; die RPC wirft sonst 42501).
 * ok=false wird als Fehler geworfen, nie still zu "keine Daten".
 */
export function useEinzelmailVorlage(dealId: string | null, aktiv: boolean) {
  return useQuery({
    queryKey: ["eic", "einzelmail_vorlage", dealId],
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt get_einzelmail_vorlage nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_einzelmail_vorlage", { p_deal_id: dealId });
      if (error) throw error;
      const antwort = data as Antwort;
      if (!antwort?.ok || !antwort.detail || typeof antwort.detail === "string") {
        throw new Error(antwort?.status ?? "keine Antwort von der Datenbank");
      }
      return antwort.detail;
    },
    enabled: aktiv && !!dealId,
    staleTime: 0,
  });
}
