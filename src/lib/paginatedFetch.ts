/**
 * PostgREST liefert per Default max. 1000 Zeilen (harte Kappung). Ansichten, die
 * potenziell mehr als 1000 Zeilen laden — z.B. das Deals-Kanban-Board über eine
 * ganze Pipeline — müssen chunk-weise über .range() nachladen, sonst fallen die
 * hinteren Zeilen still weg.
 *
 * Symptom des Bugs, den das hier behebt: Filter "Alle Owner" (= keine
 * owner_user_id-Einschränkung → volle Pipeline > 1000 Zeilen) zeigte WENIGER
 * Karten als ein Einzel-Owner-Filter (wenige hundert Zeilen, alles geladen).
 *
 * Vertrag an `buildQuery`:
 *  - MUSS bei jedem Aufruf eine FRISCHE Query liefern — Supabase-Query-Builder
 *    sind nach dem ersten Await verbraucht.
 *  - MUSS `{ count: "exact" }` im select() setzen, damit `total` die DB-Gesamtzahl
 *    trägt (Grundlage für den Vollständigkeits-Check im UI).
 *  - MUSS eine STABILE Gesamtsortierung mit eindeutigem Tiebreaker (z.B. id)
 *    definieren, sonst können sich die range()-Fenster überlappen oder Zeilen
 *    doppeln/auslassen.
 */
export const POSTGREST_PAGE_SIZE = 1000;

export async function fetchAllRows<T = unknown>(
  buildQuery: () => any,
  pageSize: number = POSTGREST_PAGE_SIZE,
): Promise<{ rows: T[]; total: number | null }> {
  const rows: T[] = [];
  let total: number | null = null;

  for (let from = 0; ; from += pageSize) {
    const { data, error, count } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (typeof count === "number") total = count;

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    // Weniger als eine volle Seite → letzte Seite erreicht.
    if (batch.length < pageSize) break;
  }

  return { rows, total };
}
