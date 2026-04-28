import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const ACTIVITY_TYPE_OPTIONS = [
  { value: "call",          label: "📞 Anruf" },
  { value: "email",         label: "📧 E-Mail" },
  { value: "meeting",       label: "🤝 Meeting" },
  { value: "follow_up",     label: "🔄 Follow-Up" },
  { value: "wiedervorlage", label: "🔄 Wiedervorlage" },
  { value: "note",          label: "📝 Notiz" },
  { value: "angebot",       label: "📄 Angebot versendet" },
  { value: "absage",        label: "❌ Absage erhalten" },
] as const;

interface Props {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddActivityDialog({ dealId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({ activity_type: "call", title: "", description: "", owner_user_id: "" });
  const [outcome, setOutcome] = useState("");
  const [dueDate, setDueDate] = useState<Date>();

  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const fallbackTitle = ACTIVITY_TYPE_OPTIONS.find((t) => t.value === form.activity_type)?.label ?? form.activity_type;
      const description = form.description.trim();
      const outcomeText = outcome.trim();
      const finalDescription = outcomeText
        ? (description ? `${description}\n\nErgebnis: ${outcomeText}` : `Ergebnis: ${outcomeText}`)
        : (description || null);
      const { error } = await supabase.from("deal_activities").insert({
        deal_id: dealId,
        activity_type: form.activity_type,
        title: form.title.trim() || fallbackTitle,
        description: finalDescription,
        due_date: dueDate ? dueDate.toISOString() : null,
        owner_user_id: form.owner_user_id || user?.id || null,
        created_by_user_id: user?.id ?? null,
        completed_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Aktivität erstellt" });
      qc.invalidateQueries({ queryKey: ["deal-activities", dealId] });
      qc.invalidateQueries({ queryKey: ["activity-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard_activities"] });
      setForm({ activity_type: "call", title: "", description: "", owner_user_id: "" });
      setOutcome("");
      setDueDate(undefined);
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Neue Aktivität</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={form.activity_type} onValueChange={(v) => u("activity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIVITY_TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} placeholder="Optional – Standardwert wird verwendet" />
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outcome">Ergebnis / Outcome (optional)</Label>
            <Input
              id="outcome"
              placeholder="z.B. Rückruf vereinbart, Angebot angefordert, kein Interesse..."
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fälligkeitsdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, "dd.MM.yyyy") : "Datum wählen"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>Verantwortlich</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => u("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Zuweisen" /></SelectTrigger>
              <SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{usr.first_name} {usr.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Speichern…" : "Speichern"}</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
