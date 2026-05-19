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

  const ownerName = deal.ownerName?.trim() || null;

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
