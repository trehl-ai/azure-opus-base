import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gemeinsame Datenschicht der Kampagnen-Ansichten.
 *
 * Herausgeloest aus Campaigns.tsx, weil das Diagramm "Versandbereitschaft je Bundesland"
 * jetzt in der WerteRaum-Detailansicht haengt und dieselben Zeilen braucht. React Query
 * teilt den Cache ueber den queryKey — die Detailseite loest keinen zweiten Roundtrip aus,
 * wenn die Uebersicht die Daten schon geholt hat.
 */

/**
 * Recharts rendert in SVG und loest keine CSS-Variablen aus dem Theme auf — die Farben stehen
 * darum als Literale hier. Damit Karte und Diagramm dieselbe Sprache sprechen, nutzen auch die
 * div-Balken der Karte dieselben Werte.
 */
export const FARBE = {
  gruen: "#1baf7a", // angereichert / mit E-Mail
  // "noch offen" liegt bewusst eine Stufe heller als #e1e0d9: gegen das Grau der wartenden
  // Zeilen waren die beiden Segmente im Balken nebeneinander nicht auseinanderzuhalten.
  hell: "#edece6",
  grau: "#d3d1c7", // wartet auf Freigabe bzw. ohne E-Mail
  linie: "#e1e0d9",
  achse: "#898781",
} as const;

/** Gaengige Kuerzel, nicht die ISO-Codes — "RLP" und "NRW" liest hier jeder, "RP" und "NW" nicht. */
export const KUERZEL: Record<string, string> = {
  "Baden-Württemberg": "BW",
  Brandenburg: "BB",
  "Mecklenburg-Vorpommern": "MV",
  Niedersachsen: "Nds.",
  "Nordrhein-Westfalen": "NRW",
  "Rheinland-Pfalz": "RLP",
  "Sachsen-Anhalt": "S.-Anhalt",
  "Schleswig-Holstein": "SH",
};

export type Kampagne = {
  slug: string;
  name: string;
  plausible_site: string;
  leads_label: string;
  leads: number;
  geparkt: number;
  mit_email: number;
  mit_website: number;
  mit_name: number;
  vollstaendig: number;
  angereichert_prozent: number;
  kontaktiert: number;
  geantwortet: number;
  gewonnen: number;
  /** Erster Gewinn der Pipeline, ersatzweise aeltester Deal. Aus get_kampagnen_uebersicht. */
  laeuft_seit: string | null;
  unterkampagnen: number;
};

export type Unterkampagne = {
  name: string;
  key: string;
  leads: number;
  geparkt: number;
  mit_email: number;
  mit_website: number;
  mit_name: number;
  angereichert_prozent: number;
  kontaktiert: number;
  geantwortet: number;
  gewonnen: number;
  utm_campaign: string | null;
  start_datum: string | null;
};

export const nf = new Intl.NumberFormat("de-DE");

export function useKampagnen() {
  return useQuery({
    queryKey: ["eic", "kampagnen_uebersicht"],
    queryFn: async () => {
      // SECURITY DEFINER RPC → Session-Client, nicht der anon-Client (sonst 401).
      const { data, error } = await (supabase as any).rpc("get_kampagnen_uebersicht");
      if (error) throw error;
      return (data ?? []) as Kampagne[];
    },
  });
}

/**
 * Ebene 2. Wird schon beim Aufbau von Ebene 1 geladen, weil der Starttermin im Badge daraus
 * stammt (`start_datum` je Unterkampagne). React Query cached das Ergebnis, das Aufklappen
 * und die Detailansicht laufen danach ohne zweiten Roundtrip.
 */
export function useUnterkampagnen(slug: string | null) {
  return useQuery({
    queryKey: ["eic", "unterkampagnen", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_kampagne_unterkampagnen", {
        p_slug: slug,
      });
      if (error) throw error;
      return (data ?? []) as Unterkampagne[];
    },
  });
}

/**
 * Die drei Bereitschaftsstufen aus `v_werteraum_readiness`. Am 07.08.2026 gegen die Live-DB
 * geprueft: genau diese drei Werte, keine NULL, keine weiteren. Der Balken darf sich darauf
 * verlassen — ein vierter Wert wuerde in der Leiste fehlen, deshalb steht die Pruefung hier.
 */
export type Bereitschaft = "keine_email" | "email_ohne_name" | "komplett";

/** Segment-Umschalter ueber der Tabelle. "alle" heisst: kein serverseitiger Filter. */
export type SegmentFilter = "grundschule" | "weiterfuehrend" | "alle";

export type ReadinessZeile = {
  bundesland: string | null;
  bereitschaft: Bereitschaft | null;
  versandstart: string | null;
};

