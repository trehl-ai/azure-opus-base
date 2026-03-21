import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DealCardData {
  id: string;
  title: string;
  company_name: string | null;
  value_amount: number | null;
  currency: string | null;
  priority: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
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
      className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-foreground truncate">{deal.title}</p>
          {deal.company_name && (
            <p className="text-label text-muted-foreground truncate mt-0.5">{deal.company_name}</p>
          )}
        </div>
        {deal.priority && (
          <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", priorityDot[deal.priority] ?? priorityDot.medium)} />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        {deal.value_amount ? (
          <span className="text-body font-semibold text-foreground">{formatCurrency(deal.value_amount, deal.currency)}</span>
        ) : <span />}
        {initials && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}
