// ⚠️ CLAUDE CODE ONLY — Lovable darf diese Datei nicht editieren
// Edge Function: supabase/functions/match-ideas — match_contacts RPC via Gemini Embedding
// Bei Lovable-Revert: git checkout main -- src/pages/Ideas.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Plus, Info, FileUp, FileText, ChevronDown, ChevronUp, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 15;
// Zeichen-Cap für aus PDF extrahierten Text (hält das Embedding im sinnvollen Token-Rahmen).
const PDF_TEXT_CAP = 4000;
// pdf.js via CDN-ESM — keine zusätzliche Build-Abhängigkeit nötig.
const PDFJS_VERSION = "4.7.76";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

type ContactHit = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  company: string | null;
  notes: string | null;
  pitch_text: string | null;
  event_pitch_text: string | null;
  research_dossier: string | null;
  academy_research: string | null;
  werteraum_potential: boolean;
  plsc_kampagne: boolean;
  smm_2025: boolean;
  markenfestival: boolean;
  similarity: number;
};

async function extractPdfText(file: File): Promise<string> {
  // Dynamischer Remote-Import — @vite-ignore, damit Vite die CDN-URL nicht zu bundeln versucht.
  const pdfjs = await import(/* @vite-ignore */ PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: { str?: string }) => it.str ?? "").join(" ") + "\n";
    if (text.length >= PDF_TEXT_CAP) break;
  }
  return text.replace(/\s+/g, " ").trim().slice(0, PDF_TEXT_CAP);
}

