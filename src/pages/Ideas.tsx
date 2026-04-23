import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Phone, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ContactHit = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  notes: string | null;
  company_name: string | null;
  score: number;
};

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

function scoreColor(score: number): { text: string; bar: string } {
  if (score >= 70) return { text: "text-success", bar: "bg-success" };
  if (score >= 50) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-muted-foreground", bar: "bg-muted-foreground" };
}

export default function Ideas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ContactHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFollowUp = async (contactId: string) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const { error: insertError } = await supabase.from("deal_activities").insert({
      contact_id: contactId,
      activity_type: "follow_up",
      title: "Follow-up aus Ideen-Matcher",
      description: query,
      status: "open",
      due_date: dueDate.toISOString(),
      owner_user_id: user?.id ?? null,
      created_by_user_id: user?.id ?? null,
    });

    if (insertError) {
      console.error("[Ideas] Follow-up failed", insertError);
      toast({ variant: "destructive", title: "Fehler beim Anlegen", description: insertError.message });
      return;
    }
    toast({ title: "Follow-up angelegt", description: "Fällig in 3 Tagen" });
  };

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
        .limit(50);

      if (cErr) throw cErr;
      const ids = (contacts ?? []).map((c) => c.id);

      if (ids.length === 0) {
        setResults([]);
        return;
      }

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

      // Score: Anteil der Keywords die in notes/job_title/first/last erscheinen
      const total = keywords.length;
      const hits: ContactHit[] = (contacts ?? []).map((c) => {
        const haystack = [
          c.notes ?? "",
          c.job_title ?? "",
          c.first_name ?? "",
          c.last_name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const matched = keywords.filter((kw) => haystack.includes(kw)).length;
        const score = Math.round((matched / total) * 100);
        return {
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          job_title: c.job_title,
          notes: c.notes,
          company_name: companyByContact.get(c.id) ?? null,
          score,
        };
      });

      hits.sort((a, b) => b.score - a.score);
      setResults(hits.slice(0, 5));
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
            <h2 className="text-[18px] font-semibold text-foreground">Top 5 Matches</h2>
            <div className="grid grid-cols-1 gap-3">
              {results.map((c) => (
                <MatchTile
                  key={c.id}
                  contact={c}
                  onFollowUp={() => handleFollowUp(c.id)}
                  onCreateDeal={() => navigate(`/deals?contact=${c.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MatchTile({
  contact,
  onFollowUp,
  onCreateDeal,
}: {
  contact: ContactHit;
  onFollowUp: () => void;
  onCreateDeal: () => void;
}) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const subtitle = contact.company_name || contact.job_title || "";
  const colors = scoreColor(contact.score);

  return (
    <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 hover:border-brand transition-colors">
      {/* Zeile 1: Name + Score */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[16px] font-bold text-foreground truncate">{fullName}</p>
        <p className={cn("text-[16px] font-bold tabular-nums shrink-0", colors.text)}>
          {contact.score}%
        </p>
      </div>

      {/* Zeile 2: Progress Bar */}
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colors.bar)}
          style={{ width: `${contact.score}%` }}
        />
      </div>

      {/* Zeile 3: Subtitle */}
      {subtitle && (
        <p className="mt-2 text-[13px] text-muted-foreground truncate">{subtitle}</p>
      )}

      {/* Zeile 4: Buttons */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onFollowUp}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-canvas px-3 py-1.5 text-[13px] font-medium text-foreground hover:border-brand hover:text-brand transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
          Follow-up
        </button>
        <button
          onClick={onCreateDeal}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand text-brand-foreground px-3 py-1.5 text-[13px] font-semibold hover:bg-brand/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Deal
        </button>
      </div>
    </div>
  );
}