export type ReadinessAggregat = {
  leads: number;
  keineEmail: number;
  emailOhneName: number;
  komplett: number;
  /** bereitschaft <> 'keine_email' — die Zahl, auf die es ankommt. */
  versandfaehig: number;
  /** Fruehester Versandstart der Zeilen dieses Bundeslands, null wenn keine Kampagnenzeile. */
  versandstart: string | null;
};

/**
 * PostgREST deckelt jede Antwort bei 1000 Zeilen (`max-rows`). Gemessen am 07.08.2026:
 * `schulstufe=eq.grundschule` liefert `content-range: 0-999/2154`. Ein einzelnes .select()
 * wuerde also 1154 Zeilen verschlucken und JEDE Zahl dieser Tabelle still zu klein machen.
 * Darum seitenweise bis zur kurzen Seite.
 */
const SEITE = 1000;

/**
 * Zeilen aus `v_werteraum_readiness`. Der View steht nicht in types.ts — Zugriff ueber
 * `(supabase as any)`, types.ts wird bewusst nicht regeneriert.
 *
 * Geladen wird nur, was die Tabelle aggregiert. `email`, `rektor_name` und `anrede_final`
 * bleiben absichtlich draussen: fuer eine Summenzeile braucht es keine personenbezogenen
 * Felder, und 2154 Zeilen davon gehoeren nicht ohne Grund in den Browser.
 *
 * `enabled` haelt Viktoria draussen — der View kennt nur WerteRaum-Schulen.
 */
export function useReadiness(segment: SegmentFilter, enabled: boolean) {
  return useQuery({
    queryKey: ["eic", "werteraum_readiness", segment],
    enabled,
    queryFn: async () => {
      const zeilen: ReadinessZeile[] = [];
      for (let von = 0; ; von += SEITE) {
        let q = (supabase as any)
          .from("v_werteraum_readiness")
          .select("id,bundesland,bereitschaft,versandstart")
          // Stabile Sortierung ist Pflicht: ohne sie darf PostgREST die Reihenfolge
          // zwischen zwei Seitenabrufen aendern und Zeilen doppelt oder gar nicht liefern.
          .order("id", { ascending: true })
          .range(von, von + SEITE - 1);
        if (segment !== "alle") q = q.eq("schulstufe", segment);
        const { data, error } = await q;
        if (error) throw error;
        const seite = (data ?? []) as ReadinessZeile[];
        zeilen.push(...seite);
        if (seite.length < SEITE) break;
      }
      return zeilen;
    },
  });
}

/**
 * Die sechs Zahlen der Kampagnenkachel, auf ein Segment eingeschraenkt.
 *
 * Deckungsgleich mit dem CTE `wr_queue` in `get_kampagnen_uebersicht` — dieselbe Grundmenge
 * (`werteraum_school_queue`, vom View 1:1 durchgereicht) und dieselben Bedingungen.
 */
export type KachelKennzahlen = {
  leads: number;
  mitEmail: number;
  mitWebsite: number;
  mitName: number;
  vollstaendig: number;
  geparkt: number;
};

/** Zusatzbedingung einer Zaehlung. Als Daten statt als Callback, damit kein `any` noetig wird. */
type Bedingung = { spalte: string; op: "eq" | "neq"; wert: string };

/** `spalte is not null and btrim(spalte) <> ''` — NULL faellt beim Vergleich von selbst heraus. */
const gefuellt = (spalte: string): Bedingung => ({ spalte, op: "neq", wert: "" });

/**
 * Eine Zaehlung serverseitig. `head: true` holt NUR den count-Header, keine einzige Zeile —
 * damit ist die 1000-Zeilen-Kappung von PostgREST hier ohne Bedeutung, anders als bei
 * `useReadiness`, das die Zeilen wirklich braucht und darum blaettern muss.
 */