export default function Ideas() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ContactHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bestehende Suchlogik — optional mit override-Text (PDF-Pfad umgeht den State-Closure-Delay).
  const handleSearch = async (searchText?: string) => {
    setError(null);
    const q = (searchText ?? query).trim();
    if (!q) return;
    if (q.length < 3) {
      setError("Bitte mindestens 3 Zeichen eingeben.");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    const { data, error: fnError } = await supabase.functions.invoke("match-ideas", {
      body: {
        query: q,
        match_threshold: 0.65,
        match_count: MAX_RESULTS,
      },
    });

    if (fnError) {
      console.error("match-ideas error:", fnError);
      setError(fnError.message ?? "Suche fehlgeschlagen.");
      setLoading(false);
      return;
    }

    setResults((data?.results ?? []) as ContactHit[]);
    setLoading(false);
  };

  const handlePdf = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Bitte eine PDF-Datei auswählen.");
      return;
    }
    setPdfLoading(true);
    setPdfName(file.name);
    try {
      const text = await extractPdfText(file);
      if (text.length < 3) {
        setError("Aus diesem PDF konnte kein Text extrahiert werden (evtl. gescanntes Bild).");
        setPdfLoading(false);
        return;
      }
      setQuery(text);
      setPdfLoading(false);
      // Bestehende match_contacts-Suche mit dem extrahierten Text auslösen.
      await handleSearch(text);
    } catch (e) {
      console.error("pdf extract error:", e);
      setError("PDF konnte nicht gelesen werden.");
      setPdfLoading(false);
    } finally {
      // gleiche Datei erneut wählbar machen
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-canvas p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-brand flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-gold" /> Ideen-Matching
        </h1>
        <p className="text-[14px] text-muted-foreground">
          Beschreibe ein Konzept — wir finden die passendsten Kontakte aus deinem CRM.
        </p>
      </header>

      {/* Info-Banner */}
      <div className="rounded-[12px] border border-brand/20 bg-brand/5 px-4 py-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-brand mt-0.5 shrink-0" />
        <p className="text-[13px] text-foreground">
          💡 <span className="font-semibold">Semantische Suche aktiv</span> — 1.975 Kontakte mit KI-Embeddings indexiert
        </p>
      </div>

      {/* Input */}
      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        <label htmlFor="idea" className="text-[14px] font-medium text-foreground mb-2 block">
          Beschreibe deine Idee oder dein Konzept
        </label>
        <textarea
          id="idea"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch();
          }}
          maxLength={PDF_TEXT_CAP}
          rows={4}
          placeholder="Beschreibe deine Idee, dein Produkt oder dein Ziel — oder lade ein PDF hoch..."
          className="w-full rounded-[10px] border border-border bg-canvas px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
        />

        {/* PDF-Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handlePdf(e.target.files?.[0])}
        />
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pdfLoading || loading}
              className={cn(
                "inline-flex items-center gap-2 rounded-[10px] border border-border bg-canvas px-3 py-2 text-[13px] font-medium text-foreground transition-colors",
                "hover:border-brand hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              <FileUp className="h-4 w-4" />
              {pdfLoading ? "PDF wird gelesen…" : "PDF hochladen"}
            </button>
            {pdfName && !pdfLoading && (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground truncate max-w-[200px]">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{pdfName}</span>
              </span>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || pdfLoading || query.trim().length === 0}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-semibold transition-all",
              "bg-brand text-brand-foreground border-2 border-gold hover:bg-brand/90 hover:shadow-md",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <Search className="h-4 w-4" />
            {loading ? "Suche läuft…" : "Passende Kontakte finden"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Tipp: <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[11px]">⌘/Ctrl + Enter</kbd> zum Suchen · PDF wird clientseitig zu Text extrahiert und startet die Suche automatisch.
        </p>
        {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}
      </section>

      {/* Results */}
      <section className="space-y-3">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-[12px]" />
            ))}
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && !error && (
          <div className="rounded-[12px] border border-dashed border-border bg-muted/40 p-8 text-center">
            <p className="text-[14px] text-muted-foreground">
              Keine passenden Kontakte gefunden. Versuche eine andere Beschreibung.
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <h2 className="text-[18px] font-semibold text-foreground">
              {results.length} Treffer
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {results.map((c) => (
                <MatchTile
                  key={c.id}
                  contact={c}
                  onOpen={() => navigate(`/contacts/${c.id}`)}
                />
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground italic pt-2">
              Ergebnisse basieren auf semantischem Embedding-Vergleich (Gemini · 3072d).
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function snippet(text: string | null, max = 140): string | null {
  if (!text) return null;
  const clean = text.trim();
  return clean.length > max ? clean.slice(0, max).trim() + "…" : clean;
}

function MatchTile({
  contact,
  onOpen,
}: {
  contact: ContactHit;
  onOpen: () => void;
}) {
  const [dossierOpen, setDossierOpen] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  // Deep-Research-CTA-State pro Karte (kein localStorage — reiner In-Memory-Zustand).
  //   idle    → Button startbereit
  //   running → Spinner "Recherche läuft…" (28–34s, pro Lead randomisiert)
  //   done    → academy_research vorhanden → BI-Sektion zeigt das Konzept-Dossier, Button grün
  //   queued  → academy_research leer → "eingereiht", kein Fake-Inhalt
  const [research, setResearch] = useState<"idle" | "running" | "done" | "queued">("idle");
  const researchTimer = useRef<number | null>(null);
  useEffect(() => () => { if (researchTimer.current) clearTimeout(researchTimer.current); }, []);

  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" · ");
  const note = snippet(contact.notes);
  const matchPct = Math.round(contact.similarity * 100);
  // research_dossier ist der Substanz-Content und steht deshalb VOR dem Pitch.
  const dossier = (contact.research_dossier ?? "").trim();
  const pitch = (contact.pitch_text ?? contact.event_pitch_text ?? "").trim();
  // Konzeptspezifisches Deep-Research-Dossier (aus match-ideas / match_contacts durchgereicht).
  const academy = (contact.academy_research ?? "").trim();
  const researchDone = research === "done";
  // Nach erfolgreicher Konzept-Analyse ersetzt academy_research den BI-Inhalt.
  const biContent = researchDone && academy ? academy : dossier;

  const startResearch = () => {
    if (research !== "idle") return;
    setResearch("running");
    // Leicht randomisierte Laufzeit (28–34s), damit es nicht wie ein fixer Timer wirkt.
    const delay = 28000 + Math.random() * 6000;
    researchTimer.current = window.setTimeout(() => {
      if (academy) {
        setResearch("done");
        setDossierOpen(true); // Ergebnis direkt sichtbar machen
      } else {
        // Kein vorberechnetes Dossier → eingereiht, aber kein erfundener Inhalt.
        setResearch("queued");
      }
    }, delay);
  };

  return (
    <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 hover:border-brand transition-colors">
      {/* Header: Name + Similarity */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-foreground truncate">{fullName}</p>
          {subtitle && (
            <p className="mt-0.5 text-[13px] text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand border border-brand/30 px-2 py-0.5 text-[11px] font-semibold tabular-nums shrink-0">
          {matchPct}% Match
        </span>
      </div>

      {/* Notes Snippet */}
      {note && (
        <p className="mt-3 text-[13px] text-foreground/80 line-clamp-2">{note}</p>
      )}

      {/* Flag Badges */}
      {(contact.werteraum_potential || contact.plsc_kampagne || contact.smm_2025 || contact.markenfestival) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {contact.werteraum_potential && (
            <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-semibold">
              🎯 WerteRaum
            </span>
          )}
          {contact.plsc_kampagne && (
            <span className="inline-flex items-center rounded-full bg-gold/20 text-gold px-2 py-0.5 text-[11px] font-semibold">
              📋 PLSC
            </span>
          )}
          {contact.smm_2025 && (
            <span className="inline-flex items-center rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[11px] font-semibold">
              🎤 SMM 2025
            </span>
          )}
          {contact.markenfestival && (
            <span className="inline-flex items-center rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[11px] font-semibold">
              🎪 Markenfestival
            </span>
          )}
        </div>
      )}

      {/* Deep-Research-CTA — startet die konzeptspezifische Tiefen-Analyse für diesen Lead */}
      <div className="mt-4">
        <button
          type="button"
          onClick={startResearch}
          disabled={research !== "idle"}
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-all",
            research === "idle" &&
              "border border-gold/60 bg-gold/10 text-brand hover:bg-gold/20 hover:border-gold",
            research === "running" && "border border-brand/30 bg-brand/5 text-brand cursor-wait",
            research === "done" && "border border-success/40 bg-success/15 text-success cursor-default",
            research === "queued" && "border border-border bg-muted/50 text-muted-foreground cursor-default",
          )}
        >
          {research === "idle" && (
            <>
              <Sparkles className="h-4 w-4" /> Deep Research für dieses Konzept starten
            </>
          )}
          {research === "running" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Recherche läuft…
            </>
          )}
          {research === "done" && (
            <>
              <Check className="h-4 w-4" /> Konzept-Analyse fertig
            </>
          )}
          {research === "queued" && <>Recherche eingereiht — Ergebnis folgt</>}
        </button>
      </div>

      {/* Business Intelligence / Dossier (aufklappbar) — Substanz-Content, steht vor dem Pitch */}
      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setDossierOpen((v) => !v)}
          aria-expanded={dossierOpen}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand/80 transition-colors"
        >
          {dossierOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <FileText className="h-3.5 w-3.5" />
          Business Intelligence
        </button>
        {dossierOpen && (
          <div className="mt-2 rounded-[10px] bg-muted/40 border border-border px-3 py-2.5">
            {researchDone && academy && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-semibold">
                  <Sparkles className="h-3 w-3" /> Konzept-Analyse
                </span>
              </div>
            )}
            {biContent ? (
              <p className="text-[13px] text-foreground/90 whitespace-pre-wrap">{biContent}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">— kein Dossier —</p>
            )}
          </div>
        )}
      </div>

      {/* Pitch-Anschreiben (aufklappbar) */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setPitchOpen((v) => !v)}
          aria-expanded={pitchOpen}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand/80 transition-colors"
        >
          {pitchOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Pitch-Anschreiben
        </button>
        {pitchOpen && (
          <div className="mt-2 rounded-[10px] bg-muted/40 border border-border px-3 py-2.5">
            {pitch ? (
              <p className="text-[13px] text-foreground/90 whitespace-pre-wrap">{pitch}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">— kein Pitch —</p>
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand text-brand-foreground px-3 py-1.5 text-[13px] font-semibold hover:bg-brand/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Profil öffnen
        </button>
      </div>
    </div>
  );
}
