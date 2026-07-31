import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  Megaphone,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  School,
  Medal,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

/**
 * Kampagnen — Ebene 1 (je Kampagne eine Karte) und Ebene 2 (Unterkampagnen).
 *
 * "Leads" ist je Kampagne unterschiedlich definiert; die RPC liefert die Beschriftung
 * in `leads_label` mit, damit hier nicht Aepfel mit Birnen beschriftet werden:
 *   WerteRaum = Schulen in werteraum_school_queue
 *   Viktoria  = Kontakte an Deals der Pipeline
 *
 * Die Bundeslaender kommen aus der Datenbank, NICHT aus einer Liste im Code — die
 * Vorgaengerfassung hatte NRW und Bayern hart verdrahtet und zeigte 11 der 13 Laender nicht.
 *
 * Bewusst KEINE Prozentanzeige "mit E-Mail 32 %" mehr: die Zahl las sich wie ein schlechtes
 * Ergebnis, obwohl der Rest schlicht noch nicht angereichert ist. Stattdessen ein dreiteiliger
 * Balken, der angereichert / noch offen / geparkt nebeneinander stellt.
 *
 * Bewusst KEINE Analytics-Kacheln (Visits, Bounce, Quellen): werteraum-schule.de traegt kein
 * Tracking-Script, Plausible liefert dafuer null. Leere Kacheln waeren schlechter als keine.
 */

/**
 * Recharts rendert in SVG und loest keine CSS-Variablen aus dem Theme auf — die Farben stehen
 * darum als Literale hier. Damit Karte und Diagramm dieselbe Sprache sprechen, nutzen auch die
 * div-Balken der Karte dieselben Werte.
 */
const FARBE = {
  gruen: "#1baf7a", // angereichert / mit E-Mail
  // "noch offen" liegt bewusst eine Stufe heller als #e1e0d9: gegen das Grau der geparkten
  // Zeilen waren die beiden Segmente im Balken nebeneinander nicht auseinanderzuhalten.
  hell: "#edece6",
  grau: "#d3d1c7", // geparkt bzw. ohne E-Mail
  linie: "#e1e0d9",
  achse: "#898781",
} as const;

/** Kampagnenfarbe traegt Icon-Kachel und die Zahl "gewonnen". */
const KAMPAGNEN_STIL: Record<string, { icon: LucideIcon; farbe: string; einheit: string }> = {
  werteraum: { icon: School, farbe: "#1baf7a", einheit: "Bundesländer" },
  // Viktoria-Unterkampagnen sind Zielgruppen-Pipelines (Industrie, Stiftungen), keine Laender.
  viktoria: { icon: Medal, farbe: "#c9963a", einheit: "Zielgruppen" },
};

const STIL_FALLBACK = { icon: Megaphone, farbe: "#898781", einheit: "Unterkampagnen" };

/** Gaengige Kuerzel, nicht die ISO-Codes — "RLP" und "NRW" liest hier jeder, "RP" und "NW" nicht. */
const KUERZEL: Record<string, string> = {
  "Baden-Württemberg": "BW",
  Brandenburg: "BB",
  "Mecklenburg-Vorpommern": "MV",
  Niedersachsen: "Nds.",
  "Nordrhein-Westfalen": "NRW",
  "Rheinland-Pfalz": "RLP",
  "Sachsen-Anhalt": "S.-Anhalt",
  "Schleswig-Holstein": "SH",
};

type Kampagne = {
  slug: string;
  name: string;
  plausible_site: string;
  leads_label: string;
  leads: number;
  geparkt: number;
  mit_email: number;
  mit_website: number;
  mit_name: number;
  vollstaendig: number;
  angereichert_prozent: number;
  kontaktiert: number;
  geantwortet: number;
  gewonnen: number;
  unterkampagnen: number;
};

type Unterkampagne = {
  name: string;
  key: string;
  leads: number;
  geparkt: number;
  mit_email: number;
  mit_website: number;
  mit_name: number;
  angereichert_prozent: number;
  kontaktiert: number;
  geantwortet: number;
  gewonnen: number;
  utm_campaign: string | null;
  start_datum: string | null;
};

function useKampagnen() {
  return useQuery({
    queryKey: ["eic", "kampagnen_uebersicht"],
    queryFn: async () => {
      // SECURITY DEFINER RPC → Session-Client, nicht der anon-Client (sonst 401).
      const { data, error } = await (supabase as any).rpc("get_kampagnen_uebersicht");
      if (error) throw error;
      return (data ?? []) as Kampagne[];
    },
  });
}

/**
 * Ebene 2. Wird jetzt schon beim Aufbau von Ebene 1 geladen, weil der Starttermin im Badge
 * daraus stammt (`start_datum` je Unterkampagne). Die Uebersichts-RPC bleibt unveraendert, und
 * `werteraum_kampagnen_plan` muss nicht separat abgefragt werden. React Query cached das
 * Ergebnis, das Aufklappen laeuft danach ohne zweiten Roundtrip.
 */
