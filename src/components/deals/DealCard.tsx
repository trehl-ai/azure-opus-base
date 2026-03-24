import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { RoadshowBadge } from "@/components/deals/RoadshowBadge";
import type { RoadshowEignung } from "@/lib/roadshowEignung";

interface DealCardData {
  id: string;
  title: string;
  company_name: string | null;
  value_amount: number | null;
  currency: string | null;
  priority: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  roadshow_eignung?: RoadshowEignung | null;
}

const priorityDot: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-warning",
  high: "bg-destructive",
};

export function DealCard({ deal, onDragStart }: { deal: DealCardData; onDragStart: (e: React.DragEvent, dealId: string) => void }) {
  const navigate = useNavigate();

  const formatCurrency = (v: number | null, c: string | null) =>
    v != null ? new Intl.NumberFormat("de-DE", { style: "currency", currency: c || "EUR", maximumFractionDigits: 0 }).format(v) : "";

  const initials = deal.owner_first_name && deal.owner_last_name
    ? `${deal.owner_first_name[0]}${deal.owner_last_name[0]}`.toUpperCase()
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={() => navigate(`/deals/${deal.id}`)}
      className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-2 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-foreground truncate leading-tight">{deal.title}</p>
          {deal.company_name && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{deal.company_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <RoadshowBadge eignung={deal.roadshow_eignung} size="sm" />
          {deal.priority && (
            <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[deal.priority] ?? priorityDot.medium)} />
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        {deal.value_amount ? (
          <span className="text-[11px] font-semibold text-foreground">{formatCurrency(deal.value_amount, deal.currency)}</span>
        ) : <span />}
        {initials && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[8px] font-semibold text-primary">
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}
