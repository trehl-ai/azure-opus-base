import { ArrowLeft, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

interface MobileDetailHeaderProps {
  title: string;
  badge?: React.ReactNode;
  backPath: string;
  actions?: Action[];
  desktopActions?: React.ReactNode;
}

export function MobileDetailHeader({ title, badge, backPath, actions, desktopActions }: MobileDetailHeaderProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [actionsOpen, setActionsOpen] = useState(false);

  if (!isMobile) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-section-title text-foreground">{title}</h1>
          {badge}
        </div>
        {desktopActions}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between -mx-1">
        <button onClick={() => navigate(backPath)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center min-w-0 px-2">
          <h1 className="text-[16px] font-semibold text-foreground truncate">{title}</h1>
        </div>
        {actions && actions.length > 0 ? (
          <button onClick={() => setActionsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
        ) : <div className="w-10" />}
      </div>
      {badge && <div className="flex justify-center -mt-2 mb-2">{badge}</div>}

      <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">Aktionen</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 mt-4 pb-4">
            {actions?.map((action, i) => (
              <Button
                key={i}
                variant={action.variant === "destructive" ? "destructive" : "outline"}
                className="w-full justify-start min-h-[48px] gap-2"
                disabled={action.disabled}
                onClick={() => { action.onClick(); setActionsOpen(false); }}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
