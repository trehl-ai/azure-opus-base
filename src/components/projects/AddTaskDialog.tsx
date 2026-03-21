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

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTaskDialog({ projectId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({ title: "", description: "", assigned_user_id: "", priority: "medium" });
  const [startDate, setStartDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();
  const [titleError, setTitleError] = useState("");

  const u = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); if (f === "title") setTitleError(""); };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) { setTitleError("Titel ist Pflicht"); throw new Error("validation"); }
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_user_id: form.assigned_user_id || null,
        priority: form.priority,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        created_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Task erstellt" });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-task-counts"] });
      setForm({ title: "", description: "", assigned_user_id: "", priority: "medium" });
      setStartDate(undefined); setDueDate(undefined); setTitleError("");
      onOpenChange(false);
    },
    onError: (err: Error) => { if (err.message !== "validation") toast({ variant: "destructive", title: "Fehler", description: err.message }); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Neuer Task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titel <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} placeholder="Task-Titel" className={titleError ? "border-destructive" : ""} />
            {titleError && <p className="text-[12px] text-destructive">{titleError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Verantwortlich</Label>
              <Select value={form.assigned_user_id} onValueChange={(v) => u("assigned_user_id", v)}>
                <SelectTrigger><SelectValue placeholder="Zuweisen" /></SelectTrigger>
                <SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{usr.first_name} {usr.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "dd.MM.yyyy") : "Datum"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Fälligkeitsdatum</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, "dd.MM.yyyy") : "Datum"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
            </div>
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
