import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useConflictCheck } from "@/hooks/useConflictCheck";
import { ConflictWarning } from "@/components/shared/ConflictWarning";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DealData {
  id: string;
  title: string;
  value_amount: number | null;
  currency: string | null;
  expected_close_date: string | null;
  probability_percent: number | null;
  priority: string | null;
  source: string | null;
  owner_user_id: string | null;
  description: string | null;
  pipeline_id: string;
  pipeline_stage_id: string;
}

interface Props {
  deal: DealData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDealSheet({ deal, open, onOpenChange }: Props) {
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { captureTimestamp, checkConflict, dismissConflict, hasConflict } = useConflictCheck("deals", deal.id);

  const [form, setForm] = useState({
    title: "", value_amount: "", currency: "EUR", probability_percent: "",
    priority: "medium", source: "", owner_user_id: "", description: "",
    pipeline_stage_id: "",
  });
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>();

  useEffect(() => {
    if (open && deal) {
      setForm({
        title: deal.title,
        value_amount: deal.value_amount?.toString() ?? "",
        currency: deal.currency ?? "EUR",
        probability_percent: deal.probability_percent?.toString() ?? "",
        priority: deal.priority ?? "medium",
        source: deal.source ?? "",
        owner_user_id: deal.owner_user_id ?? "",
        description: deal.description ?? "",
        pipeline_stage_id: deal.pipeline_stage_id,
      });
      setExpectedCloseDate(deal.expected_close_date ? new Date(deal.expected_close_date) : undefined);
      captureTimestamp();
    }
  }, [open, deal, captureTimestamp]);

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", deal.pipeline_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_stages").select("*").eq("pipeline_id", deal.pipeline_id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("deals").update({
        title: form.title.trim(),
        value_amount: form.value_amount ? parseFloat(form.value_amount) : 0,
        currency: form.currency,
        expected_close_date: expectedCloseDate ? format(expectedCloseDate, "yyyy-MM-dd") : null,
        probability_percent: form.probability_percent ? parseInt(form.probability_percent) : 0,
        priority: form.priority,
        source: form.source.trim() || null,
        owner_user_id: form.owner_user_id || null,
        description: form.description.trim() || null,
        pipeline_stage_id: form.pipeline_stage_id,
      }).eq("id", deal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deal aktualisiert" });
      qc.invalidateQueries({ queryKey: ["deal", deal.id] });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Deal bearbeiten</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          {hasConflict && (
            <ConflictWarning
              onForceOverwrite={() => { dismissConflict(); mutation.mutate(); }}
              onReload={() => { dismissConflict(); onOpenChange(false); qc.invalidateQueries({ queryKey: ["deal", deal.id] }); }}
            />
          )}
          <div className="space-y-1.5">
            <Label>Deal-Name</Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={form.pipeline_stage_id} onValueChange={(v) => u("pipeline_stage_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{stages?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Deal-Wert</Label>
              <Input type="number" value={form.value_amount} onChange={(e) => u("value_amount", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Währung</Label>
              <Input value={form.currency} onChange={(e) => u("currency", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Abschlussdatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedCloseDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedCloseDate ? format(expectedCloseDate, "dd.MM.yyyy") : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={expectedCloseDate} onSelect={setExpectedCloseDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Wahrscheinlichkeit (%)</Label>
              <Input type="number" min="0" max="100" value={form.probability_percent} onChange={(e) => u("probability_percent", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priorität</Label>
              <Select value={form.priority} onValueChange={(v) => u("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quelle</Label>
              <Input value={form.source} onChange={(e) => u("source", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => u("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger>
              <SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{usr.first_name} {usr.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} rows={3} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Speichern…" : "Speichern"}</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
