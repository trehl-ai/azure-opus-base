import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  prospect: {
    label: "Prospect",
    className: "bg-info/10 text-info",
  },
  active_customer: {
    label: "Active Customer",
    className: "bg-success/10 text-success",
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground",
  },
  partner: {
    label: "Partner",
    className: "bg-purple-100 text-purple-700",
  },
};

export function CompanyStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
