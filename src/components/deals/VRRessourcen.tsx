import { Globe, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

// Static resource bar for the Viktoria Rebensburg pipelines (Industrie + Stiftungen).
// Unlike WerteRaumRessourcen this is link-only: no DB table, no upload/edit (kein
// Briefversand, kein Leitfaden) until VR documents exist. Mirrors the WerteRaum
// bar's visual style so the Kanban header stays consistent.
const links: { type: string; name: string; url: string; icon: typeof Globe }[] = [
  { type: "website", name: "Webseite", url: "https://www.viktoria-rebensburg.com/fit-und-aktiv/", icon: Globe },
  { type: "landingpage", name: "Landingpage", url: "https://viktoria-roadshow.com/", icon: Rocket },
];

export function VRRessourcen({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card/50 px-6 py-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-2 gap-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <a
                key={l.type}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                title={l.name}
                className="group relative flex w-[120px] items-center rounded-md border border-border bg-background px-2 py-1.5"
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{l.name}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
