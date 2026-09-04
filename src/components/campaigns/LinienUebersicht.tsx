import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { Fortschrittsring } from "./Fortschrittsring";
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

/**
 * Die Phase ist die wichtigste Information der Kachel und muss ohne Lesen erkennbar
 * sein. Drei vorhandene Badge-Varianten, keine neue Farbe:
 *   live          `default`   — gefuellt in der Markenfarbe (--primary), das staerkste
 *   vorbereitung  `outline`   — Kontur, aber 2 px in --primary statt 1 px neutral;
 *                               damit gehoert sie sichtbar zur selben Familie wie live
 *   backlog       `secondary` — stumme graue Flaeche ohne Kontur
 *
 * Die Rangfolge traegt die FLAECHE, nicht die Textfarbe: gefuellt > Kontur > flach.
 * Deshalb steht auf backlog kein `text-muted-foreground` mehr — auf --secondary ergab
 * das rund 2,9:1 Kontrast und war schlecht lesbar, und "ruhig" leistet die neutrale
 * Flaeche ohne Rand bereits.
 *
 * GROESSE: gemeinsame Basis `px-3 py-1 text-sm` — eine Stufe ueber der Badge-Vorgabe
 * (`px-2.5 py-0.5 text-xs`). twMerge loest die Kollision zugunsten dieser Klassen auf.
 */
const BADGE_BASIS = "px-3 py-1 text-sm";
const PHASE_BADGE: Record<string, { variante: "default" | "outline" | "secondary"; klasse?: string }> = {
  live: { variante: "default" },
  vorbereitung: { variante: "outline", klasse: "border-2 border-primary/40" },
  backlog: { variante: "secondary", klasse: "font-medium" },
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
  const badge = PHASE_BADGE[linie.phase] ?? { variante: "secondary" as const };
  // Laufende Linien bekommen zusaetzlich einen kraeftigeren Rahmen. Bewusst kein
  // farbiger Hintergrund: bei neun Kacheln nebeneinander wird das unruhig.
  // Alle Kacheln tragen `border-2`, damit der Unterschied nur in der Farbe liegt und
  // die Kacheln nicht um einen Pixel gegeneinander springen.
  const rahmen = linie.phase === "live" ? "border-primary/40" : "border-border";

  return (
    <div className={`relative rounded-2xl border-2 ${rahmen} bg-card p-5 transition-colors hover:border-primary/60`}>
      <Link to={`/campaigns/k/${linie.campaign_id}`} className="block">
        {/* Der Kopfblock umfasst LINKS Name, Zielgruppe und Verantwortlichen, RECHTS
            Abzeichen und Ring. Die Metazeilen standen bis 04.09.2026 unter der
            Kopfzeile; damit trug allein der einzeilige Name die Hoehe des Rings, und
            jede Vergroesserung des Rings machte die Kachel hoeher. Jetzt tragen die
            Zeilen die Ringhoehe mit — der Ring waechst von 52 auf 70 px, und die
            Kachel wird dabei nicht hoeher, sondern kuerzer. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-body font-semibold text-foreground">{linie.name}</h3>
            {linie.zielgruppe_text && (
              <p className="mt-1 text-[13px] text-muted-foreground">{linie.zielgruppe_text}</p>
            )}
            {linie.verantwortlich && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{linie.verantwortlich}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant={badge.variante} className={cn(BADGE_BASIS, badge.klasse)}>
              {PHASE_LABEL[linie.phase] ?? linie.phase}
            </Badge>
            <Fortschrittsring
              prozent={linie.ablauf_prozent}
              wellenGeplant={linie.wellen_geplant}
              erreichbar={linie.erreichbar}
            />
          </div>
        </div>

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
