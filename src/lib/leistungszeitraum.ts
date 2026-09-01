import { format } from "date-fns";

/**
 * Leistungszeitraum in Kurzform fuer Karten: ein Datum, wenn nur der Start
 * gesetzt ist oder beide gleich sind, sonst eine Spanne.
 *
 * Gibt null zurueck, wenn kein Start vorliegt — die Karte laesst das Element
 * dann KOMPLETT weg. Kein Gedankenstrich, kein Platzhalter: 4.197 der 5.079
 * aktiven Deals liegen in der WerteRaum-Pipeline und tragen dieses Feld nie.
 * Ein Platzhalter waere dort Rauschen auf jeder Karte.
 *
 * Eigene Datei statt Export aus DealCard.tsx: react-refresh/only-export-components
 * warnt, sobald eine Komponentendatei zusaetzlich Funktionen exportiert.
 */
export function leistungszeitraumKurz(start?: string | null, ende?: string | null): string | null {
  if (!start) return null;
  const von = format(new Date(start), "dd.MM.yyyy");
  if (!ende || ende === start) return von;
  return `${von} - ${format(new Date(ende), "dd.MM.yyyy")}`;
}
