import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type DealActivity = Database["public"]["Tables"]["deal_activities"]["Row"];

// Must match CHECK constraint on deal_activities.activity_type:
// ('call','email','note','meeting','task','briefing','casting')
const ACTIVITY_TYPE_OPTIONS = [
  { value: "call",     label: "📞 Anruf" },
  { value: "email",    label: "📧 E-Mail" },
  { value: "meeting",  label: "🤝 Meeting" },
  { value: "task",     label: "✅ Aufgabe" },
  { value: "note",     label: "📝 Notiz" },
  { value: "briefing", label: "📋 Briefing" },
  { value: "casting",  label: "🎬 Casting" },
] as const;

interface EditActivitySheetProps {
  activity: DealActivity | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const toLocalInputValue = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = { title: "", description: "", activity_type: "call", status: "open", due_date: "" };

export function EditActivitySheet({ activity, open, onClose, onSaved }: EditActivitySheetProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (activity) {
      setForm({
        title: activity.title,
        description: activity.description ?? "",
        activity_type: activity.activity_type,
        status: activity.status ?? "open",
        due_date: activity.due_date ? toLocalInputValue(activity.due_date) : "",
      });
    }
  }, [activity?.id]);

  const u = (f: keyof typeof emptyForm, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activity) throw new Error("Keine Aktivität ausgewählt");
      if (!form.title.trim()) throw new Error("Titel ist Pflicht");
      const { error } = await supabase
        .from("deal_activities")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          activity_type: form.activity_type,
          status: form.status,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        })
        .eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Aktivität aktualisiert" });
      qc.invalidateQueries({ queryKey: ["deal-activities"] });
      qc.invalidateQueries({ queryKey: ["open-activities"] });
      qc.invalidateQueries({ queryKey: ["activity-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard_activities"] });
      onSaved();
      onClose();
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="text-section-title">Aktivität bearbeiten</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-label">Titel *</Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Typ</Label>
            <Select value={form.activity_type} onValueChange={(v) => u("activity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIVITY_TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Status</Label>
            <Select value={form.status} onValueChange={(v) => u("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Fällig am</Label>
            <Input type="datetime-local" value={form.due_date} onChange={(e) => u("due_date", e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Speichern…" : "Speichern"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
