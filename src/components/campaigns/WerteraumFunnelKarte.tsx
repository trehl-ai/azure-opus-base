import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useWerteraumFunnel, type FunnelStep } from "@/hooks/queries/useDashboardManagement";

/**
 * "WerteRaum: aus kalten Schulen werden Gespraeche" — bis 25.11.2026 Block 5 des
 * Dashboards, jetzt auf der Kampagnenseite (Reiter "Linien", Abschnitt "WerteRaum").
 * Darstellung unveraendert aus Dashboard.tsx uebernommen.
 */
export default function WerteraumFunnelKarte() {
  const { data: funnel } = useWerteraumFunnel();
  return <WerteraumFunnel steps={funnel} />;
}

// eo ipso Cockpit-Palette
const COCKPIT = {
  deep: "#0E1A2B", // Navy
  fire: "#FF4A1C", // Fire
  gold: "#F0C674", // Gold
} as const;

function WerteraumFunnel({ steps }: { steps: FunnelStep[] | undefined }) {
  const data = steps ?? [];
  const max = data.length ? Math.max(...data.map((s) => s.value), 1) : 1;
  // absteigende Balkenfarben: kalt (Navy) → warm (Gold) → heiß (Fire)
  const barColors = [COCKPIT.deep, "#3B5168", COCKPIT.gold, COCKPIT.fire];
  return (
    <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[16px] font-semibold text-foreground">
          WerteRaum: aus kalten Schulen werden Gespräche
        </h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Kumulativer Fortschritt der Akquise — von erfasst bis Termin
        </p>
      </div>

      {data.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((step, i) => {
            const prev = i === 0 ? null : data[i - 1].value;
            const pct =
              prev && prev > 0 ? Math.round((step.value / prev) * 100) : null;
            const width = Math.max((step.value / max) * 100, 6);
            const color = barColors[i] ?? COCKPIT.deep;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-right text-[13px] font-medium text-foreground">
                  {step.label}
                </div>
                <div className="flex-1 h-11 rounded-lg bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-lg flex items-center justify-end px-3 transition-[width] duration-500"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  >
                    <span
                      className={cn(
                        "text-[16px] font-bold tabular-nums",
                        i >= 2 ? "text-[#0E1A2B]" : "text-white",
                      )}
                    >
                      {step.value.toLocaleString("de-DE")}
                    </span>
                  </div>
                </div>
                <div className="w-16 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {pct !== null ? `${pct}%` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
