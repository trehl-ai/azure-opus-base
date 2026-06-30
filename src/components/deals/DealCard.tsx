import { useNavigate } from "react-router-dom";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";
import { Phone } from "lucide-react";

interface DealCardData {
  id: string;
  title: string;
  company_name: string | null;
  value_amount: number | null;
  currency: string | null;
  priority: string | null;
  ownerName: string | null;
  phone?: string | null;
  bundesland?: string | null;
}

const priorityDot: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-warning",
  high: "bg-destructive",
};

// Bundesland-Badge: echte Werte aus contacts.bundesland. NRW kommt in zwei Schreibweisen vor.
const bundeslandBadge: Record<string, { short: string; cls: string }> = {
  "NRW": { short: "NRW", cls: "bg-blue-100 text-blue-700" },
  "Nordrhein-Westfalen": { short: "NRW", cls: "bg-blue-100 text-blue-700" },
  "Bayern": { short: "BAY", cls: "bg-green-100 text-green-700" },
  "Niedersachsen": { short: "NDS", cls: "bg-amber-100 text-amber-700" },
};

export function DealCard({ deal, onDragStart }: { deal: DealCardData; onDragStart: (e: React.DragEvent, dealId: string) => void }) {
  const navigate = useNavigate();

  const formatCurrency = (v: number | null, c: string | null) =>
    v != null ? new Intl.NumberFormat("de-DE", { style: "currency", currency: c || "EUR", maximumFractionDigits: 0 }).format(v) : "";

  const ownerName = deal.ownerName?.trim() || null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={() => navigate(`/deals/${deal.id}`)}
      className="cursor-pointer rounded-lg border border-border bg-card px-3 py-2.5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          {/* Schulname prominent + vollständig sichtbar (kein Truncate) */}
          <p className="text-[14px] font-semibold text-foreground leading-snug break-words">{deal.title}</p>
          {deal.company_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">{deal.company_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {(() => {
            const bl = deal.bundesland?.trim();
            if (!bl) {
              return (
                <span title="Bundesland fehlt" className="rounded px-1 py-[1px] text-[9px] font-bold leading-none bg-muted text-muted-foreground">
                  ?
                </span>
              );
            }
            const b = bundeslandBadge[bl];
            return (
              <span title={bl} className={cn("rounded px-1 py-[1px] text-[9px] font-bold leading-none", b?.cls ?? "bg-gray-100 text-gray-700")}>
                {b?.short ?? bl.slice(0, 3).toUpperCase()}
              </span>
            );
          })()}
          {deal.priority && (
            <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[deal.priority] ?? priorityDot.medium)} />
          )}
        </div>
      </div>
      {deal.phone && (
        <a
          href={`tel:${deal.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors truncate"
        >
          <Phone className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{deal.phone}</span>
        </a>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        {deal.value_amount ? (
          <span className="text-[11px] font-semibold text-foreground">{formatCurrency(deal.value_amount, deal.currency)}</span>
        ) : <span />}
        {ownerName && (
          <div
            title={ownerName}
            className={cn(
              "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white",
              getAvatarColor(ownerName),
            )}
          >
            {getInitials(ownerName)}
          </div>
        )}
      </div>
    </div>
  );
}
