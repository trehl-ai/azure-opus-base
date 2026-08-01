import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FARBE, KUERZEL, nf, tagMonat, useUnterkampagnen } from "./kampagnenDaten";

type BalkenZeile = { label: string; mit_email: number; ohne_email: number; leads: number };

/**
 * Versandbereitschaft je Bundesland — gestapelter horizontaler Balken, nach Starttermin sortiert.
 * Die Reihenfolge ist die Aussage: was zuerst rausgeht, steht oben. Laender ohne Termin ans Ende.
 *
 * Sitzt bewusst in der WerteRaum-Detailansicht und NICHT mehr auf der Kampagnen-Uebersicht:
 * Bundeslaender sind eine reine WerteRaum-Innensicht. Auf Top-Level stand das Diagramm neben
 * der Viktoria-Karte, fuer die es keine Entsprechung gibt.
 */
export function VersandbereitschaftChart() {
  const { data, isLoading, error } = useUnterkampagnen("werteraum");

  // Zeilen ohne Leads haetten einen Balken der Laenge null — "Ohne Zuordnung" (0 Leads, nur Deals)
  // ist genau so ein Fall und faellt hier raus.
  const zeilen: BalkenZeile[] = (data ?? [])
    .filter((u) => u.leads > 0)
    .slice()
    .sort((a, b) => {
      if (a.start_datum && b.start_datum) return a.start_datum.localeCompare(b.start_datum);
      if (a.start_datum) return -1;
      if (b.start_datum) return 1;
      return b.leads - a.leads; // ohne Termin: das groesste Land zuerst
    })
    .map((u) => ({
      label: `${KUERZEL[u.name] ?? u.name} · ${u.start_datum ? tagMonat(u.start_datum) : "offen"}`,
      mit_email: u.mit_email,
      ohne_email: Math.max(0, u.leads - u.mit_email),
      leads: u.leads,
    }));

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold">Versandbereitschaft je Bundesland</h2>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FARBE.gruen }} />
            mit E-Mail
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FARBE.grau }} />
            ohne E-Mail
          </span>
        </div>
      </div>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Sortiert nach Versandstart. Ohne E-Mail-Adresse ist eine Schule nicht anschreibbar.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Bundesländer…
        </div>
      )}
      {error && (
        <div className="py-4 text-sm text-destructive">Fehler beim Laden: {(error as Error).message}</div>
      )}
      {!isLoading && !error && !zeilen.length && (
        <div className="py-4 text-sm text-muted-foreground">Keine Bundesländer mit Leads.</div>
      )}

      {!!zeilen.length && (
        <ResponsiveContainer width="100%" height={zeilen.length * 30 + 28}>
          <BarChart
            layout="vertical"
            data={zeilen}
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: FARBE.linie }}
              tick={{ fontSize: 11, fill: FARBE.achse }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={128}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: FARBE.achse }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              formatter={(wert: number, name: string) => [
                nf.format(wert),
                name === "mit_email" ? "mit E-Mail" : "ohne E-Mail",
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: FARBE.linie }}
            />
            {/* Ohne isAnimationActive={false} zeichnet Recharts die Balken bei jeder
                Breitenaenderung neu von null auf — beim Aufklappen einer Karte war das
                Diagramm dadurch fuer die Dauer der Animation leer. */}
            <Bar dataKey="mit_email" stackId="a" fill={FARBE.gruen} barSize={20} isAnimationActive={false} />
            <Bar dataKey="ohne_email" stackId="a" fill={FARBE.grau} barSize={20} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
