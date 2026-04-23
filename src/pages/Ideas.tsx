// ⚠️ CLAUDE CODE ONLY — Lovable darf diese Datei nicht editieren
// Edge Function: supabase/functions/match-ideas — match_contacts RPC via Gemini Embedding
// Bei Lovable-Revert: git checkout main -- src/pages/Ideas.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Plus, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 15;

type ContactHit = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  company: string | null;
  notes: string | null;
  werteraum_potential: boolean;
  plsc_kampagne: boolean;
  smm_2025: boolean;
  markenfestival: boolean;
  similarity: number;
};

export default function Ideas() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ContactHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setError(null);
    if (!query.trim()) return;
    if (query.trim().length < 3) {
      setError("Bitte mindestens 3 Zeichen eingeben.");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    const { data, error: fnError } = await supabase.functions.invoke("match-ideas", {
      body: {
        query: query.trim(),
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
          maxLength={1000}
          rows={4}
          placeholder="Beschreibe deine Idee, dein Produkt oder dein Ziel..."
          className="w-full rounded-[10px] border border-border bg-canvas px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
        />
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            Tipp: Drücke <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[11px]">⌘/Ctrl + Enter</kbd>
          </p>
          <button
            onClick={handleSearch}
            disabled={loading || query.trim().length === 0}
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
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" · ");
  const note = snippet(contact.notes);
  const matchPct = Math.round(contact.similarity * 100);

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
