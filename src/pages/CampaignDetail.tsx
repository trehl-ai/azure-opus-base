import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, AlertTriangle, Info } from "lucide-react";

/**
 * Kampagnen-Detail — Ebene 3.
 *
 * Zeigt Pipeline-Stages, Queue-Zustand und die Plausible-Statistiken einer einzelnen
 * Unterkampagne (Bundesland bzw. Zielgruppe).
 *
 * Plausible wird bewusst dreistufig dargestellt: ok / keine_daten / api_fehler. Ein
 * stiller Nullwert waere hier gefaehrlich — genau so blieb bis zum 31.07.2026 unbemerkt,
 * dass werteraum-schule.de gar kein Tracking-Script traegt und das Abo abgelaufen war.
 */

const SITE_JE_KAMPAGNE: Record<string, string> = {
  werteraum: "werteraum-schule.de",
  viktoria: "viktoria-roadshow.com",
};

const PLAUSIBLE_FN = "https://ttgvhqygmgtnjgwunuwz.supabase.co/functions/v1/plausible-stats";

type Detail = {
  stages: Array<{ name: string; position: number; deals: number }>;
  queue: Array<{ scrape_status: string; score_status: string; n: number }>;
  schulstufen: Array<{ schulstufe: string; n: number }>;
  kampagne: {
    bundesland: string;
    utm_campaign: string;
    tages_limit: number;
    start_datum: string;
  } | null;
};

type PlausibleAntwort = {
  status: "ok" | "keine_daten" | "api_fehler";
  hinweis: string | null;
  fehler: Array<{ abruf: string; status: number; meldung?: string }>;
  aggregate: Record<string, { value: number }>;
  timeseries: Array<{ date: string; visitors: number; pageviews: number }>;
  sources: Array<{ source: string; visitors: number }>;
  devices: Array<{ device: string; visitors: number }>;
  utm_campaigns: Array<{ utm_campaign: string; visitors: number; pageviews: number }>;
};

const nf = new Intl.NumberFormat("de-DE");

