import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Datenschicht der KAMPAGNENLINIEN (Vertriebsboost-Masterliste).
 *
 * Bewusst getrennt von `kampagnenDaten.ts`: die beiden Modelle schneiden die
 * Wirklichkeit verschieden und teilen keine Zeile.
 *   kampagnenDaten.ts  Marke (WerteRaum, Viktoria) -> Unterkampagne je Bundeslandwelle.
 *                      Beantwortet "wie laeuft der Versand gerade".
 *   linienDaten.ts     Linie (WerteRaum 1.0/2.0/3.0, VR …) -> Mailing mit Text und
 *                      Freigabe. Beantwortet "welche Linien haben wir, wo stehen
 *                      sie, was fehlt noch".
 * Eine gemeinsame Datei haette suggeriert, dass die eine Sicht aus der anderen
 * ableitbar ist. Sie ist es nicht.
 */

/** Eine Zeile aus get_campaign_overview(). 30 Spalten, bereits nach sortierung sortiert. */
export type Linie = {
  campaign_id: string;
  name: string;
  phase: string;
  sortierung: number;
  verantwortlich: string | null;
  konzept_slug: string | null;
  pipeline_name: string | null;
  notiz: string | null;
  zielgruppe_text: string | null;
  themen: string | null;
  ziel_2026: string | null;
  ziel_2027: string | null;
  buchungslink: string | null;
  zielgruppe: number;
  /** Adressen mit brauchbarer Mailadresse. Nenner des Ablauffortschritts. */
  erreichbar: number;
  angeschrieben: number;
  /** Gewonnen oder verloren — braucht keine weitere Mail, zaehlt als erledigt. */
  abgeschlossen: number;
  ausstehend: number;
  nicht_erreichbar: number;
  /** Wellen mit `zaehlt_als_welle`, Status versendet oder freigegeben. Entwuerfe zaehlen nicht. */
  wellen_geplant: number;
  /**
   * Mittel der Erreichungsgrade aller geplanten Wellen, Nenner nur `erreichbar`.
   * `null` = keine Welle geplant. NICHT im Frontend nachrechnen — die Formel steht
   * in get_campaign_overview() und nur dort.
   */
  ablauf_prozent: number | null;
  antworten: number;
  klicks: number;
  bounces: number;
  auftraege: number;
  auftraege_wert: number | null;
  letzte_mail: string | null;
  mailings_gesamt: number;
  mailings_ohne_freigabe: number;
  mailings_versendet: number;
};

export type Mailing = {
  id: string;
  campaign_id: string;
  nummer: number;
  name: string | null;
  betreff: string | null;
  text: string | null;
  status: string;
  freigegeben_von: string | null;
  freigegeben_am: string | null;
  workflow_id: string | null;
  geplant_ab: string | null;
  versendet_ab: string | null;
  versendet_bis: string | null;
  notiz: string | null;
};

export const PHASEN = [
  { wert: "live", titel: "Live" },
  { wert: "vorbereitung", titel: "In Vorbereitung" },
  { wert: "backlog", titel: "Backlog" },
] as const;

export const MAILING_STATUS: Record<string, string> = {
  entwurf: "Entwurf",
  freigegeben: "Freigegeben",
  versendet: "Versendet",
  pausiert: "Pausiert",
};

/**
 * Verweis von einer Linie auf die operative Versandsteuerung.
 *
 * Schluessel ist `konzept_slug` und nicht der Name: der Slug ist ein
 * Identitaetsmerkmal, der Name ist Anzeigetext und aendert sich (aus
 * "WerteRaum 2.0 — Bundesweit" wird morgen eine andere Schreibweise, ohne dass
 * jemand an diese Datei denkt).
 *
 * ⚠ Ausnahme "VR Smart in Motion": diese Zeile traegt `konzept_slug = NULL`,
 * gemessen am 03.09.2026. Sie ist deshalb hier ueber den Namen gefuehrt — als
 * ausdruecklicher Einzelfall, nicht als zweiter Mechanismus. Sobald jemand ihren
 * konzept_slug setzt, faellt der Eintrag ersatzlos weg; das ist eine
 * Datenkorrektur, keine Codeaenderung.
 */
const OPERATIV_JE_SLUG: Record<string, string> = {
  werteraum: "/campaigns/werteraum",
  "fit-und-aktiv": "/campaigns/vr-stiftungen",
};
const OPERATIV_JE_NAME: Record<string, string> = {
  "VR Smart in Motion": "/campaigns/vr-stiftungen",
};

/** Pfad der Versandsteuerung, oder null wenn es fuer diese Linie keine gibt. */
export function operativerPfad(linie: Pick<Linie, "konzept_slug" | "name">): string | null {
  if (linie.konzept_slug && OPERATIV_JE_SLUG[linie.konzept_slug]) {
    return OPERATIV_JE_SLUG[linie.konzept_slug];
  }
  return OPERATIV_JE_NAME[linie.name] ?? null;
}

export function useLinien() {
  return useQuery({
    queryKey: ["eic", "campaign_overview"],
    queryFn: async () => {
      // (supabase as any): types.ts ist Lovable-generiert und kennt die RPC nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_campaign_overview");
      if (error) throw error;
      return (data ?? []) as Linie[];
    },
  });
}

export function useLinie(id: string | undefined) {
  const alle = useLinien();
  return {
    ...alle,
    data: alle.data?.find((l) => l.campaign_id === id),
  };
}

export function useMailings(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["eic", "campaign_mailings", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("campaign_mailings")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("nummer");
      if (error) throw error;
      return (data ?? []) as Mailing[];
    },
  });
}

export type LinienAufgabe = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_user_id: string | null;
  completed_at: string | null;
};

export function useLinienAufgaben(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["eic", "campaign_tasks", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, title, status, due_date, assigned_user_id, completed_at")
        .eq("campaign_id", campaignId)
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as LinienAufgabe[];
    },
  });
}

/**
 * Die Zielgruppenregel einer Linie. Steht NICHT in get_campaign_overview — die RPC
 * liefert nur den aufgeloesten pipeline_name. Fuer die Detailseite werden die vier
 * Felder deshalb direkt aus campaigns gelesen, ausschliesslich zur Anzeige.
 */
export type Zielgruppenregel = {
  segmente: string[] | null;
  bundesland_modus: string | null;
  bundeslaender: string[] | null;
};

export function useZielgruppenregel(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["eic", "campaign_regel", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .select("segmente, bundesland_modus, bundeslaender")
        .eq("id", campaignId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Zielgruppenregel | null;
    },
  });
}

export const zahlF = new Intl.NumberFormat("de-DE");

/** TT.MM.JJJJ aus einem ISO-Datum; null bleibt null. */
export function datumDe(iso: string | null): string | null {
  if (!iso) return null;
  const [j, m, t] = iso.slice(0, 10).split("-");
  return j && m && t ? `${t}.${m}.${j}` : null;
}

/** Leeres Textfeld -> null. Der CHECK auf buchungslink lehnt "" ab (23514). */
export const textOderNull = (wert: string): string | null => wert.trim() || null;
