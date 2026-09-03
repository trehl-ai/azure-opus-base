import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import {
  PHASEN,
  datumDe,
  operativerPfad,
  useLinien,
  zahlF,
  type Linie,
} from "./linienDaten";

const PHASE_LABEL: Record<string, string> = {
  live: "Live",
  vorbereitung: "In Vorbereitung",
  backlog: "Backlog",
};

/** Eine der drei Kernzahlen. Gross und nebeneinander, damit die Kachel auf einen Blick spricht. */
function Kernzahl({ wert, label }: { wert: number; label: string }) {
  return (
    <div>
      <p className="text-[22px] font-semibold leading-tight text-foreground">{zahlF.format(wert)}</p>
      <p className="text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Kachel({ linie }: { linie: Linie }) {
  const operativ = operativerPfad(linie);
  const letzte = datumDe(linie.letzte_mail);
  // zielgruppe 0 heisst: dieser Linie haengt keine Pipeline an (Welt des Geldes,
  // Hospitality). Drei Nullen nebeneinander laesen sich wie ein Messwert — es ist
  // aber gar nichts gemessen worden.
  const ohneVerteiler = linie.zielgruppe === 0;

  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <Link to={`/campaigns/k/${linie.campaign_id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-body font-semibold text-foreground">{linie.name}</h3>
          <Badge variant="secondary" className="shrink-0">
            {PHASE_LABEL[linie.phase] ?? linie.phase}
          </Badge>
        </div>

        {linie.zielgruppe_text && (
          <p className="mt-1 text-[13px] text-muted-foreground">{linie.zielgruppe_text}</p>
        )}
        {linie.verantwortlich && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{linie.verantwortlich}</p>
        )}

        {ohneVerteiler ? (
          <p className="mt-4 text-[13px] text-muted-foreground">Noch kein Verteiler</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kernzahl wert={linie.angeschrieben} label="angeschrieben" />
            <Kernzahl wert={linie.ausstehend} label="ausstehend" />
            <Kernzahl wert={linie.auftraege} label="Aufträge" />
          </div>
        )}

        {linie.mailings_ohne_freigabe > 0 && (
          // Hinweisfarbe, nicht destructive: fehlende Freigabe ist ein offener Punkt,
          // kein Fehler.
          <p className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {linie.mailings_ohne_freigabe === 1
              ? "1 Mailing ohne Freigabe"
              : `${linie.mailings_ohne_freigabe} Mailings ohne Freigabe`}
          </p>
        )}

        {(linie.ziel_2026 || letzte) && (
          <div className="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
            {linie.ziel_2026 && <p>{linie.ziel_2026}</p>}
            {letzte && <p>Letzte Mail: {letzte}</p>}
          </div>
        )}
      </Link>

      {operativ && (
        // Eigener Link ausserhalb des Kachel-Links: ein <a> im <a> ist ungueltiges
        // HTML und der Browser entscheidet selbst, welches Ziel gewinnt.
        <Link
          to={operativ}
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
        >
          Versandsteuerung <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function LinienUebersicht() {
  const { data, isLoading, error } = useLinien();

  if (isLoading || error || !data || data.length === 0) {
    return (
      <ListenHinweis
        laedt={isLoading}
        fehler={(error as Error) ?? null}
        leerText="Keine Kampagnenlinien angelegt."
      />
    );
  }

  return (
    <div className="space-y-8">
      {PHASEN.map(({ wert, titel }) => {
        const linien = data.filter((l) => l.phase === wert);
        if (linien.length === 0) return null;
        return (
          <section key={wert}>
            <h2 className="mb-3 text-body font-semibold text-foreground">
              {titel} <span className="text-muted-foreground">({linien.length})</span>
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {linien.map((l) => (
                <Kachel key={l.campaign_id} linie={l} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
