import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileCardProps {
  onClick?: () => void;
  initials?: string;
  initialsColor?: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function MobileCard({
  onClick,
  initials,
  initialsColor = "bg-primary text-primary-foreground",
  title,
  subtitle,
  meta,
  badge,
  rightContent,
  className,
}: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors active:bg-muted/50",
        onClick && "cursor-pointer",
        className
      )}
    >
      {initials && (
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold", initialsColor)}>
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-medium text-foreground truncate">{title}</p>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
        {meta && <div className="mt-0.5">{meta}</div>}
      </div>
      {rightContent}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );
}
