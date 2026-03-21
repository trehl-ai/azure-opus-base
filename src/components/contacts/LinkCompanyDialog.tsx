import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";

interface Props {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const relationshipOptions = [
  { value: "main_contact", label: "Hauptkontakt" },
  { value: "billing", label: "Buchhaltung" },
  { value: "operational", label: "Operativ" },
  { value: "decision_maker", label: "Entscheider" },
];

export function LinkCompanyDialog({ contactId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [relationshipType, setRelationshipType] = useState("main_contact");
  const [isPrimary, setIsPrimary] = useState(false);

  const { data: companies } = useQuery({
    queryKey: ["companies-search-link", search],
    queryFn: async () => {
      let q = supabase.from("companies").select("id, name").order("name").limit(20);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase.from("company_contacts").insert({
        company_id: companyId,
        contact_id: contactId,
        relationship_type: relationshipType,
        is_primary: isPrimary,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Unternehmen zugeordnet" });
      qc.invalidateQueries({ queryKey: ["contact-companies", contactId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Fehler", description: err.message.includes("duplicate") ? "Bereits zugeordnet" : err.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-section-title">Unternehmen zuordnen</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-label">Beziehungstyp</Label>
              <Select value={relationshipType} onValueChange={setRelationshipType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{relationshipOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-label cursor-pointer">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded border-border" />
                Primärkontakt
              </label>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Unternehmen suchen…" className="pl-10" />
          </div>
          <div className="max-h-[240px] overflow-y-auto space-y-1">
            {companies?.map((c) => (
              <button key={c.id} onClick={() => mutation.mutate(c.id)} disabled={mutation.isPending} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors">
                <span className="text-body font-medium text-foreground">{c.name}</span>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {companies?.length === 0 && <p className="py-4 text-center text-label text-muted-foreground">Keine Unternehmen gefunden.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
