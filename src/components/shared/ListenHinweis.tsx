/**
 * Fallback fuer Listen, die drei Zustaende haben koennen.
 *
 * Vorher rendeten alle drei denselben Satz: `{daten && daten.length > 0 ? … : "leer"}`
 * behandelt `undefined` wie "null Treffer" — und `undefined` ist der Zustand sowohl
 * beim Laden als auch bei einer FEHLGESCHLAGENEN Query, weil `throw error` in der
 * queryFn `data` undefined laesst. Ein PGRST201 (mehrdeutiger Embed) sah dadurch
 * monatelang aus wie "diese Firma hat keine Deals".
 */
export function ListenHinweis({
  laedt,
  fehler,
  leerText,
}: {
  laedt: boolean;
  fehler: Error | null;
  leerText: string;
}) {
  if (laedt) {
    return <p className="py-6 text-center text-label text-muted-foreground">Wird geladen…</p>;
  }
  if (fehler) {
    return (
      <div className="py-6 text-center">
        <p className="text-label text-foreground">Die Liste konnte nicht geladen werden.</p>
        <p className="mt-1 text-[12px] text-muted-foreground break-words">{fehler.message}</p>
      </div>
    );
  }
  return <p className="py-6 text-center text-label text-muted-foreground">{leerText}</p>;
}
