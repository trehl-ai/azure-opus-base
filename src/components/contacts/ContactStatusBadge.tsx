import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-warning/10 text-warning" },
  active: { label: "Active", className: "bg-success/10 text-success" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
};

export function ContactStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium", config.className)}>
      {config.label}
    </span>
  );
}
