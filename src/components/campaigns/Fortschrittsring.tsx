import { PieChart, Pie, Cell } from "recharts";
import { zahlF } from "./linienDaten";

/**
 * Fortschritt einer Linie als Ring.
 *
 * NENNER IST BEWUSST `angeschrieben + ausstehend` — `nicht_erreichbar` gehoert NICHT
 * hinein. Das sind Adressen, die keine Mail bekommen koennen; waeren sie im Nenner,
 * bliebe die bundesweite Kampagne bei 88 % stehen und kaeme nie an. Ein Ring, der
 * strukturell nie voll wird, liest sich wie ein Fehler.
 *
 * Ist der Nenner 0, gibt es keinen Ring: dieser Linie haengt kein Verteiler an, es ist
 * gar nichts gemessen worden. Eine 0 % waere eine Aussage ueber nichts.
 *
 * Diagrammweg: recharts, weil das Repo es bereits fuehrt (Dashboard, RevenueByYearCard,
 * VersandbereitschaftChart). Bewusst OHNE ResponsiveContainer — der Ring hat eine feste
 * Groesse, und neun ResizeObserver auf einer Uebersichtsseite sind Aufwand ohne Ertrag.
 */

const GROESSE = 64;
const AUSSEN = 32;
const INNEN = 24;

/** Anteil in Prozent, gerundet. Nur aufrufen, wenn der Nenner > 0 ist. */
function fortschrittProzent(angeschrieben: number, ausstehend: number): number {
  return Math.round((angeschrieben / (angeschrieben + ausstehend)) * 100);
}

export function Fortschrittsring({
  angeschrieben,
  ausstehend,
}: {
  angeschrieben: number;
  ausstehend: number;
}) {
  const nenner = angeschrieben + ausstehend;
  if (nenner === 0) return null;

  const prozent = fortschrittProzent(angeschrieben, ausstehend);
  const beschriftung = `${zahlF.format(angeschrieben)} von ${zahlF.format(nenner)} angeschrieben`;

  // Uhrzeigersinn ab 12 Uhr. Bei 0 % rendert recharts kein Segment — uebrig bleibt die
  // Spur, also ein leerer Ring. Genau das ist gewollt: leer zeigen, nicht ausblenden.
  const endwinkel = 90 - (prozent / 100) * 360;

  return (
    <div className="shrink-0 text-center" title={beschriftung}>
      <div className="relative" style={{ width: GROESSE, height: GROESSE }}>
        <PieChart width={GROESSE} height={GROESSE}>
          {/* Spur — der volle Kreis, immer sichtbar */}
          <Pie
            data={[{ wert: 1 }]}
            dataKey="wert"
            cx={AUSSEN}
            cy={AUSSEN}
            innerRadius={INNEN}
            outerRadius={AUSSEN}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill="hsl(var(--muted))" />
          </Pie>
          {/* Fortschritt. Eine Farbe fuer alle Staende — auch 100 % bleibt ruhig:
              es heisst "Verteiler ausgeschoepft", nicht "Ziel erreicht". */}
          <Pie
            data={[{ wert: prozent }]}
            dataKey="wert"
            cx={AUSSEN}
            cy={AUSSEN}
            innerRadius={INNEN}
            outerRadius={AUSSEN}
            startAngle={90}
            endAngle={endwinkel}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill="hsl(var(--primary))" />
          </Pie>
        </PieChart>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-foreground">
          {prozent}%
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
        {zahlF.format(angeschrieben)}/{zahlF.format(nenner)}
      </p>
    </div>
  );
}