function Kennzahl({ wert, label, einheit }: { wert: number | string; label: string; einheit?: string }) {
  return (
    <div>
      <div className="text-[26px] font-semibold leading-none tabular-nums">
        {typeof wert === "number" ? nf.format(wert) : wert}
        {einheit && <span className="ml-0.5 text-[15px] font-normal text-muted-foreground">{einheit}</span>}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** Waagerechte Balken, eine Farbe. Die Zahl steht immer daneben — nie nur die Flaeche. */
function BalkenListe({
  daten,
  leer,
}: {
  daten: Array<{ label: string; wert: number }>;
  leer: string;
}) {
  const max = Math.max(1, ...daten.map((d) => d.wert));
  if (!daten.length) return <p className="text-sm text-muted-foreground">{leer}</p>;
  return (
    <div className="space-y-1.5">
      {daten.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-40 shrink-0 truncate text-[13px] text-muted-foreground" title={d.label}>
            {d.label}
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(d.wert / max) * 100}%` }} />
          </div>
          <div className="w-12 shrink-0 text-right text-[13px] font-medium tabular-nums">
            {nf.format(d.wert)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Verlauf als eine Linie. Eine Reihe braucht keine Legende — die Ueberschrift benennt sie. */
function Verlauf({ punkte }: { punkte: Array<{ date: string; visitors: number }> }) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  if (punkte.length < 2) return <p className="text-sm text-muted-foreground">Zu wenig Datenpunkte.</p>;

  const B = 640;
  const H = 140;
  const pad = { l: 8, r: 8, t: 10, b: 18 };
  const max = Math.max(1, ...punkte.map((p) => p.visitors));
  const x = (i: number) => pad.l + (i * (B - pad.l - pad.r)) / (punkte.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const d = punkte.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.visitors).toFixed(1)}`).join(" ");

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Besucherverlauf, Maximum ${max}`}
        onMouseLeave={() => setAktiv(null)}
      >
        <line x1={pad.l} y1={H - pad.b} x2={B - pad.r} y2={H - pad.b} className="stroke-border" strokeWidth={1} />
        <path d={d} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {aktiv !== null && (
          <>
            <line x1={x(aktiv)} y1={pad.t} x2={x(aktiv)} y2={H - pad.b} className="stroke-border" strokeWidth={1} />
            <circle cx={x(aktiv)} cy={y(punkte[aktiv].visitors)} r={4} className="fill-primary stroke-background" strokeWidth={2} />
          </>
        )}
        {punkte.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - (B - pad.l - pad.r) / (punkte.length - 1) / 2}
            y={0}
            width={(B - pad.l - pad.r) / (punkte.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setAktiv(i)}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{punkte[0].date}</span>
        <span>
          {aktiv !== null
            ? `${punkte[aktiv].date}: ${nf.format(punkte[aktiv].visitors)} Besucher`
            : `Maximum ${nf.format(max)}`}
        </span>
        <span>{punkte[punkte.length - 1].date}</span>
      </div>
    </div>
  );
}

function PlausibleBlock({ site, campaign }: { site: string; campaign: string | null }) {
  const [d, setD] = useState<PlausibleAntwort | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    setLaedt(true);
    setFehler(null);
    const u = new URL(PLAUSIBLE_FN);
    u.searchParams.set("site", site);
    u.searchParams.set("period", "30d");
    if (campaign) u.searchParams.set("campaign", campaign);
    fetch(u.toString())
      .then((r) => r.json())
      .then((j) => !abgebrochen && setD(j))
      .catch((e) => !abgebrochen && setFehler(String(e)))
      .finally(() => !abgebrochen && setLaedt(false));
    return () => {
      abgebrochen = true;
    };
  }, [site, campaign]);

  if (laedt)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Plausible…
      </div>
    );
  if (fehler || !d)
    return (
      <div className="flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {fehler ?? "Keine Antwort."}
      </div>
    );

  if (d.status === "api_fehler")
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Plausible antwortet nicht.</p>
          <p className="mt-0.5">{d.hinweis}</p>
        </div>
      </div>
    );

  if (d.status === "keine_daten")
    return (
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">Noch keine Messdaten.</p>
          <p className="mt-0.5 text-muted-foreground">{d.hinweis}</p>
        </div>
      </div>
    );

  const a = d.aggregate ?? {};
  const dauer = a.visit_duration?.value ?? 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Kennzahl wert={a.visitors?.value ?? 0} label="Besucher" />
        <Kennzahl wert={a.pageviews?.value ?? 0} label="Seitenaufrufe" />
        <Kennzahl wert={a.bounce_rate?.value ?? 0} label="Absprungrate" einheit="%" />
        <Kennzahl
          wert={dauer >= 60 ? `${Math.round(dauer / 60)}` : `${Math.round(dauer)}`}
          label="ø Verweildauer"
          einheit={dauer >= 60 ? "min" : "s"}
        />
      </div>

      <div>
        <h4 className="mb-2 text-[13px] font-medium">Besucher je Tag</h4>
        <Verlauf punkte={d.timeseries ?? []} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[13px] font-medium">Quellen</h4>
          <BalkenListe
            daten={(d.sources ?? []).slice(0, 8).map((s) => ({ label: s.source, wert: s.visitors }))}
            leer="Keine Quellen erfasst."
          />
        </div>
        <div>
          <h4 className="mb-2 text-[13px] font-medium">Geräte</h4>
          <BalkenListe
            daten={(d.devices ?? []).map((s) => ({ label: s.device, wert: s.visitors }))}
            leer="Keine Geräte erfasst."
          />
        </div>
      </div>

      {!campaign && (d.utm_campaigns?.length ?? 0) > 0 && (
        <div>
          <h4 className="mb-2 text-[13px] font-medium">Kampagnen im Zeitraum</h4>
          <BalkenListe
            daten={d.utm_campaigns.map((c) => ({ label: c.utm_campaign, wert: c.visitors }))}
            leer=""
          />
        </div>
      )}
    </div>
  );
}

export default function CampaignDetail() {
  const { slug = "", key = "" } = useParams();
  const schluessel = decodeURIComponent(key);
  const site = SITE_JE_KAMPAGNE[slug] ?? "werteraum-schule.de";

  const { data, isLoading, error } = useQuery({
    queryKey: ["eic", "kampagne_detail", slug, schluessel],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_kampagne_detail", {
        p_slug: slug,
        p_key: schluessel,
      });
      if (error) throw error;
      return data as Detail;
    },
  });

  const utm = data?.kampagne?.utm_campaign ?? (slug === "viktoria" ? "outreach2026" : null);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Alle Kampagnen
        </Link>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">{schluessel}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {slug === "werteraum" ? "WerteRaum" : "Viktoria Rebensburg"}
          {data?.kampagne && (
            <>
              {" · Versandstart "}
              {new Date(data.kampagne.start_datum).toLocaleDateString("de-DE")}
              {` · ${data.kampagne.tages_limit} Mails/Tag`}
            </>
          )}
          {utm && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{utm}</span>}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Detail…
        </div>
      )}
      {error && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          Fehler: {(error as Error).message}
        </Card>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-[15px] font-semibold">Pipeline</h3>
            <BalkenListe
              daten={(data.stages ?? [])
                .filter((s) => s.deals > 0)
                .map((s) => ({ label: s.name, wert: s.deals }))}
              leer="Noch keine Deals in dieser Unterkampagne."
            />
          </Card>

          {slug === "werteraum" && (
            <Card className="p-5">
              <h3 className="mb-3 text-[15px] font-semibold">Schulstufen</h3>
              <BalkenListe
                daten={(data.schulstufen ?? []).map((s) => ({ label: s.schulstufe, wert: s.n }))}
                leer="Keine Schulen in der Queue."
              />
            </Card>
          )}

          {slug === "werteraum" && (data.queue?.length ?? 0) > 0 && (
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-3 text-[15px] font-semibold">Queue-Zustand</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 pr-4 font-medium">Recherche</th>
                      <th className="py-1.5 pr-4 font-medium">Bewertung</th>
                      <th className="py-1.5 text-right font-medium">Schulen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queue.map((q, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1.5 pr-4">{q.scrape_status}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{q.score_status}</td>
                        <td className="py-1.5 text-right tabular-nums">{nf.format(q.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="p-5 lg:col-span-2">
            <h3 className="mb-1 text-[15px] font-semibold">Plausible — letzte 30 Tage</h3>
            <p className="mb-4 text-[12px] text-muted-foreground">
              {site}
              {utm ? ` · gefiltert auf ${utm}` : " · ungefiltert"}
            </p>
            <PlausibleBlock site={site} campaign={utm} />
          </Card>
        </div>
      )}
    </div>
  );
}
