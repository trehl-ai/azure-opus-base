/** Umsatz nach Leistungsjahr — reine Rechnung, ohne UI (fuer RevenueByYearCard). */

export type WonDealRow = {
  value_amount: number | string | null;
  service_start_date: string | null;
  won_at: string | null;
};

/** Die Achse reicht mindestens bis hierher, auch wenn ein Jahr 0 hat. */
export const ACHSE_MINDESTENS_BIS = 2027;

/**
 * Jahr eines gewonnenen Deals = Leistungsjahr (Jahr von service_start_date),
 * sonst Abschlussjahr (Jahr von won_at). null = keins von beiden gesetzt.
 */
export function leistungsjahr(r: WonDealRow): number | null {
  if (r.service_start_date) return Number(r.service_start_date.slice(0, 4));
  if (r.won_at) return new Date(r.won_at).getFullYear();
  return null;
}

/**
 * Summiert value_amount je Leistungsjahr. Die Achse laeuft lueckenlos vom
 * kleinsten Jahr bis max(groesstes Jahr, ACHSE_MINDESTENS_BIS); Jahre ohne Umsatz
 * stehen mit 0 da. Deals ohne beide Daten landen in `undatiert`.
 */
export function umsatzNachLeistungsjahr(rows: WonDealRow[]) {
  const proJahr = new Map<number, number>();
  let undatiert = 0;
  for (const r of rows) {
    const betrag = Number(r.value_amount) || 0;
    const jahr = leistungsjahr(r);
    if (jahr == null || Number.isNaN(jahr)) undatiert += betrag;
    else proJahr.set(jahr, (proJahr.get(jahr) ?? 0) + betrag);
  }
  const jahre = [...proJahr.keys()];
  const chart: { jahr: string; umsatz: number }[] = [];
  if (jahre.length > 0) {
    const von = Math.min(...jahre);
    const bis = Math.max(...jahre, ACHSE_MINDESTENS_BIS);
    for (let j = von; j <= bis; j++) {
      chart.push({ jahr: String(j), umsatz: Math.round(proJahr.get(j) ?? 0) });
    }
  }
  return { chart, undatiert };
}
