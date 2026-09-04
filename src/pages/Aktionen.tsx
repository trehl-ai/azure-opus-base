import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { datumDe } from "@/components/campaigns/linienDaten";
import {
  useAktionsliste,
  LIEGE_HINWEIS,
  LIEGE_SCHWELLE,
  type Aktion,
} from "@/hooks/queries/useAktionsliste";

/**
 * "Was wartet auf mich" — offene Vorgaenge nach Liegezeit.
 *
 * Abgrenzung zu /tasks: dort stehen Aufgaben, die jemand ANGELEGT hat
 * (deal_activities + tasks, nach Faelligkeit). Ein Deal, der unbewegt in einer
 * Stufe liegt, legt keine Aufgabe an und taucht dort deshalb nie auf. Genau die
 * fehlen hier nicht mehr.
 */

/** Zurueckhaltende Abstufung. Ab 31 Tagen deutlich, aber KEINE Fehlerfarbe —
 *  ein liegengebliebener Vorgang ist ein Hinweis, kein Defekt. */
function liegeStil(tage: number): string {
  if (tage > LIEGE_SCHWELLE) return "bg-amber-100 text-amber-900";
  if (tage > LIEGE_HINWEIS) return "bg-amber-50 text-amber-700";
  return "text-foreground";
}

/** Der Antworttext kommt ROH aus dem Postfach: MIME-kodierte Betreffzeilen,
 *  HTML-Fragmente, vorangestellte "Kategorie: …". Er wird als reiner TEXT
 *  gerendert (Kind eines <pre>, nicht dangerouslySetInnerHTML) — fremde Mails
 *  als HTML zu rendern waere eine XSS-Luecke. Die RPC kappt bereits, die
 *  Kappung hier ist die zweite Sicherung, nicht die einzige. */
const ANTWORT_MAX = 400;

function Antwort({ text, datum }: { text: string; datum: string | null }) {
  const [offen, setOffen] = useState(false);
  const gekappt = text.length > ANTWORT_MAX;
  const sichtbar = gekappt ? `${text.slice(0, ANTWORT_MAX)}…` : text;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={offen}
      >
        {offen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {datum ? `Antwort vom ${datum}` : "Antwort"} {offen ? "ausblenden" : "anzeigen"}
      </button>
      {offen && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground">
          {sichtbar}
        </pre>
      )}
    </div>
  );
}

function Zeile({ a }: { a: Aktion }) {
  const navigate = useNavigate();
  const seit = datumDe(a.wartet_seit);

  return (
    <div className="py-3.5">
      <button
        type="button"
        onClick={() => navigate(`/deals/${a.deal_id}`)}
        className="flex w-full flex-col gap-2 rounded-md text-left sm:flex-row sm:items-start sm:gap-4"
      >
        {/* LINKS — Vorgang und Firma */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-foreground">
            {a.deal_title || "(ohne Titel)"}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {a.company_name || "(keine Firma)"}
          </p>
        </div>

        {/* MITTE — Verortung und Kontakt */}
        <div className="min-w-0 flex-1">
          <Badge variant="secondary" className="max-w-full truncate font-normal">
            {[a.pipeline_name, a.stage_name].filter(Boolean).join(" · ") || "ohne Stufe"}
          </Badge>
          {a.nie_bearbeitet && (
            <Badge variant="outline" className="ml-1.5 border-amber-300 bg-amber-50 font-normal text-amber-800">
              nie bearbeitet
            </Badge>
          )}
          {(a.kontakt_name || a.kontakt_email) && (
            <p className="mt-1 truncate text-[12px] text-muted-foreground">
              {[a.kontakt_name, a.kontakt_email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* RECHTS — Liegezeit und Zustaendigkeit */}
        <div className="shrink-0 sm:w-[160px] sm:text-right">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[22px] font-bold leading-tight tabular-nums ${liegeStil(
              a.liegetage,
            )}`}
          >
            {a.liegetage} Tage
          </span>
          {seit && <p className="mt-0.5 text-[12px] text-muted-foreground">seit {seit}</p>}
          <p
            className={
              a.owner_name
                ? "mt-0.5 text-[12px] text-muted-foreground"
                : "mt-0.5 text-[12px] font-semibold text-amber-800"
            }
          >
            {a.owner_name || "kein Owner"}
          </p>
        </div>
      </button>

      {a.antwort_text && <Antwort text={a.antwort_text} datum={datumDe(a.letzte_antwort)} />}
    </div>
  );
}

function Abschnitt({ titel, zeilen }: { titel: string; zeilen: Aktion[] }) {
  if (zeilen.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-[16px] font-semibold text-foreground">
        {titel} <span className="text-muted-foreground">({zeilen.length})</span>
      </h2>
      <div className="divide-y divide-border">
        {zeilen.map((a) => (
          <Zeile key={a.deal_id} a={a} />
        ))}
      </div>
    </section>
  );
}

export default function Aktionen() {
  const { data, isLoading, error } = useAktionsliste();

  // ⚠ NICHT auf die Reihenfolge der RPC verlassen: sie sortiert `nie_bearbeitet`
  // zuerst und erst danach nach Liegezeit (gemessen 04.09.2026). Ohne dieses
  // Nachsortieren stuende in "Über 30 Tage" ein 53-Tage-Vorgang vor einem mit 87.
  const alle = [...(data ?? [])].sort((a, b) => b.liegetage - a.liegetage);
  const alt = alle.filter((a) => a.liegetage > LIEGE_SCHWELLE);
  const neuer = alle.filter((a) => a.liegetage <= LIEGE_SCHWELLE);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-brand">
        Zu erledigen
      </h1>
      <p className="mt-1 text-label text-muted-foreground">
        Offene Vorgänge, nach Liegezeit. Am längsten liegen gebliebene zuerst.
      </p>

      <div className="mt-6">
        {isLoading || error || alle.length === 0 ? (
          <ListenHinweis
            laedt={isLoading}
            fehler={(error as Error) ?? null}
            leerText="Nichts liegen geblieben."
          />
        ) : (
          <>
            <Abschnitt titel="Über 30 Tage" zeilen={alt} />
            <Abschnitt titel="Neuer" zeilen={neuer} />
          </>
        )}
      </div>
    </div>
  );
}
