import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateCompanySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "prospect", label: "Prospect" },
  { value: "active_customer", label: "Active Customer" },
  { value: "inactive", label: "Inactive" },
  { value: "partner", label: "Partner" },
];

const sourceOptions = [
  { value: "manual", label: "Manual" },
  { value: "csv_import", label: "CSV Import" },
  { value: "email_intake", label: "Email Intake" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
];

export function CreateCompanySheet({ open, onOpenChange }: CreateCompanySheetProps) {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    industry: "",
    website: "",
    street: "",
    postal_code: "",
    city: "",
    country: "Deutschland",
    status: "prospect",
    source: "manual",
    owner_user_id: "",
    notes: "",
  });

  const [nameError, setNameError] = useState("");

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name") setNameError("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Firmenname ist ein Pflichtfeld");
      }

      const { error } = await supabase.from("companies").insert({
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        website: form.website.trim() || null,
        street: form.street.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        status: form.status,
        source: form.source,
        owner_user_id: form.owner_user_id || null,
        notes: form.notes.trim() || null,
        created_by_user_id: user?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Company erstellt", description: `"${form.name}" wurde erfolgreich angelegt.` });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      resetAndClose();
    },
    onError: (err: Error) => {
      if (err.message === "Firmenname ist ein Pflichtfeld") {
        setNameError(err.message);
        return;
      }
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });

  const resetAndClose = () => {
    setForm({
      name: "", industry: "", website: "", street: "", postal_code: "",
      city: "", country: "Deutschland", status: "prospect", source: "manual",
      owner_user_id: "", notes: "",
    });
    setNameError("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-section-title">Neue Company</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-label">
              Firmenname <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Firmenname eingeben"
              className={nameError ? "border-destructive" : ""}
            />
            {nameError && <p className="text-[12px] text-destructive">{nameError}</p>}
          </div>

          {/* Industry + Website */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Branche</Label>
              <Input value={form.industry} onChange={(e) => updateField("industry", e.target.value)} placeholder="z.B. Software" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Website</Label>
              <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://..." />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-label">Straße</Label>
            <Input value={form.street} onChange={(e) => updateField("street", e.target.value)} placeholder="Straße und Hausnummer" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">PLZ</Label>
              <Input value={form.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} placeholder="PLZ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Ort</Label>
              <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Stadt" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Land</Label>
              <Input value={form.country} onChange={(e) => updateField("country", e.target.value)} />
            </div>
          </div>

          {/* Status + Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Quelle</Label>
              <Select value={form.source} onValueChange={(v) => updateField("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label className="text-label">Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => updateField("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger>
              <SelectContent>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-label">Notizen</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Optionale Notizen..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Wird gespeichert…" : "Speichern"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={resetAndClose}>
              Abbrechen
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
