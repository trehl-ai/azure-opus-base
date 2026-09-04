import { PieChart, Pie, Cell } from "recharts";

/**
 * Ablauffortschritt einer Linie als Ring.
 *
 * 🔑 DIE ZAHL WIRD HIER NICHT BERECHNET. `ablauf_prozent` kommt fertig aus
 * get_campaign_overview(). Bis zum 04.09.2026 rechnete diese Kachel
 * `angeschrieben / (angeschrieben + ausstehend)` selbst — das ist die REICHWEITE,
 * nicht der Ablauf, und beide Formeln sind auseinandergelaufen (Bayern zeigte 80 %
 * statt 63 %). Eine Kennzahl gehoert an genau eine Stelle. Wer hier wieder eine
 * Division einbaut, stellt den Fehler wieder her.
 *
 * ablauf_prozent ist das Mittel der Erreichungsgrade ALLER geplanten Wellen, Nenner
 * nur erreichbare Adressen. `null` heisst: keine Welle geplant — dann gibt es keinen
 * Ring, weil es nichts zu messen gibt.
 */

const GROESSE = 52;
const AUSSEN = 26;
const INNEN = 19;

export function Fortschrittsring({
  prozent,
  wellenGeplant,
  erreichbar,
}: {
  prozent: number | null;
  wellenGeplant: number;
  erreichbar: number;
}) {
  if (prozent === null) return null;

  const wellenText = wellenGeplant === 1 ? "1 Welle geplant" : `${wellenGeplant} Wellen geplant`;
  const titel =
    `Ablauf ${prozent} % — Mittel ueber ${wellenText.replace(" geplant", "")}, ` +
    `bezogen auf ${erreichbar.toLocaleString("de-DE")} erreichbare Adressen`;

  // Uhrzeigersinn ab 12 Uhr. Bei 0 % rendert recharts kein Segment — sichtbar
  // bleibt die Spur, also ein leerer Ring. Genau das ist gewollt.
  const endwinkel = 90 - (prozent / 100) * 360;

  // ⚠ margin AUSDRUECKLICH auf 0. PieChart hat eine Vorgabe von 5 px je Seite;
  // damit verschiebt sich der Mittelpunkt um 5 px nach rechts unten, waehrend der
  // Radius unveraendert bleibt — der Ring lief aus dem 64-px-SVG heraus und wurde
  // abgeschnitten. cx/cy in Prozent, damit der Mittelpunkt an der Flaeche haengt
  // und nicht an einer Zahl, die man beim naechsten Groessenwechsel vergisst.
  const ring = (
    <PieChart width={GROESSE} height={GROESSE} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
      <Pie
        data={[{ wert: 1 }]}
        dataKey="wert"
        cx="50%"
        cy="50%"
        innerRadius={INNEN}
        outerRadius={AUSSEN}
        startAngle={90}
        endAngle={-270}
        stroke="none"
        isAnimationActive={false}
      >
        <Cell fill="hsl(var(--muted))" />
      </Pie>
      <Pie
        data={[{ wert: prozent }]}
        dataKey="wert"
        cx="50%"
        cy="50%"
        innerRadius={INNEN}
        outerRadius={AUSSEN}
        startAngle={90}
        endAngle={endwinkel}
        stroke="none"
        isAnimationActive={false}
      >
        {/* --success, dasselbe Token wie in den Status-Badges. Eine Farbe fuer alle
            Staende: auch 100 % bleibt ruhig, es heisst "Wellen ausgeschoepft". */}
        <Cell fill="hsl(var(--success))" />
      </Pie>
    </PieChart>
  );

  return (
    <div className="shrink-0 text-center" title={titel}>
      {/* Feste Hoehe am Container, damit der Ring im Flex-Kontext nicht gestaucht wird. */}
      <div className="relative mx-auto" style={{ width: GROESSE, height: GROESSE }}>
        {ring}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular-nums text-foreground">
          {prozent}%
        </span>
      </div>
      <p className="mt-0.5 whitespace-nowrap text-[10px] leading-tight text-muted-foreground">
        {wellenText}
      </p>
    </div>
  );
}
