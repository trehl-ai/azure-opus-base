/**
 * Leeres Eingabefeld -> null, nicht 0.
 *
 * null und 0 sind verschiedene Aussagen: "kein Betrag erfasst" gegen "Betrag ist
 * null Euro". Das bisherige Muster `form.x ? parseFloat(form.x) : 0` konnte das
 * nicht unterscheiden, weil es die Wahrheit des STRINGS prueft — der leere String
 * ist falsy und landete als 0 in der Datenbank, auch wenn der Nutzer das Feld nie
 * angefasst hatte. In einer Umsatzsumme faellt eine 0 nicht auf, ein NULL schon.
 *
 * Eine ausdruecklich getippte "0" bleibt erhalten: der String "0" ist zwar truthy,
 * aber hier wird ohnehin nicht auf Wahrheit geprueft, sondern auf Leere.
 *
 * Eigene Datei statt Export aus einer Komponente: react-refresh/only-export-components
 * warnt, sobald eine Komponentendatei zusaetzlich Funktionen exportiert.
 */
function ausEingabe(eingabe: string, parse: (s: string) => number): number | null {
  const s = eingabe.trim();
  if (s === "") return null;
  const n = parse(s);
  return Number.isFinite(n) ? n : null;
}

/** Dezimalzahl aus einem Eingabefeld; leer oder unlesbar -> null. */
export const dezimalOderNull = (eingabe: string): number | null => ausEingabe(eingabe, parseFloat);

/** Ganzzahl aus einem Eingabefeld; leer oder unlesbar -> null. */
export const ganzzahlOderNull = (eingabe: string): number | null => ausEingabe(eingabe, (s) => parseInt(s, 10));
