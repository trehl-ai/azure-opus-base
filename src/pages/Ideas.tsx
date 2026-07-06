// ⚠️ CLAUDE CODE ONLY — Lovable darf diese Datei nicht editieren
// Edge Function: supabase/functions/match-ideas — match_contacts RPC via Gemini Embedding
// Bei Lovable-Revert: git checkout main -- src/pages/Ideas.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Plus, Info, FileUp, FileText, Lightbulb, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import AcademyFitCard, { type AcademyResearch } from "@/components/AcademyFitCard";

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
  // Kommt bereits pro Treffer im match-ideas-Response (JSON-String), von match_contacts durchgereicht.
  academy_research: string | null;
  werteraum_potential: boolean;
  plsc_kampagne: boolean;
  smm_2025: boolean;
  markenfestival: boolean;
  similarity: number;
};

// academy_research ist ein JSON-String → defensiv parsen, bei Fehler null.
function safeParseAcademy(raw: string | null): AcademyResearch | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as AcademyResearch) : null;
  } catch {
    return null;
  }
}

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
  // Bulk academy_intel-Status pro Treffer (contact.id → status/fit_score), aus ttgv nachgeladen.
  const [intelStatus, setIntelStatus] = useState<Record<string, { status: string; fit_score: number | null }>>({});
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Multi-Concept: verfügbare Konzepte + aktuelle Auswahl (Default academy-of-stars, rückwärtskompat).
  const [concepts, setConcepts] = useState<{ slug: string; title: string }[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("academy-of-stars");

  // Concepts beim Mount laden (ttgv concepts-Tabelle; nicht in generierter types.ts → (supabase as any)).
  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("concepts")
        .select("slug,title")
        .eq("is_active", true)
        .order("title");
      if (!error && Array.isArray(data)) {
        setConcepts(data);
        // Falls academy-of-stars nicht existiert, ersten Eintrag wählen.
        if (data.length > 0 && !data.some((c: { slug: string }) => c.slug === "academy-of-stars")) {
          setSelectedSlug(data[0].slug);
        }
      }
    })();
  }, []);

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
    setIntelStatus({});

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

    // Bulk-Status für alle Treffer aus academy_intel (ttgv) holen.
    const contactIds = (data?.results ?? []).map((r: ContactHit) => r.id);
    if (contactIds.length > 0) {
      // (supabase as any).rpc: generierte types.ts kennt diese ttgv-RPC (noch) nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: statusRows, error: statusError } = await (supabase as any).rpc(
        "get_academy_intel_status_bulk",
        { p_contact_ids: contactIds, p_concept_slug: selectedSlug },
      );
      if (!statusError) {
        const map: Record<string, { status: string; fit_score: number | null }> = {};
        (statusRows ?? []).forEach((row: { contact_id: string; status: string; fit_score: number | null }) => {
          map[row.contact_id] = { status: row.status, fit_score: row.fit_score };
        });
        setIntelStatus(map);
      }
    }
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

  // Konzeptwechsel bei vorhandenen Treffern → Bulk-Status fürs neue Konzept neu laden
  // (sonst zeigen die Karten den Status des alten Konzepts). Absichtlich nur [selectedSlug]:
  // ein frischer Search setzt intelStatus bereits selbst.
  useEffect(() => {
    if (results.length === 0) return;
    (async () => {
      const ids = results.map((r) => r.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: statusRows, error } = await (supabase as any).rpc(
        "get_academy_intel_status_bulk",
        { p_contact_ids: ids, p_concept_slug: selectedSlug },
      );
      if (!error && Array.isArray(statusRows)) {
        const map: Record<string, { status: string; fit_score: number | null }> = {};
        statusRows.forEach((row: { contact_id: string; status: string; fit_score: number | null }) => {
          map[row.contact_id] = { status: row.status, fit_score: row.fit_score };
        });
        setIntelStatus(map);
      } else {
        setIntelStatus({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

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
        {/* Konzept-Auswahl (Multi-Concept) */}
        {concepts.length > 0 && (
          <div className="mb-4">
            <label className="text-[14px] font-medium text-foreground mb-2 block">Konzept</label>
            <Select value={selectedSlug} onValueChange={setSelectedSlug}>
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="Konzept wählen" />
              </SelectTrigger>
              <SelectContent>
                {concepts.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[150px] rounded-xl" />
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
            <h2 className="text-[18px] font-semibold text-foreground">{results.length} Treffer</h2>
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}
            >
              {results.map((c) => (
                <MatchCard key={c.id + "_" + selectedSlug} contact={c} conceptSlug={selectedSlug} onOpen={() => navigate(`/contacts/${c.id}`)} intelStatus={intelStatus[c.id]} />
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

// Blauer Match-Donut (58px) für die Grid-Kachel.
function MatchRing({ pct }: { pct: number }) {
  const size = 58;
  const sw = 12;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const off = c * (1 - clamped / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6F1FB" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#378ADD"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold tabular-nums" style={{ fontSize: 18, color: "#0C447C" }}>
          {pct}%
        </span>
        <span className="font-semibold" style={{ fontSize: 8, color: "#185FA5" }}>
          Match
        </span>
      </div>
    </div>
  );
}

type CardIntelState = "idle" | "loading" | "done" | "blocked" | "error";

function MatchCard({
  contact,
  conceptSlug,
  onOpen,
  intelStatus,
}: {
  contact: ContactHit;
  conceptSlug: string;
  onOpen: () => void;
  intelStatus?: { status: string; fit_score: number | null };
}) {
  // Live academy_intel-Flow (kein localStorage, reiner In-Memory-State).
  const [cardState, setCardState] = useState<CardIntelState>(
    intelStatus?.status === "entity_gate_blocked" ? "blocked" : "idle",
  );
  const [ar, setAr] = useState<AcademyResearch | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const matchPct = Math.round(contact.similarity * 100);
  const fit = ar ? Number(ar.fit_score) : NaN;
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" · ");

  async function startResearch() {
    setCardState("loading");
    setErrorMsg(null);
    try {
      if (intelStatus?.status === "generated") {
        // Bereits generiert → Cache-Kontext laden statt neu zu triggern.
        // (supabase as any).rpc: generierte types.ts kennt diese ttgv-RPC (noch) nicht.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc(
          "get_academy_intel_context",
          { p_contact_id: contact.id, p_concept_slug: conceptSlug },
        );
        if (error) throw error;
        setAr((data?.cached_intel ?? null) as AcademyResearch | null);
        setCardState("done");
        return;
      }
      const { data, error } = await supabase.functions.invoke("academy-intel-trigger", {
        body: { contact_id: contact.id, concept_slug: conceptSlug },
      });
      if (error) throw error;
      if (data?.status === "generated") {
        setAr((data.intel ?? null) as AcademyResearch | null);
        setCardState("done");
      } else if (data?.status === "entity_gate_blocked") {
        setErrorMsg(data.message ?? "Nicht verfügbar — Recherche nicht domain-verifizierbar.");
        setCardState("blocked");
      } else {
        setErrorMsg("Unerwarteter Fehler bei der Generierung.");
        setCardState("error");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Netzwerkfehler.");
      setCardState("error");
    }
  }

  // Done → volle Breite, Farb-Karte (Profil-Button lebt in AcademyFitCard). Nutzt den ar-State.
  if (cardState === "done" && ar && Number.isFinite(fit)) {
    return (
      <div style={{ gridColumn: "1 / -1" }}>
        <AcademyFitCard
          ar={ar}
          fit={fit}
          matchPct={matchPct}
          name={fullName}
          company={contact.company}
          jobTitle={contact.job_title}
          onOpen={onOpen}
        />
      </div>
    );
  }

  const idleLabel = intelStatus?.status === "generated" ? "Ansehen" : "Academy-Fit recherchieren";

  return (
    <div
      // 'loading' bekommt volle Breite, damit der Reflow schon vor der Farb-Karte passiert.
      style={cardState === "loading" ? { gridColumn: "1 / -1" } : undefined}
      className="flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 hover:border-brand transition-colors"
    >
      {/* Kopf-Row: Name/Meta links, Match-Ring rechts */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-medium text-foreground truncate">{fullName}</p>
          {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <MatchRing pct={matchPct} />
      </div>

      {/* CTA + Profil öffnen — am unteren Rand */}
      <div className="mt-auto pt-4 space-y-2">
        {/* error → Fehlermeldung klein/rot ÜBER dem Button */}
        {cardState === "error" && errorMsg && (
          <p className="text-[12px]" style={{ color: "#b91c1c" }}>{errorMsg}</p>
        )}

        {cardState === "loading" ? (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold text-white opacity-80 cursor-not-allowed"
            style={{ background: "#14532d" }}
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Recherche läuft (~15s)…
          </button>
        ) : cardState === "blocked" ? (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-muted py-2.5 text-[13px] font-semibold text-muted-foreground cursor-not-allowed"
          >
            Nicht verfügbar
          </button>
        ) : (
          <button
            type="button"
            onClick={startResearch}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#14532d" }}
          >
            <Sparkles className="h-4 w-4" /> {cardState === "error" ? "Erneut versuchen" : idleLabel}
          </button>
        )}

        {/* blocked → Grund klein/grau UNTER dem Button */}
        {cardState === "blocked" && (
          <p className="text-[12px] text-muted-foreground">
            {errorMsg ?? "Recherche nicht domain-verifizierbar."}
          </p>
        )}

        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand text-brand-foreground px-3 py-1.5 text-[13px] font-semibold hover:bg-brand/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Profil öffnen
        </button>
      </div>
    </div>
  );
}
