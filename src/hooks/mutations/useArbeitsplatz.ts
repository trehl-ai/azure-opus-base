import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { resolveActivityAuthorId } from "@/lib/activityAuthor";
import { EINZELMAILS_OFFEN_KEY } from "@/hooks/queries/useEinzelmailsOffen";
import { VORSCHLAEGE_KEY } from "@/hooks/queries/useVorschlaege";

/**
 * Aktionen von "Zu erledigen" als Arbeitsplatz: Einzelmail bearbeiten/anlegen, Deal verloren,
 * Notiz. Jede RPC antwortet mit {ok, status, detail}; ok=false ist ein FEHLER (destruktiver
 * Toast mit Klartext, status und detail), nie ein stiller Erfolg.
 */

type Antwort = { ok: boolean; status: string; detail: string | null } | null;

const FEHLERTEXT: Record<string, string> = {
  betreff_leer: "Betreff fehlt",
  text_leer: "Text fehlt",
  nicht_gefunden: "Nicht gefunden",
  nicht_bearbeitbar: "Diese Einzelmail ist nicht mehr bearbeitbar",
  evtl_schon_gesendet: "Die Mail ist möglicherweise schon rausgegangen – nicht zurückgesetzt",
  email_nicht_am_deal: "Die Adresse gehört zu keinem Kontakt des Deals",
  schon_offene_einzelmail: "Am Deal liegt schon eine offene Einzelmail",
  deal_nicht_gefunden: "Deal nicht gefunden",
  deal_nicht_offen: "Der Deal ist nicht mehr offen",
  kontakt_nicht_am_deal: "Der Kontakt gehört nicht zum Deal",
  kein_hauptkontakt: "Der Deal hat keinen Hauptkontakt",
  kontakt_ohne_email: "Der Kontakt hat keine Mailadresse",
  keine_kampagne: "Keine Kampagne bestimmbar",
  grund_fehlt: "Grund fehlt",
  keine_verloren_stufe: "Die Pipeline hat keine Verloren-Stufe",
  fehler: "Datenbankfehler",
};

export class RpcAbgewiesen extends Error {
  constructor(public status: string, public detail: string | null) {
    super([`${FEHLERTEXT[status] ?? "Abgewiesen"} (${status})`, detail].filter(Boolean).join(" – "));
  }
}

async function rufen(fn: string, args: Record<string, unknown>): Promise<{ status: string; detail: string | null }> {
  // (supabase as any): types.ts ist Lovable-generiert und kennt diese RPCs nicht.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  const antwort = data as Antwort;
  if (!antwort) throw new Error("keine Antwort von der Datenbank");
  if (!antwort.ok) throw new RpcAbgewiesen(antwort.status, antwort.detail);
  return { status: antwort.status, detail: antwort.detail };
}

function useNachladen() {
  const qc = useQueryClient();
  return (dealId?: string) => {
    qc.invalidateQueries({ queryKey: EINZELMAILS_OFFEN_KEY });
    qc.invalidateQueries({ queryKey: ["eic", "aktionsliste"] });
    qc.invalidateQueries({ queryKey: VORSCHLAEGE_KEY });
    if (dealId) {
      qc.invalidateQueries({ queryKey: ["eic", "einzelmail_vorlage", dealId] });
      qc.invalidateQueries({ queryKey: ["deal-activities", dealId] });
    }
  };
}

export function useEinzelmailBearbeiten() {
  const { toast } = useToast();
  const nachladen = useNachladen();
  return useMutation({
    mutationFn: (v: { id: string; betreff: string; text: string; email: string | null }) =>
      rufen("einzelmail_bearbeiten", { p_id: v.id, p_betreff: v.betreff, p_text: v.text, p_email: v.email }),
    onSuccess: ({ status, detail }) =>
      toast({
        title: status === "entwurf" ? "Einzelmail gespeichert – erneut freigeben" : "Einzelmail gespeichert",
        description: detail ?? undefined,
      }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Speichern fehlgeschlagen", description: err.message }),
    onSettled: () => nachladen(),
  });
}

export function useEinzelmailAnlegen() {
  const { toast } = useToast();
  const nachladen = useNachladen();
  return useMutation({
    mutationFn: (v: { dealId: string; betreff: string; text: string; contactId: string | null }) =>
      rufen("einzelmail_anlegen", { p_deal_id: v.dealId, p_betreff: v.betreff, p_text: v.text, p_contact_id: v.contactId }),
    onSuccess: () => toast({ title: "Einzelmail-Entwurf angelegt", description: "Wartet oben auf Freigabe." }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Anlegen fehlgeschlagen", description: err.message }),
    onSettled: (_d, _e, v) => nachladen(v.dealId),
  });
}

export function useDealVerlorenSetzen() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const nachladen = useNachladen();
  return useMutation({
    mutationFn: (v: { dealId: string; grund: string }) =>
      rufen("deal_verloren_setzen", { p_deal_id: v.dealId, p_grund: v.grund }),
    onSuccess: ({ detail }) => toast({ title: "Deal als verloren markiert", description: detail ? `Stufe: ${detail}` : undefined }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Verloren setzen fehlgeschlagen", description: err.message }),
    onSettled: (_d, _e, v) => {
      nachladen(v.dealId);
      qc.invalidateQueries({ queryKey: ["deals-board"] });
    },
  });
}

/** Notiz am Deal — derselbe Weg wie der Notizen-Feed im Deal-Detail
 *  (deal_activities, activity_type='note', auto_generated=false, Session-Client = RLS). */
export function useNotizAnlegen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { dealId: string; text: string }) => {
      const authorId = resolveActivityAuthorId(user?.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("deal_activities").insert({
        deal_id: v.dealId,
        activity_type: "note",
        title: "Notiz",
        description: v.text.trim(),
        status: "completed",
        auto_generated: false,
        owner_user_id: authorId,
        created_by_user_id: authorId,
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Notiz gespeichert" }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Notiz fehlgeschlagen", description: err.message }),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ["deal-activities", v.dealId] });
      qc.invalidateQueries({ queryKey: ["eic", "aktionsliste"] });
    },
  });
}
