import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface Props {
  contact: Contact;
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

export function EditContactSheet({ contact, open, onOpenChange }: Props) {
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    mobile: contact.mobile ?? "",
    job_title: contact.job_title ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    status: contact.status,
    source: contact.source ?? "manual",
    owner_user_id: contact.owner_user_id ?? "",
    notes: contact.notes ?? "",
  });

  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim() || !form.last_name.trim()) throw new Error("Vor- und Nachname sind Pflicht");
      const { error } = await supabase.from("contacts").update({
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
      }).eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Kontakt aktualisiert" });
      qc.invalidateQueries({ queryKey: ["contact", contact.id] });
      qc.invalidateQueries({ queryKey: ["contacts-list"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="text-section-title">Contact bearbeiten</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-label">Vorname *</Label><Input value={form.first_name} onChange={(e) => u("first_name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-label">Nachname *</Label><Input value={form.last_name} onChange={(e) => u("last_name", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-label">E-Mail</Label><Input value={form.email} onChange={(e) => u("email", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-label">Telefon</Label><Input value={form.phone} onChange={(e) => u("phone", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-label">Mobil</Label><Input value={form.mobile} onChange={(e) => u("mobile", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-label">Position</Label><Input value={form.job_title} onChange={(e) => u("job_title", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-label">LinkedIn</Label><Input value={form.linkedin_url} onChange={(e) => u("linkedin_url", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Status</Label>
              <Select value={form.status} onValueChange={(v) => u("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Quelle</Label>
              <Select value={form.source} onValueChange={(v) => u("source", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sourceOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => u("owner_user_id", v)}><SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger><SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{usr.full_name || `${usr.first_name || ''} ${usr.last_name || ''}`.trim() || usr.email}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label className="text-label">Notizen</Label><Textarea value={form.notes} onChange={(e) => u("notes", e.target.value)} rows={3} /></div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Speichern…" : "Speichern"}</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
