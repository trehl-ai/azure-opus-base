import { useState } from "react";
import { supabaseEIC } from "@/lib/supabaseEIC";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WERTERAUM_WEBSITE_URL } from "@/lib/werteraumResources";

// Storage lives in the EIC project (ttgvhqygmgtnjgwunuwz) "project-files" bucket —
// intentionally supabaseEIC, NOT the main @/integrations/supabase/client.
const STORAGE_BUCKET = "project-files";
const SIGNED_URL_TTL = 3600;

// Google Docs Viewer — embedded=true for the inline hover iframe, false for full tab.
const viewerUrl = (signedUrl: string, embedded: boolean) =>
  `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=${embedded}`;

type ResourceRow =
  | { kind: "link"; icon: string; label: string; href: string }
  | { kind: "doc"; icon: string; label: string; path: string }
  | { kind: "soon"; icon: string; label: string };

const ROWS: ResourceRow[] = [
  { kind: "link", icon: "🌐", label: "Webseite", href: WERTERAUM_WEBSITE_URL },
  { kind: "link", icon: "📄", label: "Landingpage", href: WERTERAUM_WEBSITE_URL },
  // Briefanschreiben not uploaded yet → disabled "Folgt". Once the file exists at
  // werteraum/briefanschreiben.pdf, switch this row to { kind: "doc", path: ... }.
  { kind: "soon", icon: "📋", label: "Briefanschreiben" },
  { kind: "doc", icon: "📖", label: "Gesprächsleitfaden", path: "werteraum/leitfaden/Gespraechsleitfaden_Werteraum_Calls_v3.docx" },
];

export function WerteRaumRessourcen({ className }: { className?: string }) {
  const { toast } = useToast();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  // Lazily fetches (and caches) a signed URL for a storage path.
  const getSignedUrl = async (path: string): Promise<string | null> => {
    if (signedUrls[path]) return signedUrls[path];
    const { data, error } = await supabaseEIC.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      toast({ variant: "destructive", title: "Dokument konnte nicht geladen werden" });
      return null;
    }
    setSignedUrls((prev) => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const handleOpen = async (row: ResourceRow) => {
    if (row.kind === "link") {
      window.open(row.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (row.kind !== "doc") return;
    const url = await getSignedUrl(row.path);
    if (url) window.open(viewerUrl(url, false), "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-lg space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600 text-xs font-bold text-white">
          W
        </span>
        <h3 className="text-sm font-semibold text-foreground">WerteRaum Ressourcen</h3>
      </div>

      {/* Resource rows */}
      <div className="space-y-1">
        {ROWS.map((row) => {
          // Disabled placeholder — document not in storage yet.
          if (row.kind === "soon") {
            return (
              <div
                key={row.label}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground opacity-50 cursor-not-allowed"
                aria-disabled="true"
              >
                <span className="text-base leading-none">{row.icon}</span>
                <span className="flex-1 font-medium">{row.label}</span>
                <span className="text-xs text-muted-foreground">Folgt</span>
              </div>
            );
          }

          const path = row.kind === "doc" ? row.path : null;
          const showPreview = !!path && hoveredPath === path && !!signedUrls[path];

          return (
            <div
              key={row.label}
              className="relative"
              onMouseEnter={
                path
                  ? () => {
                      setHoveredPath(path);
                      void getSignedUrl(path);
                    }
                  : undefined
              }
              onMouseLeave={path ? () => setHoveredPath(null) : undefined}
            >
              <button
                type="button"
                onClick={() => handleOpen(row)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <span className="text-base leading-none">{row.icon}</span>
                <span className="flex-1 font-medium">{row.label}</span>
              </button>

              {/* Hover preview — floats to the LEFT of the panel so it stays on-screen */}
              {showPreview && path && (
                <div
                  className="absolute right-full top-0 z-50 mr-2 overflow-hidden rounded-lg border border-border bg-white shadow-lg"
                  style={{ width: 200, height: 280 }}
                >
                  <iframe
                    title={`Vorschau ${row.label}`}
                    src={viewerUrl(signedUrls[path], true)}
                    className="h-full w-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
