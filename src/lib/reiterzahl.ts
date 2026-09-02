/**
 * Beschriftungszusatz fuer eine Registerkarte mit Trefferzahl.
 *
 * Bei einem Fehler darf dort NICHT dasselbe stehen wie bei null Treffern —
 * vorher war `Deals` (Fehler) von `Deals` (0 Treffer) nicht zu unterscheiden,
 * weil 0 falsy ist und der Klammerausdruck entfiel.
 */
export function reiterZahl(anzahl: number | undefined, fehler: unknown): string {
  if (fehler) return "(!)";
  return anzahl ? `(${anzahl})` : "";
}
