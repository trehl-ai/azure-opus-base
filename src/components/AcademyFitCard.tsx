// Farb-Karte für das Deep-Research-Ergebnis eines /ideen-Treffers.
// Konsumiert das geparste academy_research-Objekt (siehe safeParseAcademy in Ideas.tsx).
import type { ComponentType } from "react";
import { TrendingUp, User, Building2, Megaphone, Target, MessageSquare, Check, Plus } from "lucide-react";

export type AcademyResearch = {
  fit_score?: number;
  fit_label?: string;
  why_match?: string;
  person?: string;
  company?: string;
  public?: string;
  angle?: string;
  hook?: string;
};

function FitRing({ fit, ring, track, num }: { fit: number; ring: string; track: string; num: string }) {
  const size = 96;
  const sw = 14;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, fit));
  const off = c * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ring}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold tabular-nums" style={{ fontSize: 26, color: num }}>
          {fit}%
        </span>
        <span className="mt-0.5 font-medium" style={{ fontSize: 9, color: num }}>
          nach Deep Research
        </span>
      </div>
    </div>
  );
}

type Block = {
  key: keyof AcademyResearch;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  color: string;
  italic?: boolean;
  bold?: boolean;
};

const BLOCKS: Block[] = [
  { key: "person", label: "Person", Icon: User, bg: "#E6F1FB", border: "#185FA5", color: "#0C447C" },
  { key: "company", label: "Unternehmen", Icon: Building2, bg: "#EEEDFE", border: "#534AB7", color: "#26215C" },
  { key: "public", label: "Öffentliche Signale", Icon: Megaphone, bg: "#E1F5EE", border: "#0F6E56", color: "#04342C" },
  { key: "angle", label: "Sponsoring-Winkel", Icon: Target, bg: "#FAEEDA", border: "#854F0B", color: "#412402" },
  { key: "hook", label: "Gesprächsaufhänger", Icon: MessageSquare, bg: "#EAF3DE", border: "#3B6D11", color: "#173404", italic: true, bold: true },
];

export default function AcademyFitCard({
  ar,
  fit,
  matchPct,
  name,
  company,
  jobTitle,
  onOpen,
}: {
  ar: AcademyResearch;
  fit: number;
  matchPct: number;
  name: string;
  company: string | null;
  jobTitle: string | null;
  onOpen: () => void;
}) {
  // Farb-Band nach Fit-Score.
  const strong = fit >= 80;
  const ring = strong ? "#639922" : "#EF9F27";
  const track = strong ? "#EAF3DE" : "#FAEEDA";
  const num = strong ? "#27500A" : "#854F0B";
  const sub = [company, jobTitle].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Kopf: Fit-Ring + Name/Delta/Meta */}
      <div className="flex items-center gap-4 p-4 md:p-5">
        <FitRing fit={fit} ring={ring} track={track} num={num} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[17px] font-semibold text-foreground">{name}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={{ color: "#27500A", background: "#EAF3DE" }}
            >
              <TrendingUp className="h-3 w-3" /> {matchPct}% → {fit}%
            </span>
          </div>
          {sub && <p className="truncate text-[12.5px] text-muted-foreground">{sub}</p>}
          <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: "#0F6E56", background: "#E1F5EE" }}
          >
            <Check className="h-3 w-3" /> Konzept-Analyse fertig
          </span>
        </div>
      </div>

      {/* 5 Blöcke — single-side border-left, radius 0, getönter bg */}
      <div className="border-t border-border">
        {BLOCKS.map(({ key, label, Icon, bg, border, color, italic, bold }) => {
          const text = (ar[key] as string | undefined)?.trim();
          if (!text) return null;
          return (
            <div key={key} className="px-4 py-3" style={{ borderLeft: `4px solid ${border}`, background: bg }}>
              <div className="mb-1 flex items-center gap-1.5" style={{ color: border }}>
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p
                className="whitespace-pre-wrap text-[13px]"
                style={{ color, fontStyle: italic ? "italic" : undefined, fontWeight: bold ? 500 : undefined }}
              >
                {text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Profil öffnen bleibt in jeder Karte */}
      <div className="border-t border-border p-4">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
        >
          <Plus className="h-3.5 w-3.5" /> Profil öffnen
        </button>
      </div>
    </div>
  );
}
