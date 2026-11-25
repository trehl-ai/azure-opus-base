import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { cn } from "@/lib/utils";
import { useLetzteAbsagen, type Absage } from "@/hooks/queries/useLetzteAbsagen";

/** Zugeklappt 10 Zeilen, "mehr anzeigen" bis 30. Die RPC wird einmal mit 30 abgefragt. */
const SICHTBAR_START = 10;
const SICHTBAR_MAX = 30;

/** Aussage als reiner TEXT (kein dangerouslySetInnerHTML): fremde Mails als HTML
 *  zu rendern waere eine XSS-Luecke. Zugeklappt zwei Zeilen, aufgeklappt ganz. */
function Aussage({ text }: { text: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOffen((v) => !v); }}
      aria-expanded={offen}
      className="flex w-full items-start gap-1 text-left text-[13px] text-foreground"
    >
      {offen ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span className={cn("whitespace-pre-wrap break-words", !offen && "line-clamp-2")}>{text}</span>
    </button>
  );
}

function Zeile({ a }: { a: Absage }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 gap-1.5 py-3 sm:grid-cols-[84px_minmax(0,1.2fr)_80px_minmax(0,2.4fr)_minmax(0,1.2fr)] sm:gap-4">
      <span className="text-[12px] tabular-nums text-muted-foreground">
        {format(new Date(a.antwort_am), "dd.MM.yyyy")}
      </span>
      <button
        type="button"
        onClick={() => navigate(`/deals/${a.deal_id}`)}
        className="truncate text-left text-[13px] font-medium text-foreground hover:underline"
        title={a.deal_titel ?? undefined}
      >
        {a.deal_titel || "(ohne Titel)"}
      </button>
      <span>
        <Badge variant="secondary" className="font-normal">{a.art}</Badge>
      </span>
      {a.aussage ? <Aussage text={a.aussage} /> : <span className="text-[13px] text-muted-foreground">–</span>}
      <span className="text-[12px] text-muted-foreground line-clamp-2" title={a.lost_reason ?? undefined}>
        {a.lost_reason || "–"}
      </span>
    </div>
  );
}

export default function LetzteAbsagenKarte() {
  const { data, isLoading, error } = useLetzteAbsagen(SICHTBAR_MAX);
  const [alle, setAlle] = useState(false);
  const zeilen = data ?? [];
  const sichtbar = alle ? zeilen : zeilen.slice(0, SICHTBAR_START);
  return (
    <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
      <div className="mb-3">
        <h2 className="text-[16px] font-semibold text-foreground">Letzte Absagen</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Verlorene Deals mit Antwort, neueste zuerst · Schulen und Stiftungen
        </p>
      </div>
      {isLoading || error || zeilen.length === 0 ? (
        <ListenHinweis laedt={isLoading} fehler={(error as Error) ?? null} leerText="Keine Absagen mit Antwort." />
      ) : (
        <>
          <div className="hidden sm:grid sm:grid-cols-[84px_minmax(0,1.2fr)_80px_minmax(0,2.4fr)_minmax(0,1.2fr)] sm:gap-4 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Datum</span><span>Organisation</span><span>Art</span><span>Aussage</span><span>Grund</span>
          </div>
          <div className="divide-y divide-border">
            {sichtbar.map((a) => <Zeile key={a.deal_id} a={a} />)}
          </div>
          {zeilen.length > SICHTBAR_START && (
            <button
              type="button"
              onClick={() => setAlle((v) => !v)}
              className="mt-3 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              {alle ? "weniger anzeigen" : `mehr anzeigen (${zeilen.length - SICHTBAR_START})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
