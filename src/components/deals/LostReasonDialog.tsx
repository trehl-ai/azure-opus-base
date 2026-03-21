import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  dealId: string;
  dealTitle: string;
  stageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function LostReasonDialog({ dealId, dealTitle, stageId, open, onOpenChange, onComplete }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("deals").update({
        pipeline_stage_id: stageId,
        status: "lost",
        lost_at: new Date().toISOString(),
        lost_reason: reason.trim() || null,
      }).eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deal als Lost markiert" });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      setReason("");
      onOpenChange(false);
      onComplete();
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); onComplete(); } else onOpenChange(true); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Deal verloren – "{dealTitle}"</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-label">Grund für den Verlust</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Warum wurde der Deal verloren?" rows={4} />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Speichern…" : "Als Lost markieren"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); onComplete(); }}>Abbrechen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
