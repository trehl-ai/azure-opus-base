import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Loader2, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Kampagnen — Ebene 1 (je Kampagne eine Zeile) und Ebene 2 (Unterkampagnen).
 *
 * "Leads" ist je Kampagne unterschiedlich definiert; die RPC liefert die Beschriftung
 * in `leads_label` mit, damit hier nicht Aepfel mit Birnen beschriftet werden:
 *   WerteRaum = Schulen in werteraum_school_queue
 *   Viktoria  = Kontakte an Deals der Pipeline
 *
 * Die Bundeslaender kommen aus der Datenbank, NICHT aus einer Liste im Code — die
 * Vorgaengerfassung hatte NRW und Bayern hart verdrahtet und zeigte 11 der 13 Laender nicht.
 */

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

/** Eine Kennzahl. Bewusst Zahl + Wort, keine Grafik — bei einem einzelnen Wert ist die Zahl die klarere Form. */
function Kennzahl({ wert, label, ton }: { wert: number; label: string; ton?: "gut" | "gedaempft" }) {
  const farbe =
    ton === "gut" ? "text-success" : ton === "gedaempft" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="min-w-[104px]">
      <div className={`text-[22px] font-semibold leading-none tabular-nums ${farbe}`}>{nf.format(wert)}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** Duenner Magnitudenbalken, eine Farbe. Der Wert steht als Zahl daneben, nie nur als Flaeche. */
function Balken({ prozent, titel }: { prozent: number; titel: string }) {
  const p = Math.max(0, Math.min(100, prozent));
  return (
    <div className="w-full max-w-[220px]">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{titel}</span>
        <span className="text-[12px] font-semibold tabular-nums text-foreground">{p}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${titel}: ${p} Prozent`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
      </div>
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
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, u.angereichert_prozent)}%` }}
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
                {u.start_datum
                  ? new Date(u.start_datum).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "—"}
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

function KampagnenZeile({ k }: { k: Kampagne }) {
  const [offen, setOffen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4 text-left hover:bg-muted/40"
      >
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          {offen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div>
            <h3 className="text-[17px] font-semibold leading-tight">{k.name}</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {k.unterkampagnen} Unterkampagnen · {k.plausible_site}
            </p>
          </div>
        </div>

        <Kennzahl wert={k.leads} label={k.leads_label} />
        {k.geparkt > 0 && <Kennzahl wert={k.geparkt} label="davon geparkt" ton="gedaempft" />}
        <Kennzahl wert={k.kontaktiert} label="kontaktiert" />
        <Kennzahl wert={k.geantwortet} label="geantwortet" />
        <Kennzahl wert={k.gewonnen} label="Projekte gewonnen" ton="gut" />

        <Balken prozent={k.angereichert_prozent} titel="mit E-Mail" />
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

      {data?.map((k) => (
        <KampagnenZeile key={k.slug} k={k} />
      ))}

      {data && data.length > 0 && (
        <p className="text-[12px] text-muted-foreground">
          Zeile anklicken, um die Unterkampagnen zu öffnen.
        </p>
      )}
    </div>
  );
}
