interface LeadScoreBadgeProps {
  score: number | null | undefined;
  showLabel?: boolean;
  className?: string;
}

export function LeadScoreBadge({ score, showLabel = true, className }: LeadScoreBadgeProps) {
  if (score === null || score === undefined) return null;

  let tier: string;
  let tierClass: string;
  let emoji: string;

  if (score >= 80) {
    tier = "HOT";
    emoji = "🔥";
    tierClass = "bg-red-100 text-red-700 border-red-300";
  } else if (score >= 60) {
    tier = "WARM";
    emoji = "🌤";
    tierClass = "bg-orange-100 text-orange-700 border-orange-300";
  } else if (score >= 40) {
    tier = "MED";
    emoji = "·";
    tierClass = "bg-yellow-100 text-yellow-700 border-yellow-300";
  } else {
    tier = "COLD";
    emoji = "❄";
    tierClass = "bg-blue-100 text-blue-700 border-blue-300";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${tierClass} ${className ?? ""}`}
    >
      <span aria-hidden>{emoji}</span>
      {showLabel ? `${tier} · ` : ""}
      {score}
    </span>
  );
}
