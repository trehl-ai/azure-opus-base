import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { useUnzugeordneteAntworten } from "@/hooks/queries/useUnzugeordneteAntworten";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

/** "Nicht zugeordnete Antworten" auf /aktionen — nur admin. Ausgeblendet bei 0; ein Ladefehler wird gezeigt. */
export function UnzugeordneteAntwortenKarte() {
  const { data, isLoading, error } = useUnzugeordneteAntworten(true);
  const zeilen = data ?? [];
  if (!error && (isLoading || zeilen.length === 0)) return null;

  return (
    <section className="mb-8 rounded-[12px] border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3">
        <h2 className="text-[16px] font-semibold text-foreground">
          Nicht zugeordnete Antworten {!error && <span className="text-muted-foreground">({zeilen.length})</span>}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Eingänge, die der Intake keinem Kontakt zuordnen konnte. Zuordnung bisher von Hand.
        </p>
      </div>
      {error ? (
        <ListenHinweis laedt={false} fehler={error as Error} leerText="" />
      ) : (
        <div className="divide-y divide-border">
          {zeilen.map((z) => (
            <div key={z.id} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[130px_minmax(0,1.3fr)_minmax(0,2fr)] sm:gap-4">
              <span className="text-[12px] tabular-nums text-muted-foreground">{fmt(z.eingang_at)}</span>
              <span className="truncate text-[13px] text-foreground">{z.absender || "(unbekannt)"}</span>
              <span className="truncate text-[13px] text-foreground">
                {z.betreff || "(ohne Betreff)"}
                {z.typ && z.typ !== "reply" && <span className="ml-1.5 text-[12px] text-muted-foreground">· {z.typ}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
