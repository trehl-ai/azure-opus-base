import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ContactHit = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  notes: string | null;
  company_name: string | null;
  flags: { werteraum: boolean; plsc: boolean; smm: boolean; markenfestival: boolean };
};

const FLAG_TAG_NAMES = {
  werteraum: "WerteRaum Potential",
  plsc: "PLSC 2025",
  smm: "SMM 2025",
  markenfestival: "Markenfestival",
} as const;

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}\-]/gu, ""))
        .filter((w) => w.length >= 4),
    ),
  ).slice(0, 5);
}

export default function Ideas() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ContactHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setError(null);
    const keywords = extractKeywords(query);
    if (keywords.length === 0) {
      setError("Bitte gib mindestens ein Stichwort mit 4+ Buchstaben ein.");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      // Build OR clause across searchable text fields
      const escapeLike = (s: string) => s.replace(/[%_,()]/g, "");
      const orParts: string[] = [];
      keywords.forEach((kw) => {
        const safe = escapeLike(kw);
        orParts.push(`notes.ilike.%${safe}%`);
        orParts.push(`job_title.ilike.%${safe}%`);
        orParts.push(`first_name.ilike.%${safe}%`);
        orParts.push(`last_name.ilike.%${safe}%`);
      });

      const { data: contacts, error: cErr } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, notes")
        .is("deleted_at", null)
        .or(orParts.join(","))
        .limit(15);

      if (cErr) throw cErr;
      const ids = (contacts ?? []).map((c) => c.id);

      if (ids.length === 0) {
        setResults([]);
        return;
      }

      // Companies via company_contacts
      const { data: ccRows } = await supabase
        .from("company_contacts")
        .select("contact_id, is_primary, companies:company_id(name)")
        .in("contact_id", ids);

      const companyByContact = new Map<string, string>();
      (ccRows ?? []).forEach((row: any) => {
        const name = row.companies?.name;
        if (!name) return;
        const existing = companyByContact.get(row.contact_id);
        if (!existing || row.is_primary) companyByContact.set(row.contact_id, name);
      });

      // Flag tags
      const { data: tags } = await supabase
        .from("tags")
        .select("id, name")
        .in("name", Object.values(FLAG_TAG_NAMES));
      const tagIdToFlag = new Map<string, keyof typeof FLAG_TAG_NAMES>();
      (tags ?? []).forEach((t) => {
        const entry = (Object.entries(FLAG_TAG_NAMES) as [keyof typeof FLAG_TAG_NAMES, string][]).find(
          ([, name]) => name === t.name,
        );
        if (entry) tagIdToFlag.set(t.id, entry[0]);
      });

      const flagsByContact = new Map<string, ContactHit["flags"]>();
      if (tagIdToFlag.size > 0) {
        const { data: et } = await supabase
          .from("entity_tags")
          .select("entity_id, tag_id")
          .eq("entity_type", "contact")
          .in("entity_id", ids)
          .in("tag_id", Array.from(tagIdToFlag.keys()));
        (et ?? []).forEach((row) => {
          const flagKey = tagIdToFlag.get(row.tag_id);
          if (!flagKey) return;
          const cur = flagsByContact.get(row.entity_id) ?? {
            werteraum: false,
            plsc: false,
            smm: false,
            markenfestival: false,
          };
          cur[flagKey] = true;
          flagsByContact.set(row.entity_id, cur);
        });
      }

      const hits: ContactHit[] = (contacts ?? []).map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        job_title: c.job_title,
        notes: c.notes,
        company_name: companyByContact.get(c.id) ?? null,
        flags:
          flagsByContact.get(c.id) ?? {
            werteraum: false,
            plsc: false,
            smm: false,
            markenfestival: false,
          },
      }));

      setResults(hits);
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
          placeholder="Gamification-Event für Führungskräfte mit interaktiven Challenges und Teambuilding-Elementen"
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
        {error && (
          <p className="mt-3 text-[13px] text-destructive">{error}</p>
        )}
      </section>

      {/* Results */}
      <section className="space-y-3">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-[12px]" />
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
            <p className="text-[12px] text-muted-foreground">
              {results.length} {results.length === 1 ? "Treffer" : "Treffer"}
            </p>
            <div className="grid grid-cols-1 gap-3">
              {results.map((c) => (
                <ResultCard key={c.id} contact={c} onOpen={() => navigate(`/contacts/${c.id}`)} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ResultCard({ contact, onOpen }: { contact: ContactHit; onOpen: () => void }) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const subline = [contact.job_title, contact.company_name].filter(Boolean).join(" · ");
  const snippet =
    contact.notes && contact.notes.length > 100
      ? contact.notes.slice(0, 100).trim() + "…"
      : contact.notes ?? "";

  return (
    <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 hover:border-brand transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-foreground truncate">{fullName}</p>
          {subline && (
            <p className="text-[13px] text-muted-foreground truncate mt-0.5">{subline}</p>
          )}
          {snippet && (
            <p className="text-[13px] text-foreground/80 mt-2 line-clamp-2">{snippet}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {contact.flags.werteraum && (
              <Badge variant="green" label="🎯 WerteRaum" />
            )}
            {contact.flags.plsc && <Badge variant="gold" label="📋 PLSC" />}
            {contact.flags.smm && <Badge variant="brand" label="🎤 SMM" />}
            {contact.flags.markenfestival && <Badge variant="brand" label="🎪 Markenfestival" />}
          </div>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-canvas px-3 py-2 text-[13px] font-medium text-foreground hover:border-brand hover:text-brand transition-colors"
        >
          Profil öffnen <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: "green" | "gold" | "brand" }) {
  const styles =
    variant === "green"
      ? "bg-brand-soft text-brand"
      : variant === "gold"
        ? "bg-gold-soft text-gold"
        : "bg-brand text-brand-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", styles)}>
      {label}
    </span>
  );
}
