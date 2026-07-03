// Lead-Score-Tier-Helper — geteilt zwischen Dashboard (Top 10 Leads) und
// Sponsoring-Leads-View. Aus Dashboard.tsx extrahiert, um Duplikat zu vermeiden.
export type LeadScoreTier = "hot" | "warm" | "medium" | "cold";

export function getLeadScoreTier(score: number | null | undefined): LeadScoreTier {
  if (score == null) return "cold";
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "medium";
  return "cold";
}

export const LEAD_TIER_STYLES: Record<
  LeadScoreTier,
  { label: string; bg: string; text: string }
> = {
  hot: { label: "HOT", bg: "bg-[#ef4444]", text: "text-white" },
  warm: { label: "WARM", bg: "bg-[#f97316]", text: "text-white" },
  medium: { label: "MEDIUM", bg: "bg-[#eab308]", text: "text-black" },
  cold: { label: "COLD", bg: "bg-[#94a3b8]", text: "text-white" },
};
