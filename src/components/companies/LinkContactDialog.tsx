import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus } from "lucide-react";

interface LinkContactDialogProps {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const relationshipOptions = [
  { value: "main_contact", label: "Hauptkontakt" },
  { value: "billing", label: "Buchhaltung" },
  { value: "operational", label: "Operativ" },
  { value: "decision_maker", label: "Entscheider" },
];

export function LinkContactDialog({ companyId, open, onOpenChange }: LinkContactDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [relationshipType, setRelationshipType] = useState("main_contact");
  const [isPrimary, setIsPrimary] = useState(false);

  // New contact form
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", email: "", job_title: "" });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-search", search],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, first_name, last_name, email, job_title").order("first_name").limit(20);
      if (search.trim()) {
        q = q.or(`first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from("company_contacts").insert({
        company_id: companyId,
        contact_id: contactId,
        relationship_type: relationshipType,
        is_primary: isPrimary,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Kontakt zugeordnet" });
      queryClient.invalidateQueries({ queryKey: ["company-contacts", companyId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Fehler", description: err.message.includes("duplicate") ? "Kontakt bereits zugeordnet" : err.message });
    },
  });

  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      if (!newContact.first_name.trim() || !newContact.last_name.trim()) throw new Error("Vor- und Nachname sind Pflicht");
      const { data, error } = await supabase.from("contacts").insert({
        first_name: newContact.first_name.trim(),
        last_name: newContact.last_name.trim(),
        email: newContact.email.trim() || null,
        job_title: newContact.job_title.trim() || null,
        created_by_user_id: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;

      const { error: linkError } = await supabase.from("company_contacts").insert({
        company_id: companyId,
        contact_id: data.id,
        relationship_type: relationshipType,
        is_primary: isPrimary,
      });
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      toast({ title: "Kontakt erstellt und zugeordnet" });
      queryClient.invalidateQueries({ queryKey: ["company-contacts", companyId] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-section-title">Kontakt zuordnen</DialogTitle>
        </DialogHeader>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-label">Beziehungstyp</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {relationshipOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-label cursor-pointer">
              <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded border-border" />
              Primärkontakt
            </label>
          </div>
        </div>

        <Tabs defaultValue="existing" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">Bestehenden suchen</TabsTrigger>
            <TabsTrigger value="new" className="flex-1">Neuen erstellen</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name oder E-Mail suchen…" className="pl-10" />
            </div>
            <div className="max-h-[240px] overflow-y-auto space-y-1">
              {contacts?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => linkMutation.mutate(c.id)}
                  disabled={linkMutation.isPending}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-body font-medium text-foreground">{c.first_name} {c.last_name}</p>
                    <p className="text-label text-muted-foreground">{c.email ?? c.job_title ?? ""}</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {contacts?.length === 0 && <p className="py-4 text-center text-label text-muted-foreground">Keine Kontakte gefunden.</p>}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-label">Vorname <span className="text-destructive">*</span></Label>
                <Input value={newContact.first_name} onChange={(e) => setNewContact((p) => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Nachname <span className="text-destructive">*</span></Label>
                <Input value={newContact.last_name} onChange={(e) => setNewContact((p) => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">E-Mail</Label>
              <Input value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label">Position</Label>
              <Input value={newContact.job_title} onChange={(e) => setNewContact((p) => ({ ...p, job_title: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => createAndLinkMutation.mutate()} disabled={createAndLinkMutation.isPending}>
              {createAndLinkMutation.isPending ? "Wird erstellt…" : "Erstellen & zuordnen"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
