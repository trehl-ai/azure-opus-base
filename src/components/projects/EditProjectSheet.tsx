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
import { CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProjectData {
  id: string;
  title: string;
  company_id: string | null;
  primary_contact_id: string | null;
  status: string;
  priority: string | null;
  owner_user_id: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Props {
  project: ProjectData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statuses = ["new", "planned", "in_progress", "blocked", "review", "completed"];

export function EditProjectSheet({ project, open, onOpenChange }: Props) {
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { captureTimestamp, checkConflict, dismissConflict, hasConflict } = useConflictCheck("projects", project.id);

  const [form, setForm] = useState({
    title: "", status: "new", priority: "medium", owner_user_id: "", description: "",
    company_id: "", primary_contact_id: "",
  });
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [companySearch, setCompanySearch] = useState("");

  useEffect(() => {
    if (open && project) {
      setForm({
        title: project.title, status: project.status, priority: project.priority ?? "medium",
        owner_user_id: project.owner_user_id ?? "", description: project.description ?? "",
        company_id: project.company_id ?? "", primary_contact_id: project.primary_contact_id ?? "",
      });
      setStartDate(project.start_date ? new Date(project.start_date) : undefined);
      setEndDate(project.end_date ? new Date(project.end_date) : undefined);
      captureTimestamp();
    }
  }, [open, project, captureTimestamp]);

  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const { data: companies } = useQuery({
    queryKey: ["companies-edit-search", companySearch],
    queryFn: async () => {
      let q = supabase.from("companies").select("id, name").order("name").limit(20);
      if (companySearch.trim()) q = q.ilike("name", `%${companySearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedCompany = companies?.find((c) => c.id === form.company_id);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({
        title: form.title.trim(),
        status: form.status,
        priority: form.priority,
        owner_user_id: form.owner_user_id || null,
        description: form.description.trim() || null,
        company_id: form.company_id || null,
        primary_contact_id: form.primary_contact_id || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      }).eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Projekt aktualisiert" });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Projekt bearbeiten</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          {hasConflict && (
            <ConflictWarning
              onForceOverwrite={() => { dismissConflict(); mutation.mutate(); }}
              onReload={() => { dismissConflict(); onOpenChange(false); qc.invalidateQueries({ queryKey: ["project", project.id] }); }}
            />
          )}
          <div className="space-y-1.5">
            <Label>Projektname</Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Unternehmen</Label>
            {selectedCompany || form.company_id ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{selectedCompany?.name ?? "Laden…"}</span>
                <button onClick={() => { u("company_id", ""); }} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Firma suchen…" className="pl-10" /></div>
                {companySearch.trim() && companies && companies.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto rounded-lg border border-border">
                    {companies.map((c) => <button key={c.id} onClick={() => { u("company_id", c.id); setCompanySearch(""); }} className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted/50">{c.name}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => u("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}</SelectItem>)}</SelectContent>
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
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => u("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger>
              <SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{usr.first_name} {usr.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "dd.MM.yyyy") : "Datum"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Enddatum</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, "dd.MM.yyyy") : "Datum"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} rows={3} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={async () => { const c = await checkConflict(); if (!c) mutation.mutate(); }} disabled={mutation.isPending}>{mutation.isPending ? "Speichern…" : "Speichern"}</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