async function zaehle(segment: SegmentFilter, bedingungen: Bedingung[] = []): Promise<number> {
  let q = (supabase as any)
    .from("v_werteraum_readiness")
    .select("id", { count: "exact", head: true });
  if (segment !== "alle") q = q.eq("schulstufe", segment);
  for (const b of bedingungen) q = b.op === "eq" ? q.eq(b.spalte, b.wert) : q.neq(b.spalte, b.wert);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Kachelzahlen je Segment.
 *
 * `neq(spalte, "")` bildet `spalte is not null and btrim(spalte) <> ''` aus der RPC ab: der
 * Vergleich gegen NULL ergibt NULL und faellt damit von selbst heraus. Am 10.08.2026 gegen die
 * Live-DB gegengerechnet — beide Schreibweisen liefern in jedem Segment dieselbe Zahl, es gibt
 * keine Felder aus reinen Leerzeichen. Faende sich spaeter eines, zaehlte die RPC es als leer
 * und diese Abfrage als gefuellt.
 *
 * `enabled` haelt Viktoria draussen (der View kennt nur WerteRaum) und spart den Roundtrip im
 * Tab "Alle", wo die Kachel bei den RPC-Zahlen bleibt.
 */
export function useReadinessKennzahlen(segment: SegmentFilter, enabled: boolean) {
  return useQuery({
    queryKey: ["eic", "werteraum_kachel", segment],
    enabled,
    // Beim Tabwechsel die Zahlen des vorigen Segments stehen lassen. Ohne das fiele die Kachel
    // fuer einen Moment auf die Gesamtzahl zurueck — ausgerechnet auf den Wert, dessen
    // Vermischung mit der Tabelle dieser Umbau beseitigt.
    placeholderData: (vorherige) => vorherige,
    queryFn: async (): Promise<KachelKennzahlen> => {
      const [leads, mitEmail, mitWebsite, mitName, vollstaendig, geparkt] = await Promise.all([
        zaehle(segment),
        zaehle(segment, [gefuellt("email")]),
        zaehle(segment, [gefuellt("website_url")]),
        zaehle(segment, [gefuellt("rektor_name")]),
        zaehle(segment, [gefuellt("email"), gefuellt("website_url"), gefuellt("rektor_name")]),
        // "wartet auf Freigabe" = scrape_status 'hold', wie im CTE wr_queue.
        zaehle(segment, [{ spalte: "scrape_status", op: "eq", wert: "hold" }]),
      ]);
      return { leads, mitEmail, mitWebsite, mitName, vollstaendig, geparkt };
    },
  });
}

/**
 * Zeilen → ein Aggregat je Bundesland.
 *
 * `versandstart` haengt im View an (bundesland, segment). Im Tab "Alle" treffen darum je
 * Bundesland mehrere Termine aufeinander; genommen wird der fruehste — das ist der naechste,
 * der ansteht. In den Segment-Tabs ist der Wert ohnehin eindeutig.
 */
export function aggregiereBereitschaft(
  zeilen: ReadinessZeile[] | undefined,
): Map<string, ReadinessAggregat> {
  const je = new Map<string, ReadinessAggregat>();
  for (const z of zeilen ?? []) {
    const bl = z.bundesland ?? "Ohne Zuordnung";
    let a = je.get(bl);
    if (!a) {
      a = { leads: 0, keineEmail: 0, emailOhneName: 0, komplett: 0, versandfaehig: 0, versandstart: null };
      je.set(bl, a);
    }
    a.leads++;
    if (z.bereitschaft === "keine_email") a.keineEmail++;
    else if (z.bereitschaft === "email_ohne_name") a.emailOhneName++;
    else if (z.bereitschaft === "komplett") a.komplett++;
    // Ein unbekannter oder fehlender Wert zaehlt NICHT als versandfaehig — im Zweifel
    // lieber eine Schule zu wenig anschreiben als eine zu viel.
    if (z.bereitschaft && z.bereitschaft !== "keine_email") a.versandfaehig++;
    if (z.versandstart && (!a.versandstart || z.versandstart < a.versandstart))
      a.versandstart = z.versandstart;
  }
  return je;
}

/** Ortszeit als ISO-Tag — Vergleich als String, damit keine UTC-Verschiebung um einen Tag danebenliegt. */
export function heuteIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-08-17" → "17.08." */
export function tagMonat(iso: string): string {
  const [, m, t] = iso.split("-");
  return `${t}.${m}.`;
}

/** "2026-08-17" → "17.08.2026" */
export function volldatum(iso: string): string {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

/** "2026-05-19" → "05/2026" */
export function monatJahr(iso: string): string {
  const [j, m] = iso.split("-");
  return `${m}/${j}`;
}

/**
 * Naechste Welle ab heute: Datum UND Name der Unterkampagne. Der Name ist der Punkt —
 * "naechste Welle 17.08." allein sagt nicht, welches Bundesland dran ist.
 */
export function naechsteWelle(
  rows: Unterkampagne[] | undefined,
): { name: string; datum: string } | null {
  if (!rows?.length) return null;
  const heute = heuteIso();
  const kuenftig = rows
    .filter((r): r is Unterkampagne & { start_datum: string } => !!r.start_datum && r.start_datum >= heute)
    .sort((a, b) => a.start_datum.localeCompare(b.start_datum));
  const n = kuenftig[0];
  return n ? { name: KUERZEL[n.name] ?? n.name, datum: n.start_datum } : null;
}
