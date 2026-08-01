import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  FARBE,
  KUERZEL,
  monatJahr,
  naechsteWelle,
  nf,
  tagMonat,
  useKampagnen,
  useUnterkampagnen,
  volldatum,
  type Kampagne,
  type Unterkampagne,
} from "@/components/campaigns/kampagnenDaten";

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
 * Balken, der angereichert / noch offen / wartet auf Freigabe nebeneinander stellt.
 *
 * Bewusst KEINE Analytics-Kacheln (Visits, Bounce, Quellen): werteraum-schule.de traegt kein
 * Tracking-Script, Plausible liefert dafuer null. Leere Kacheln waeren schlechter als keine.
 */

/** Kampagnenfarbe traegt Icon-Kachel und die Zahl "gewonnen". */
const KAMPAGNEN_STIL: Record<string, { icon: LucideIcon; farbe: string; einheit: string }> = {
  werteraum: { icon: School, farbe: "#1baf7a", einheit: "Bundesländer" },
  // Viktoria-Unterkampagnen sind Zielgruppen-Pipelines (Industrie, Stiftungen), keine Laender.
  viktoria: { icon: Medal, farbe: "#c9963a", einheit: "Zielgruppen" },
};

const STIL_FALLBACK = { icon: Megaphone, farbe: "#898781", einheit: "Unterkampagnen" };


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

/**
 * Laufzeit-Badge. Zwei Angaben statt einer:
 *
 * Die Vorgaengerfassung zeigte nur "Start 17.08." und liess die Kampagne dadurch kuenftig
 * aussehen — WerteRaum laeuft aber seit der Bayern-Welle, erste Wins am 19.05.2026. Ein
 * Starttermin in der Zukunft ist die naechste WELLE, nicht der Start der Kampagne.
 *
 * Beide Werte kommen aus Daten, keiner ist verdrahtet: `laeuft_seit` aus
 * get_kampagnen_uebersicht (min(won_at), ersatzweise aeltester Deal), die Welle aus dem
 * naechsten `start_datum >= heute` in werteraum_kampagnen_plan ueber die Ebene-2-RPC.
 */
function LaufzeitBadge({
  laeuftSeit,
  welle,
  laedt,
}: {
  laeuftSeit: string | null;
  welle: { name: string; datum: string } | null;
  laedt: boolean;
}) {
  if (laedt && !laeuftSeit)
    return <div className="h-[22px] w-[150px] shrink-0 animate-pulse rounded-full bg-muted" />;
  if (!laeuftSeit && !welle)
    return (
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        Kein Termin
      </span>
    );

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {laeuftSeit && (
        <span
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums"
          title={`Erster Gewinn bzw. aeltester Deal: ${volldatum(laeuftSeit)}`}
        >
          läuft seit {monatJahr(laeuftSeit)}
        </span>
      )}
      {welle && (
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
          style={{ backgroundColor: `${FARBE.gruen}1f`, color: "#127a55" }}
          title={`Naechster Versandstart: ${welle.name} am ${volldatum(welle.datum)}`}
        >
          nächste Welle: {welle.name} {tagMonat(welle.datum)}
        </span>
      )}
    </div>
  );
}

/**
 * Dreiteiliger Magnitudenbalken. Absichtlich drei divs statt einer Chart-Komponente — bei drei
 * Werten in einer Zeile ist das die einfachere und robustere Form.
 *
 * `geparkt` und `mit_email` koennen sich ueberschneiden (Berlin: 180 Zeilen, alle wartend, alle
 * mit E-Mail). Die Breiten werden darum an der Summe der drei Segmente normiert, nicht an
 * `leads` — sonst liefe der Balken ueber. Wo es keine Ueberschneidung gibt, ist beides gleich.
 */
function Fortschritt({ leads, mitEmail, geparkt }: { leads: number; mitEmail: number; geparkt: number }) {
  const offen = Math.max(0, leads - geparkt - mitEmail);
  const summe = mitEmail + offen + geparkt;
  const teile = [
    { wert: mitEmail, farbe: FARBE.gruen, label: "mit E-Mail" },
    { wert: offen, farbe: FARBE.hell, label: "noch offen" },
    { wert: geparkt, farbe: FARBE.grau, label: "wartet auf Freigabe" },
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
  // Ganze Zeile klickbar statt einer "Details"-Spalte — gleiche Konvention wie
  // Contacts.tsx / Companies.tsx / Deals.tsx.
  const navigate = useNavigate();

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
            <th className="px-3 py-2 text-right font-medium">wartet auf Freigabe</th>
            <th className="px-3 py-2 font-medium">angereichert</th>
            <th className="px-3 py-2 text-right font-medium">kontaktiert</th>
            <th className="px-3 py-2 text-right font-medium">gewonnen</th>
            <th className="px-3 py-2 font-medium">Versandstart</th>
            <th className="px-5 py-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((u) => (
            <tr
              key={u.key}
              onClick={() => navigate(`/campaigns/${slug}/detail/${encodeURIComponent(u.key)}`)}
              className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/50"
            >
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
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
  const welle = naechsteWelle(unter);

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
          <LaufzeitBadge laeuftSeit={k.laeuft_seit} welle={welle} laedt={unterLaedt} />
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
        </>
      )}
    </div>
  );
}
