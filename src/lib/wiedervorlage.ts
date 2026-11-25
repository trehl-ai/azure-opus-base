/**
 * Wiedervorlage-Datum (deals.wiedervorlage_am, Typ date).
 *
 * Gerechnet wird in KALENDERTAGEN Europe/Berlin, gespeichert als YYYY-MM-DD.
 * Die DB vergleicht mit (now() AT TIME ZONE 'Europe/Berlin')::date (get_aktionsliste),
 * deshalb hier nie toISOString() auf "jetzt": das waere der UTC-Tag und zwischen
 * 00:00 und 01:00/02:00 Berlin der Vortag.
 */
const BERLIN = "Europe/Berlin";

/** Heutiger Kalendertag in Berlin als YYYY-MM-DD. */
export function berlinHeute(jetzt: Date = new Date()): string {
  // en-CA formatiert als YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(jetzt);
}

function teile(iso: string): [number, number, number] {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number);
  return [j, m, t];
}

/** Reine Datumsarithmetik in UTC, damit keine Sommerzeitgrenze einen Tag verschluckt. */
function alsIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function plusTage(iso: string, tage: number): string {
  const [j, m, t] = teile(iso);
  return alsIso(new Date(Date.UTC(j, m - 1, t + tage)));
}

/** Kalendermonat weiter; am Monatsende auf den letzten Tag gekappt (31.01. -> 28./29.02.). */
export function plusMonate(iso: string, monate: number): string {
  const [j, m, t] = teile(iso);
  const letzterTag = new Date(Date.UTC(j, m - 1 + monate + 1, 0)).getUTCDate();
  return alsIso(new Date(Date.UTC(j, m - 1 + monate, Math.min(t, letzterTag))));
}

/** Der Kalender (react-day-picker) liefert lokale Mitternacht des angeklickten Tages:
 *  dessen lokale Datumsteile SIND der gewaehlte Kalendertag. */
export function ausKalendertag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Umkehrung fuer `selected` im Kalender. */
export function alsKalendertag(iso: string): Date {
  const [j, m, t] = teile(iso);
  return new Date(j, m - 1, t);
}

/** YYYY-MM-DD -> TT.MM.JJJJ */
export function wiedervorlageDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const [j, m, t] = iso.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}
