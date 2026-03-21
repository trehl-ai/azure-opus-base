import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/usePresence";

interface PresenceAvatarsProps {
  users: PresenceUser[];
  max?: number;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PresenceAvatars({ users, max = 5 }: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Online:</span>
      <div className="flex -space-x-1.5">
        {visible.map((u) => (
          <Tooltip key={u.user_id}>
            <TooltipTrigger asChild>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background cursor-default">
                {getInitials(u.name)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {u.name} ist ebenfalls auf dieser Seite
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
