import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  is_won_stage?: boolean | null;
  is_lost_stage?: boolean | null;
}

interface MobileStageSelectorProps {
  stages: Stage[];
  selectedStageId: string;
  onStageChange: (stageId: string) => void;
}

export function MobileStageSelector({ stages, selectedStageId, onStageChange }: MobileStageSelectorProps) {
  return (
    <Select value={selectedStageId} onValueChange={onStageChange}>
      <SelectTrigger className="w-full min-h-[44px]">
        <SelectValue placeholder="Stage wählen" />
      </SelectTrigger>
      <SelectContent>
        {stages.map((s) => (
          <SelectItem key={s.id} value={s.id} className="min-h-[44px]">
            {s.name}
            {s.is_won_stage && " 🏆"}
            {s.is_lost_stage && " ✕"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface StageChangeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
  currentStageId: string;
  dealTitle: string;
  onSelect: (stageId: string) => void;
}

export function StageChangeSheet({ open, onOpenChange, stages, currentStageId, dealTitle, onSelect }: StageChangeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">Stage ändern – {dealTitle}</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 mt-4 pb-4">
          {stages.map((s) => (
            <Button
              key={s.id}
              variant={s.id === currentStageId ? "default" : "outline"}
              className={cn(
                "w-full justify-start min-h-[48px] text-left",
                s.is_won_stage && s.id !== currentStageId && "border-success/30 text-success hover:bg-success/5",
                s.is_lost_stage && s.id !== currentStageId && "border-destructive/30 text-destructive hover:bg-destructive/5"
              )}
              onClick={() => { onSelect(s.id); onOpenChange(false); }}
            >
              {s.name}
              {s.is_won_stage && " 🏆"}
              {s.is_lost_stage && " ✕"}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
