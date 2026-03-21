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
import { Search } from "lucide-react";

interface CreateContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const sourceOptions = [
  { value: "manual", label: "Manual" },
  { value: "csv_import", label: "CSV Import" },
  { value: "email_intake", label: "Email Intake" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
];

export function CreateContactSheet({ open, onOpenChange }: CreateContactSheetProps) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", mobile: "",
    job_title: "", linkedin_url: "", status: "lead", source: "manual",
    owner_user_id: "", notes: "", company_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companySearch, setCompanySearch] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["companies-search", companySearch],
    queryFn: async () => {
      let q = supabase.from("companies").select("id, name").order("name").limit(20);
      if (companySearch.trim()) q = q.ilike("name", `%${companySearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const updateField = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};
      if (!form.first_name.trim()) newErrors.first_name = "Vorname ist Pflicht";
      if (!form.last_name.trim()) newErrors.last_name = "Nachname ist Pflicht";
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error("Validierung fehlgeschlagen");
      }

      const { data: contact, error } = await supabase.from("contacts").insert({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        job_title: form.job_title.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        status: form.status,
        source: form.source,
        owner_user_id: form.owner_user_id || null,
        notes: form.notes.trim() || null,
        created_by_user_id: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;

      // Link to company if selected
      if (form.company_id && contact) {
        const { error: linkError } = await supabase.from("company_contacts").insert({
          company_id: form.company_id,
          contact_id: contact.id,
          is_primary: true,
          relationship_type: "main_contact",
        });
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      toast({ title: "Kontakt erstellt", description: `${form.first_name} ${form.last_name} wurde angelegt.` });
      queryClient.invalidateQueries({ queryKey: ["contacts-list"] });
      resetAndClose();
    },
    onError: (err: Error) => {
      if (err.message === "Validierung fehlgeschlagen") return;
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });

  const resetAndClose = () => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", mobile: "", job_title: "", linkedin_url: "", status: "lead", source: "manual", owner_user_id: "", notes: "", company_id: "" });
    setErrors({});
    setCompanySearch("");
    onOpenChange(false);
  };

  const selectedCompany = companies?.find((c) => c.id === form.company_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-section-title">Neuer Contact</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Vorname <span className="text-destructive">*</span></Label>
              <Input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} placeholder="Vorname" className={errors.first_name ? "border-destructive" : ""} />
              {errors.first_name && <p className="text-[12px] text-destructive">{errors.first_name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Nachname <span className="text-destructive">*</span></Label>
              <Input value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} placeholder="Nachname" className={errors.last_name ? "border-destructive" : ""} />
              {errors.last_name && <p className="text-[12px] text-destructive">{errors.last_name}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">E-Mail</Label>
            <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@firma.de" type="email" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Telefon</Label>
              <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+49..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Mobil</Label>
              <Input value={form.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="+49..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Position</Label>
              <Input value={form.job_title} onChange={(e) => updateField("job_title", e.target.value)} placeholder="z.B. Geschäftsführer" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">LinkedIn</Label>
              <Input value={form.linkedin_url} onChange={(e) => updateField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Quelle</Label>
              <Select value={form.source} onValueChange={(v) => updateField("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sourceOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => updateField("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger>
              <SelectContent>{users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Company assignment */}
          <div className="space-y-1.5">
            <Label className="text-label">Unternehmen zuordnen</Label>
            {selectedCompany ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-body">{selectedCompany.name}</span>
                <button onClick={() => updateField("company_id", "")} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Firma suchen…" className="pl-10" />
                </div>
                {companySearch.trim() && companies && companies.length > 0 && (
                  <div className="max-h-[160px] overflow-y-auto rounded-lg border border-border">
                    {companies.map((c) => (
                      <button key={c.id} onClick={() => { updateField("company_id", c.id); setCompanySearch(""); }} className="flex w-full px-3 py-2 text-left text-body hover:bg-muted/50 transition-colors">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-label">Notizen</Label>
            <Textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Optionale Notizen..." rows={3} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Wird gespeichert…" : "Speichern"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={resetAndClose}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