function useUnterkampagnen(slug: string | null) {
  return useQuery({
    queryKey: ["eic", "unterkampagnen", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_kampagne_unterkampagnen", {
        p_slug: slug,
      });
      if (error) throw error;
      return (data ?? []) as Unterkampagne[];
    },
  });
}

const nf = new Intl.NumberFormat("de-DE");

/** Ortszeit als ISO-Tag — Vergleich als String, damit keine UTC-Verschiebung um einen Tag danebenliegt. */
function heuteIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Naechster Starttermin ab heute, oder null. */
function naechsterStart(rows: Unterkampagne[] | undefined): string | null {
  if (!rows?.length) return null;
  const heute = heuteIso();
  const kuenftig = rows
    .map((r) => r.start_datum)
    .filter((d): d is string => !!d && d >= heute)
    .sort();
  return kuenftig[0] ?? null;
}

/** "2026-08-17" → "17.08." */
function tagMonat(iso: string): string {
  const [, m, t] = iso.split("-");
  return `${t}.${m}.`;
}

/** "2026-08-17" → "17.08.2026" */
function volldatum(iso: string): string {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

/** Icon-Kachel in der Kampagnenfarbe, 36px. */
function IconKachel({ icon: Icon, farbe }: { icon: LucideIcon; farbe: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${farbe}1f`, color: farbe }}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </div>
  );
}

/** Naechster Versandstart. Ohne Termin bewusst neutral-grau, nicht warnend. */
function TerminBadge({ datum, laedt }: { datum: string | null; laedt: boolean }) {
  if (laedt) return <div className="h-[22px] w-[92px] shrink-0 animate-pulse rounded-full bg-muted" />;
  if (!datum)
    return (
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        Kein Termin
      </span>
    );
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
      style={{ backgroundColor: `${FARBE.gruen}1f`, color: "#127a55" }}
      title={`Naechster Versandstart: ${volldatum(datum)}`}
    >
      Start {tagMonat(datum)}
    </span>
  );
}

/**
 * Dreiteiliger Magnitudenbalken. Absichtlich drei divs statt einer Chart-Komponente — bei drei
 * Werten in einer Zeile ist das die einfachere und robustere Form.
 *
 * `geparkt` und `mit_email` koennen sich ueberschneiden (Berlin: 180 Zeilen, alle geparkt, alle
 * mit E-Mail). Die Breiten werden darum an der Summe der drei Segmente normiert, nicht an
 * `leads` — sonst liefe der Balken ueber. Wo es keine Ueberschneidung gibt, ist beides gleich.
 */
function Fortschritt({ leads, mitEmail, geparkt }: { leads: number; mitEmail: number; geparkt: number }) {
  const offen = Math.max(0, leads - geparkt - mitEmail);
  const summe = mitEmail + offen + geparkt;
  const teile = [
    { wert: mitEmail, farbe: FARBE.gruen, label: "mit E-Mail" },
    { wert: offen, farbe: FARBE.hell, label: "noch offen" },
    { wert: geparkt, farbe: FARBE.grau, label: "geparkt" },
  ];
  // Segmente ohne Wert wuerden nur ihren 2px-Abstand hinterlassen — eine Luecke ohne Bedeutung.
  const sichtbar = teile.filter((t) => t.wert > 0);

  return (
    <div className="mt-4">
      <div
        className="flex gap-[2px] overflow-hidden rounded-[3px]"
        role="img"
        aria-label={teile.map((t) => `${nf.format(t.wert)} ${t.label}`).join(", ")}
      >
        {sichtbar.map((t) => (
          <div
            key={t.label}
            className="h-1.5"
            style={{
              width: summe ? `${(t.wert / summe) * 100}%` : "0%",
              backgroundColor: t.farbe,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {teile.map((t) => (
          <span key={t.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.farbe }} />
            <strong className="font-semibold tabular-nums text-foreground">{nf.format(t.wert)}</strong>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Eine Zahl der Fusszeile. */
function Fusszahl({ wert, label, farbe }: { wert: number; label: string; farbe?: string }) {
  return (
    <div>
      <div className="text-[17px] font-semibold leading-none tabular-nums" style={farbe ? { color: farbe } : undefined}>
        {nf.format(wert)}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function UnterkampagnenTabelle({ slug }: { slug: string }) {
  const { data, isLoading, error } = useUnterkampagnen(slug);

  if (isLoading)
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Unterkampagnen…
      </div>
    );
  if (error)
    return (
      <div className="px-5 py-4 text-sm text-destructive">
        Fehler beim Laden: {(error as Error).message}
      </div>
    );
  if (!data?.length)
    return <div className="px-5 py-4 text-sm text-muted-foreground">Keine Unterkampagnen.</div>;

  return (
    <div className="overflow-x-auto border-t border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-2 font-medium">Unterkampagne</th>
            <th className="px-3 py-2 text-right font-medium">Leads</th>
            <th className="px-3 py-2 text-right font-medium">geparkt</th>
            <th className="px-3 py-2 font-medium">angereichert</th>
            <th className="px-3 py-2 text-right font-medium">kontaktiert</th>
            <th className="px-3 py-2 text-right font-medium">gewonnen</th>
            <th className="px-3 py-2 font-medium">Versandstart</th>
            <th className="px-5 py-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((u) => (
            <tr key={u.key} className="border-t border-border/60 hover:bg-muted/40">
              <td className="px-5 py-2.5 font-medium">
                {u.name}
                {u.name === "Ohne Zuordnung" && (
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    Deals ohne Bundesland
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{nf.format(u.leads)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {u.geparkt ? nf.format(u.geparkt) : "—"}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, u.angereichert_prozent)}%`,
                        backgroundColor: FARBE.gruen,
                      }}
                    />
                  </div>
                  <span className="tabular-nums text-[12px]">{u.angereichert_prozent}%</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{nf.format(u.kontaktiert)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-success">
                {u.gewonnen ? nf.format(u.gewonnen) : "—"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {u.start_datum ? volldatum(u.start_datum) : "—"}
              </td>
              <td className="px-5 py-2.5 text-right">
                <Link
                  to={`/campaigns/${slug}/detail/${encodeURIComponent(u.key)}`}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  Details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KampagnenKarte({ k }: { k: Kampagne }) {
  const [offen, setOffen] = useState(false);
  const stil = KAMPAGNEN_STIL[k.slug] ?? STIL_FALLBACK;
  // Nur fuer das Termin-Badge. Das Aufklappen unten liest denselben Cache-Eintrag.
  const { data: unter, isLoading: unterLaedt } = useUnterkampagnen(k.slug);
  const start = naechsterStart(unter);

  return (
    // Aufgeklappt zieht die Karte ueber beide Spalten — die Ebene-2-Tabelle hat acht Spalten und
    // waere in einer halben Zeilenbreite unlesbar.
    <Card className={`overflow-hidden ${offen ? "lg:col-span-2" : ""}`}>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="w-full px-5 py-5 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start gap-3">
          <IconKachel icon={stil.icon} farbe={stil.farbe} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-semibold leading-tight">{k.name}</h3>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {k.unterkampagnen} {stil.einheit} · {k.plausible_site}
            </p>
          </div>
          <TerminBadge datum={start} laedt={unterLaedt} />
          {offen ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        <div className="mt-5 flex items-baseline gap-2.5">
          <span className="text-[38px] font-medium leading-none tabular-nums">{nf.format(k.leads)}</span>
          <span className="text-[13px] text-muted-foreground">{k.leads_label}</span>
        </div>

        <Fortschritt leads={k.leads} mitEmail={k.mit_email} geparkt={k.geparkt} />

        {/* umbruchfaehig: bei schmaler Karte rutschte "gewonnen" sonst hinter den Kartenrand */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-3">
          <Fusszahl wert={k.kontaktiert} label="kontaktiert" />
          <Fusszahl wert={k.geantwortet} label="geantwortet" />
          <Fusszahl wert={k.gewonnen} label="gewonnen" farbe={stil.farbe} />
        </div>
      </button>

      {offen && (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-muted/30 px-5 py-2.5 text-[12px] text-muted-foreground">
            <span>
              E-Mail <strong className="text-foreground tabular-nums">{nf.format(k.mit_email)}</strong>
            </span>
            <span>
              Website <strong className="text-foreground tabular-nums">{nf.format(k.mit_website)}</strong>
            </span>
            <span>
              Ansprechpartner{" "}
              <strong className="text-foreground tabular-nums">{nf.format(k.mit_name)}</strong>
            </span>
            <span>
              alle drei <strong className="text-foreground tabular-nums">{nf.format(k.vollstaendig)}</strong>
            </span>
          </div>
          <UnterkampagnenTabelle slug={k.slug} />
        </>
      )}
    </Card>
  );
}

type BalkenZeile = { label: string; mit_email: number; ohne_email: number; leads: number };

/**
 * Versandbereitschaft je Bundesland — gestapelter horizontaler Balken, nach Starttermin sortiert.
 * Die Reihenfolge ist die Aussage: was zuerst rausgeht, steht oben. Laender ohne Termin ans Ende.
 */
function VersandbereitschaftChart() {
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

export default function Campaigns() {
  const { data, isLoading, error } = useKampagnen();

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <h1 className="text-[28px] font-semibold tracking-tight">Kampagnen</h1>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Kampagnen…
        </div>
      )}

      {error && (
        <Card className="flex items-start gap-2 border-destructive/40 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Fehler beim Laden: {(error as Error).message}</span>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {data?.map((k) => (
          <KampagnenKarte key={k.slug} k={k} />
        ))}
      </div>

      {data && data.length > 0 && (
        <>
          <p className="text-[12px] text-muted-foreground">
            Karte anklicken, um die Unterkampagnen zu öffnen.
          </p>
          <VersandbereitschaftChart />
        </>
      )}
    </div>
  );
}
