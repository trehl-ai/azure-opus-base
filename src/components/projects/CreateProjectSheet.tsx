import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useMainProjects } from "@/hooks/queries/useMainProjects";
import { useToast } from "@/hooks/use-toast";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { data: mainProjects } = useMainProjects();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: "", company_id: "", primary_contact_id: "", status: "new",
    priority: "medium", owner_user_id: "", description: "", main_project_id: "",
  });
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [titleError, setTitleError] = useState("");

  const u = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); if (f === "title") setTitleError(""); };

  const { data: companies } = useQuery({
    queryKey: ["companies-project-search", companySearch],
    queryFn: async () => {
      let q = supabase.from("companies").select("id, name").order("name").limit(20);
      if (companySearch.trim()) q = q.ilike("name", `%${companySearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-project-search", contactSearch, form.company_id],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, first_name, last_name").order("first_name").limit(20);
      if (contactSearch.trim()) q = q.or(`first_name.ilike.%${contactSearch.trim()}%,last_name.ilike.%${contactSearch.trim()}%`);
      if (form.company_id) {
        const { data: linked } = await supabase.from("company_contacts").select("contact_id").eq("company_id", form.company_id);
        const ids = linked?.map((l) => l.contact_id) ?? [];
        if (ids.length > 0) q = q.in("id", ids); else return [];
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedCompany = companies?.find((c) => c.id === form.company_id);
  const selectedContact = contacts?.find((c) => c.id === form.primary_contact_id);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) { setTitleError("Projektname ist Pflicht"); throw new Error("validation"); }
      const { error } = await supabase.from("projects").insert({
        title: form.title.trim(),
        company_id: form.company_id || null,
        primary_contact_id: form.primary_contact_id || null,
        status: form.status,
        priority: form.priority,
        owner_user_id: form.owner_user_id || null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        description: form.description.trim() || null,
        created_by_user_id: user?.id ?? null,
        main_project_id: form.main_project_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Projekt erstellt" });
      qc.invalidateQueries({ queryKey: ["projects"] });
      resetAndClose();
    },
    onError: (err: Error) => { if (err.message !== "validation") toast({ variant: "destructive", title: "Fehler", description: err.message }); },
  });

  const resetAndClose = () => {
    setForm({ title: "", company_id: "", primary_contact_id: "", status: "new", priority: "medium", owner_user_id: "", description: "", main_project_id: "" });
    setStartDate(undefined); setEndDate(undefined); setCompanySearch(""); setContactSearch(""); setTitleError("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Neues Projekt</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Projektname <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} placeholder="z.B. Website Relaunch" className={titleError ? "border-destructive" : ""} />
            {titleError && <p className="text-[12px] text-destructive">{titleError}</p>}
          </div>
          {/* Main Project */}
          {mainProjects && mainProjects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Hauptprojekt</Label>
              <Select value={form.main_project_id} onValueChange={(v) => u("main_project_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Keins" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keins</SelectItem>
                  {mainProjects.map((mp) => <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Company */}
          <div className="space-y-1.5">
            <Label>Unternehmen</Label>
            {selectedCompany ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{selectedCompany.name}</span>
                <button onClick={() => { u("company_id", ""); u("primary_contact_id", ""); }} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
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
          {/* Contact */}
          <div className="space-y-1.5">
            <Label>Hauptkontakt</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{selectedContact.first_name} {selectedContact.last_name}</span>
                <button onClick={() => u("primary_contact_id", "")} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Kontakt suchen…" className="pl-10" /></div>
                {contactSearch.trim() && contacts && contacts.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto rounded-lg border border-border">
                    {contacts.map((c) => <button key={c.id} onClick={() => { u("primary_contact_id", c.id); setContactSearch(""); }} className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted/50">{c.first_name} {c.last_name}</button>)}
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
                <SelectContent>
                  {["new","planned","in_progress","blocked","review","completed"].map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}</SelectItem>)}
                </SelectContent>
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
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Speichern…" : "Speichern"}</Button>
            <Button variant="outline" className="flex-1" onClick={resetAndClose}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
