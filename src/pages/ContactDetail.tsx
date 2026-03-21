import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContactStatusBadge } from "@/components/contacts/ContactStatusBadge";
import { EditContactSheet } from "@/components/contacts/EditContactSheet";
import { LinkCompanyDialog } from "@/components/contacts/LinkCompanyDialog";
import { EntityTagsManager } from "@/components/shared/EntityTagsManager";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, Trash2, Plus, ExternalLink, Mail, Check } from "lucide-react";

const cardClass = "rounded-2xl border border-border bg-card p-6";
const relationshipLabels: Record<string, string> = { main_contact: "Hauptkontakt", billing: "Buchhaltung", operational: "Operativ", decision_maker: "Entscheider" };
const dealStatusColors: Record<string, string> = { open: "bg-info/10 text-info", won: "bg-success/10 text-success", lost: "bg-destructive/10 text-destructive" };

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [linkCompanyOpen, setLinkCompanyOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const { canWrite } = usePermission();
  const canWriteContacts = canWrite("contacts");

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, owner:users!contacts_owner_user_id_fkey(id, first_name, last_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contactCompanies } = useQuery({
    queryKey: ["contact-companies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_contacts")
        .select("*, company:companies(id, name)")
        .eq("contact_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: deals } = useQuery({
    queryKey: ["contact-deals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, stage:pipeline_stages(name), deal_company:companies(name), owner:users!deals_owner_user_id_fkey(first_name, last_name)")
        .eq("primary_contact_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Kontakt gelöscht" });
      qc.invalidateQueries({ queryKey: ["contacts-list"] });
      navigate("/contacts", { replace: true });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const notesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").update({ notes: notes?.trim() || null }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notizen gespeichert" });
      qc.invalidateQueries({ queryKey: ["contact", id] });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!contact) return <p className="text-muted-foreground">Kontakt nicht gefunden.</p>;

  const owner = contact.owner as { id: string; first_name: string; last_name: string } | null;
  const currentNotes = notes ?? contact.notes ?? "";
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
  const formatCurrency = (v: number | null) => v != null ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v) : "–";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/contacts")} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-section-title text-foreground">{contact.first_name} {contact.last_name}</h1>
          <ContactStatusBadge status={contact.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Bearbeiten</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Löschen</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
                <AlertDialogDescription>"{contact.first_name} {contact.last_name}" wird unwiderruflich gelöscht.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="companies">Unternehmen {contactCompanies?.length ? `(${contactCompanies.length})` : ""}</TabsTrigger>
          <TabsTrigger value="deals">Deals {deals?.length ? `(${deals.length})` : ""}</TabsTrigger>
          <TabsTrigger value="notes">Notizen</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className={cardClass}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Vorname" value={contact.first_name} />
              <Field label="Nachname" value={contact.last_name} />
              <div>
                <p className="text-label text-muted-foreground">E-Mail</p>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-body text-primary hover:underline inline-flex items-center gap-1">
                    {contact.email} <Mail className="h-3 w-3" />
                  </a>
                ) : <p className="text-body text-foreground">–</p>}
              </div>
              <Field label="Telefon" value={contact.phone} />
              <Field label="Mobil" value={contact.mobile} />
              <Field label="Position" value={contact.job_title} />
              <div>
                <p className="text-label text-muted-foreground">LinkedIn</p>
                {contact.linkedin_url ? (
                  <a href={contact.linkedin_url.startsWith("http") ? contact.linkedin_url : `https://${contact.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="text-body text-primary hover:underline inline-flex items-center gap-1">
                    Profil öffnen <ExternalLink className="h-3 w-3" />
                  </a>
                ) : <p className="text-body text-foreground">–</p>}
              </div>
              <Field label="Quelle" value={contact.source} />
              <Field label="Owner" value={owner ? `${owner.first_name} ${owner.last_name}` : null} />
              <Field label="Erstellt am" value={formatDate(contact.created_at)} />
            </div>
          </div>
        </TabsContent>

        {/* Companies */}
        <TabsContent value="companies" className="mt-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-body font-semibold text-foreground">Zugeordnete Unternehmen</h2>
              <Button size="sm" className="gap-1.5" onClick={() => setLinkCompanyOpen(true)}><Plus className="h-4 w-4" /> Unternehmen zuordnen</Button>
            </div>
            {contactCompanies && contactCompanies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-label font-semibold">Unternehmen</TableHead>
                    <TableHead className="text-label font-semibold">Beziehung</TableHead>
                    <TableHead className="text-label font-semibold">Primär</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactCompanies.map((cc) => {
                    const company = cc.company as { id: string; name: string } | null;
                    if (!company) return null;
                    return (
                      <TableRow key={cc.id} className="cursor-pointer h-[52px] hover:bg-muted/50" onClick={() => navigate(`/companies/${company.id}`)}>
                        <TableCell className="text-body font-medium">{company.name}</TableCell>
                        <TableCell><span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">{relationshipLabels[cc.relationship_type ?? ""] ?? cc.relationship_type}</span></TableCell>
                        <TableCell>{cc.is_primary && <Check className="h-4 w-4 text-success" />}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : <p className="py-6 text-center text-label text-muted-foreground">Noch keine Unternehmen zugeordnet.</p>}
          </div>
        </TabsContent>

        {/* Deals */}
        <TabsContent value="deals" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-body font-semibold text-foreground mb-4">Verknüpfte Deals</h2>
            {deals && deals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-label font-semibold">Deal</TableHead>
                    <TableHead className="text-label font-semibold">Company</TableHead>
                    <TableHead className="text-label font-semibold">Stage</TableHead>
                    <TableHead className="text-label font-semibold">Wert</TableHead>
                    <TableHead className="text-label font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => {
                    const stage = deal.stage as { name: string } | null;
                    const dealCompany = deal.deal_company as { name: string } | null;
                    return (
                      <TableRow key={deal.id} className="cursor-pointer h-[52px] hover:bg-muted/50" onClick={() => navigate(`/deals/${deal.id}`)}>
                        <TableCell className="text-body font-medium">{deal.title}</TableCell>
                        <TableCell className="text-body text-muted-foreground">{dealCompany?.name ?? "–"}</TableCell>
                        <TableCell><span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium">{stage?.name ?? "–"}</span></TableCell>
                        <TableCell className="text-body text-muted-foreground">{formatCurrency(deal.value_amount)}</TableCell>
                        <TableCell><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${dealStatusColors[deal.status] ?? "bg-muted text-muted-foreground"}`}>{deal.status}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : <p className="py-6 text-center text-label text-muted-foreground">Keine Deals vorhanden.</p>}
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-body font-semibold text-foreground mb-4">Notizen</h2>
            <Textarea value={currentNotes} onChange={(e) => setNotes(e.target.value)} placeholder="Notizen zum Kontakt..." rows={6} />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => notesMutation.mutate()} disabled={notesMutation.isPending}>{notesMutation.isPending ? "Speichern…" : "Speichern"}</Button>
            </div>
          </div>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-body font-semibold text-foreground mb-4">Tags</h2>
            <EntityTagsManager entityType="contact" entityId={id!} />
          </div>
        </TabsContent>
      </Tabs>

      <EditContactSheet contact={contact} open={editOpen} onOpenChange={setEditOpen} />
      <LinkCompanyDialog contactId={id!} open={linkCompanyOpen} onOpenChange={setLinkCompanyOpen} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-label text-muted-foreground">{label}</p><p className="text-body text-foreground">{value ?? "–"}</p></div>;
}
