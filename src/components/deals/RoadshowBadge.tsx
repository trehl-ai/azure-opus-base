import { type RoadshowEignung, eignungColors } from "@/lib/roadshowEignung";
import { cn } from "@/lib/utils";

interface Props {
  eignung: RoadshowEignung | null | undefined;
  size?: "sm" | "md";
}

export function RoadshowBadge({ eignung, size = "sm" }: Props) {
  if (!eignung) return null;
  const info = eignungColors[eignung] ?? eignungColors.grau;

  if (size === "sm") {
    return <span title={`Roadshow: ${info.label}`} className="text-[10px] leading-none">{info.emoji}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium", info.bg, info.text)}>
      {info.emoji} {info.label}
    </span>
  );
}
