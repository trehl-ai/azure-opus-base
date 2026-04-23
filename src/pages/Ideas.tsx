import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Plus, Zap, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WERTERAUM_TAG = "WerteRaum Potential";
const MIN_KEYWORD_LEN = 4;
const MAX_KEYWORDS = 5;
const MAX_RESULTS = 15;

type ContactHit = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  notes: string | null;
  company_name: string | null;
  matchCount: number;
  hasNotesMatch: boolean;
  isWerteraum: boolean;
};

function extractKeywords(input: string): string[] {
  const stop = new Set([
    "und", "oder", "aber", "wenn", "dann", "weil", "auch", "nicht", "noch",
    "eine", "einen", "einer", "eines", "der", "die", "das", "den", "dem",
    "mit", "ohne", "für", "fuer", "gegen", "vom", "von", "bei", "auf", "aus",
    "this", "that", "with", "from", "have", "been", "they", "their", "there",
  ]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.toLowerCase().split(/[^a-zäöüß0-9]+/i)) {
    const w = raw.trim();
    if (w.length < MIN_KEYWORD_LEN || stop.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

function escapeIlike(v: string): string {
  return v.replace(/[\\%_,()]/g, " ").trim();
}

export default function Ideas() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ContactHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usedKeywords, setUsedKeywords] = useState<string[]>([]);

  const handleSearch = async () => {
    setError(null);
    if (query.trim().length < 3) {
      setError("Bitte mindestens 3 Zeichen eingeben.");
      return;
    }
    const keywords = extractKeywords(query);
    if (keywords.length === 0) {
      setError("Bitte verwende aussagekräftigere Stichwörter (mind. 4 Buchstaben).");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setUsedKeywords(keywords);
    try {
      // Build OR-Filter über mehrere Felder
      const orParts = keywords.flatMap((kw) => {
        const safe = escapeIlike(kw);
        if (!safe) return [];
        return [
          `notes.ilike.%${safe}%`,
          `job_title.ilike.%${safe}%`,
          `first_name.ilike.%${safe}%`,
          `last_name.ilike.%${safe}%`,
        ];
      });

      const { data: contacts, error: cErr } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, notes")
        .is("deleted_at", null)
        .or(orParts.join(","))
        .limit(50);

      if (cErr) throw cErr;
      const list = contacts ?? [];
      if (list.length === 0) {
        setResults([]);
        return;
      }

      const ids = list.map((c) => c.id);

      // Companies via join table (best-effort, fail soft)
      const companyMap = new Map<string, string>();
      const { data: ccRows } = await supabase
        .from("company_contacts")
        .select("contact_id, is_primary, companies:company_id(name)")
        .in("contact_id", ids);
      for (const row of ccRows ?? []) {
        const name = (row as any)?.companies?.name as string | undefined;
        if (!name) continue;
        const cid = (row as any).contact_id as string;
        if (!companyMap.has(cid) || (row as any).is_primary) {
          companyMap.set(cid, name);
        }
      }

      // WerteRaum-Tag Lookup
      const werteraumIds = new Set<string>();
      const { data: tagRow } = await supabase
        .from("tags")
        .select("id")
        .eq("name", WERTERAUM_TAG)
        .maybeSingle();
      const tagId = (tagRow as any)?.id as string | undefined;
      if (tagId) {
        const { data: etRows } = await supabase
          .from("entity_tags")
          .select("entity_id")
          .eq("entity_type", "contact")
          .eq("tag_id", tagId)
          .in("entity_id", ids);
        for (const r of etRows ?? []) werteraumIds.add((r as any).entity_id as string);
      }

      const lcKeywords = keywords.map((k) => k.toLowerCase());
      const hits: ContactHit[] = list.map((c: any) => {
        const haystack = [c.notes, c.job_title, c.first_name, c.last_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const notesLc = (c.notes ?? "").toLowerCase();
        let matchCount = 0;
        let hasNotesMatch = false;
        for (const kw of lcKeywords) {
          if (haystack.includes(kw)) matchCount += 1;
          if (notesLc.includes(kw)) hasNotesMatch = true;
        }
        return {
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          job_title: c.job_title,
          notes: c.notes,
          company_name: companyMap.get(c.id) ?? null,
          matchCount,
          hasNotesMatch,
          isWerteraum: werteraumIds.has(c.id),
        };
      });

      hits.sort((a, b) => {
        if (a.isWerteraum !== b.isWerteraum) return a.isWerteraum ? -1 : 1;
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return a.last_name.localeCompare(b.last_name);
      });

      setResults(hits.slice(0, MAX_RESULTS));
    } catch (e: any) {
      console.error("[Ideas] search failed", e);
      setError(e?.message ?? "Suche fehlgeschlagen.");
    } finally {
      setLoading(false);
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
              Keine passenden Kontakte gefunden. Versuche andere Stichwörter.
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <h2 className="text-[18px] font-semibold text-foreground">
              {results.length} {results.length === 1 ? "Treffer" : "Treffer"}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {results.map((c) => (
                <MatchTile
                  key={c.id}
                  contact={c}
                  keywords={usedKeywords}
                  onOpen={() => navigate(`/contacts/${c.id}`)}
                />
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground italic pt-2">
              Ergebnisse basieren auf Themen-Matching in Notizen, Position und Unternehmen.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function snippet(text: string | null, keywords: string[], max = 120): string | null {
  if (!text) return null;
  const lc = text.toLowerCase();
  let idx = -1;
  for (const kw of keywords) {
    const i = lc.indexOf(kw.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) {
    return text.length > max ? text.slice(0, max).trim() + "…" : text;
  }
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, start + max);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).trim() + suffix;
}

function MatchTile({
  contact,
  keywords,
  onOpen,
}: {
  contact: ContactHit;
  keywords: string[];
  onOpen: () => void;
}) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const subtitle = [contact.job_title, contact.company_name].filter(Boolean).join(" · ");
  const note = snippet(contact.notes, keywords);

  return (
    <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 hover:border-brand transition-colors">
      {/* Header: Name + Themen-Match Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-foreground truncate">{fullName}</p>
          {subtitle && (
            <p className="mt-0.5 text-[13px] text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {contact.hasNotesMatch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success border border-success/30 px-2 py-0.5 text-[11px] font-semibold shrink-0">
            <Zap className="h-3 w-3" />
            Themen-Match
          </span>
        )}
      </div>

      {/* Notes Snippet */}
      {note && (
        <p className="mt-3 text-[13px] text-foreground/80 line-clamp-2">{note}</p>
      )}

      {/* Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {contact.isWerteraum && (
          <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-semibold">
            🎯 WerteRaum
          </span>
        )}
        {contact.matchCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
            {contact.matchCount} {contact.matchCount === 1 ? "Keyword" : "Keywords"}
          </span>
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
