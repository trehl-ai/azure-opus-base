import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
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

export function CreateDealSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: "", company_id: "", primary_contact_id: "", pipeline_id: "",
    pipeline_stage_id: "", value_amount: "", currency: "EUR",
    probability_percent: "", priority: "medium", source: "", owner_user_id: "", description: "",
  });
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>();
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [titleError, setTitleError] = useState("");

  const u = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); if (f === "title") setTitleError(""); };

  // Pipelines
  const { data: pipelines } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Auto-select default pipeline
  const selectedPipelineId = form.pipeline_id || pipelines?.find((p) => p.is_default)?.id || pipelines?.[0]?.id || "";

  // Stages for selected pipeline
  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", selectedPipelineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_stages").select("*").eq("pipeline_id", selectedPipelineId).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPipelineId,
  });

  const defaultStageId = form.pipeline_stage_id || stages?.find((s) => s.position === 1)?.id || stages?.[0]?.id || "";

  // Companies search
  const { data: companies } = useQuery({
    queryKey: ["companies-deal-search", companySearch],
    queryFn: async () => {
      let q = supabase.from("companies").select("id, name").order("name").limit(20);
      if (companySearch.trim()) q = q.ilike("name", `%${companySearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Contacts filtered by company
  const { data: contacts } = useQuery({
    queryKey: ["contacts-deal-search", contactSearch, form.company_id],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, first_name, last_name, email").order("first_name").limit(20);
      if (contactSearch.trim()) q = q.or(`first_name.ilike.%${contactSearch.trim()}%,last_name.ilike.%${contactSearch.trim()}%`);
      if (form.company_id) {
        const { data: linked } = await supabase.from("company_contacts").select("contact_id").eq("company_id", form.company_id);
        const ids = linked?.map((l) => l.contact_id) ?? [];
        if (ids.length > 0) q = q.in("id", ids);
        else return [];
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
      if (!form.title.trim()) { setTitleError("Deal-Name ist Pflicht"); throw new Error("validation"); }
      const pid = form.pipeline_id || selectedPipelineId;
      const sid = form.pipeline_stage_id || defaultStageId;
      if (!pid || !sid) throw new Error("Pipeline und Stage sind erforderlich");

      const { error } = await supabase.from("deals").insert({
        title: form.title.trim(),
        company_id: form.company_id || null,
        primary_contact_id: form.primary_contact_id || null,
        pipeline_id: pid,
        pipeline_stage_id: sid,
        value_amount: form.value_amount ? parseFloat(form.value_amount) : 0,
        currency: form.currency,
        expected_close_date: expectedCloseDate ? format(expectedCloseDate, "yyyy-MM-dd") : null,
        probability_percent: form.probability_percent ? parseInt(form.probability_percent) : 0,
        priority: form.priority,
        source: form.source.trim() || null,
        owner_user_id: form.owner_user_id || null,
        description: form.description.trim() || null,
        created_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deal erstellt" });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      resetAndClose();
    },
    onError: (err: Error) => {
      if (err.message === "validation") return;
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });

  const resetAndClose = () => {
    setForm({ title: "", company_id: "", primary_contact_id: "", pipeline_id: "", pipeline_stage_id: "", value_amount: "", currency: "EUR", probability_percent: "", priority: "medium", source: "", owner_user_id: "", description: "" });
    setExpectedCloseDate(undefined);
    setCompanySearch("");
    setContactSearch("");
    setTitleError("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="text-section-title">Neuer Deal</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-label">Deal-Name <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} placeholder="z.B. Website Redesign" className={titleError ? "border-destructive" : ""} />
            {titleError && <p className="text-[12px] text-destructive">{titleError}</p>}
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <Label className="text-label">Unternehmen</Label>
            {selectedCompany ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-body">{selectedCompany.name}</span>
                <button onClick={() => { u("company_id", ""); u("primary_contact_id", ""); }} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Firma suchen…" className="pl-10" /></div>
                {companySearch.trim() && companies && companies.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto rounded-lg border border-border">
                    {companies.map((c) => <button key={c.id} onClick={() => { u("company_id", c.id); setCompanySearch(""); }} className="flex w-full px-3 py-2 text-left text-body hover:bg-muted/50">{c.name}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="space-y-1.5">
            <Label className="text-label">Hauptkontakt</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-body">{selectedContact.first_name} {selectedContact.last_name}</span>
                <button onClick={() => u("primary_contact_id", "")} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Kontakt suchen…" className="pl-10" /></div>
                {contactSearch.trim() && contacts && contacts.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto rounded-lg border border-border">
                    {contacts.map((c) => <button key={c.id} onClick={() => { u("primary_contact_id", c.id); setContactSearch(""); }} className="flex w-full px-3 py-2 text-left text-body hover:bg-muted/50">{c.first_name} {c.last_name}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pipeline + Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Pipeline</Label>
              <Select value={selectedPipelineId} onValueChange={(v) => { u("pipeline_id", v); u("pipeline_stage_id", ""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{pipelines?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Stage</Label>
              <Select value={defaultStageId} onValueChange={(v) => u("pipeline_stage_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stages?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Value + Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-label">Deal-Wert</Label>
              <Input type="number" value={form.value_amount} onChange={(e) => u("value_amount", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Währung</Label>
              <Input value={form.currency} onChange={(e) => u("currency", e.target.value)} />
            </div>
          </div>

          {/* Close date + Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Erwartetes Abschlussdatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedCloseDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedCloseDate ? format(expectedCloseDate, "dd.MM.yyyy") : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expectedCloseDate} onSelect={setExpectedCloseDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Wahrscheinlichkeit (%)</Label>
              <Input type="number" min="0" max="100" value={form.probability_percent} onChange={(e) => u("probability_percent", e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Priority + Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Priorität</Label>
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
              <Label className="text-label">Quelle</Label>
              <Input value={form.source} onChange={(e) => u("source", e.target.value)} placeholder="z.B. Website, Empfehlung" />
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label className="text-label">Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => u("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger>
              <SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{usr.first_name} {usr.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-label">Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} placeholder="Deal-Beschreibung..." rows={3} />
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
