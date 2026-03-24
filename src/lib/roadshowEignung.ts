/**
 * Shared roadshow eignung (traffic-light) calculation — mirrors the DB trigger.
 */

export type RoadshowEignung = "gruen" | "gelb" | "rot" | "grau";

export interface RoadshowFields {
  platzbedarf_erfuellt: string;
  stromanschluss_230v: string;
  zufahrt_fahrzeuge: string;
  untergrund: string;
  baustelle_aktionszeitraum: string;
  hort_ganztag: string;
  ausweichen_turnhalle: string;
  umzaeunung_aktionsflaeche: string;
}

export function computeRoadshowEignung(f: RoadshowFields): RoadshowEignung {
  const hasTbd = [
    f.platzbedarf_erfuellt,
    f.stromanschluss_230v,
    f.zufahrt_fahrzeuge,
    f.untergrund,
    f.baustelle_aktionszeitraum,
  ].some((v) => v === "tbd");

  if (hasTbd) return "grau";

  const pflichtOk =
    f.platzbedarf_erfuellt === "ja" &&
    f.stromanschluss_230v === "ja" &&
    (f.zufahrt_fahrzeuge === "ja" || f.zufahrt_fahrzeuge === "eingeschraenkt") &&
    f.untergrund !== "rasen_problematisch" &&
    (f.baustelle_aktionszeitraum === "keine" || f.baustelle_aktionszeitraum === "kleine_baustelle");

  if (!pflichtOk) return "rot";

  const pflichtEingeschraenkt =
    f.zufahrt_fahrzeuge === "eingeschraenkt" || f.untergrund === "teils_teils";

  let bonus = 0;
  if (f.hort_ganztag === "ja" || f.hort_ganztag === "angeschlossen") bonus++;
  if (f.ausweichen_turnhalle === "ja") bonus++;
  if (f.umzaeunung_aktionsflaeche === "ja") bonus++;

  if (pflichtEingeschraenkt || bonus < 2) return "gelb";
  return "gruen";
}

export const eignungColors: Record<RoadshowEignung, { bg: string; text: string; emoji: string; label: string }> = {
  gruen: { bg: "bg-success/15", text: "text-success", emoji: "🟢", label: "Geeignet" },
  gelb: { bg: "bg-warning/15", text: "text-warning", emoji: "🟡", label: "Eingeschränkt" },
  rot: { bg: "bg-destructive/15", text: "text-destructive", emoji: "🔴", label: "Ungeeignet" },
  grau: { bg: "bg-muted", text: "text-muted-foreground", emoji: "⚪", label: "Offen" },
};
