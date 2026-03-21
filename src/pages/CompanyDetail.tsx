import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CompanyStatusBadge } from "@/components/companies/CompanyStatusBadge";
import { EditCompanySheet } from "@/components/companies/EditCompanySheet";
import { LinkContactDialog } from "@/components/companies/LinkContactDialog";
import { EntityTagsManager } from "@/components/shared/EntityTagsManager";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Pencil, Trash2, Plus, ExternalLink, Check } from "lucide-react";

const cardClass = "rounded-2xl border border-border bg-card p-6";

const relationshipLabels: Record<string, string> = {
  main_contact: "Hauptkontakt",
  billing: "Buchhaltung",
  operational: "Operativ",
  decision_maker: "Entscheider",
};

const dealStatusColors: Record<string, string> = {
  open: "bg-info/10 text-info",
  won: "bg-success/10 text-success",
  lost: "bg-destructive/10 text-destructive",
};

const projectStatusColors: Record<string, string> = {
  new: "bg-info/10 text-info",
  planned: "bg-purple-100 text-purple-700",
  in_progress: "bg-warning/10 text-warning",
  blocked: "bg-destructive/10 text-destructive",
  review: "bg-purple-100 text-purple-700",
  completed: "bg-success/10 text-success",
};

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const { canWrite } = usePermission();
  const canWriteCompanies = canWrite("companies");

  // Company
  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, owner:users!companies_owner_user_id_fkey(id, first_name, last_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Contacts
  const { data: companyContacts } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_contacts")
        .select("*, contact:contacts(id, first_name, last_name, email, job_title)")
        .eq("company_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Deals
  const { data: deals } = useQuery({
    queryKey: ["company-deals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, stage:pipeline_stages(name), owner:users!deals_owner_user_id_fkey(first_name, last_name)")
        .eq("company_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Projects
  const { data: projects } = useQuery({
    queryKey: ["company-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, owner:users!projects_owner_user_id_fkey(first_name, last_name)")
        .eq("company_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Company gelöscht" });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      navigate("/companies", { replace: true });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });

  // Save notes
  const notesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update({ notes: notes?.trim() || null }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notizen gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["company", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!company) {
    return <p className="text-muted-foreground">Company nicht gefunden.</p>;
  }

  const owner = company.owner as { id: string; first_name: string; last_name: string } | null;
  const currentNotes = notes ?? company.notes ?? "";

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";

  const formatCurrency = (v: number | null) =>
    v != null ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v) : "–";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/companies")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-section-title text-foreground">{company.name}</h1>
          <CompanyStatusBadge status={company.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Bearbeiten
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Company löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{company.name}" wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="contacts">Kontakte {companyContacts?.length ? `(${companyContacts.length})` : ""}</TabsTrigger>
          <TabsTrigger value="deals">Deals {deals?.length ? `(${deals.length})` : ""}</TabsTrigger>
          <TabsTrigger value="projects">Projekte {projects?.length ? `(${projects.length})` : ""}</TabsTrigger>
          <TabsTrigger value="notes">Notizen</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className={cardClass}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Firmenname" value={company.name} />
              <Field label="Branche" value={company.industry} />
              <Field label="Website" value={company.website} isLink />
              <Field label="Quelle" value={company.source} />
              <Field label="Straße" value={company.street} />
              <Field label="PLZ / Ort" value={[company.postal_code, company.city].filter(Boolean).join(" ") || null} />
              <Field label="Land" value={company.country} />
              <Field label="Owner" value={owner ? `${owner.first_name} ${owner.last_name}` : null} />
              <Field label="Erstellt am" value={formatDate(company.created_at)} />
            </div>
          </div>
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="mt-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-body font-semibold text-foreground">Verknüpfte Kontakte</h2>
              <Button size="sm" className="gap-1.5" onClick={() => setLinkContactOpen(true)}>
                <Plus className="h-4 w-4" /> Kontakt zuordnen
              </Button>
            </div>
            {companyContacts && companyContacts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-label font-semibold">Name</TableHead>
                    <TableHead className="text-label font-semibold">E-Mail</TableHead>
                    <TableHead className="text-label font-semibold">Position</TableHead>
                    <TableHead className="text-label font-semibold">Beziehung</TableHead>
                    <TableHead className="text-label font-semibold">Primär</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyContacts.map((cc) => {
                    const contact = cc.contact as { id: string; first_name: string; last_name: string; email: string | null; job_title: string | null } | null;
                    if (!contact) return null;
                    return (
                      <TableRow key={cc.id} className="cursor-pointer h-[52px] hover:bg-muted/50" onClick={() => navigate(`/contacts/${contact.id}`)}>
                        <TableCell className="text-body font-medium">{contact.first_name} {contact.last_name}</TableCell>
                        <TableCell className="text-body text-muted-foreground">{contact.email ?? "–"}</TableCell>
                        <TableCell className="text-body text-muted-foreground">{contact.job_title ?? "–"}</TableCell>
                        <TableCell>
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">
                            {relationshipLabels[cc.relationship_type ?? ""] ?? cc.relationship_type}
                          </span>
                        </TableCell>
                        <TableCell>{cc.is_primary && <Check className="h-4 w-4 text-success" />}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="py-6 text-center text-label text-muted-foreground">Noch keine Kontakte zugeordnet.</p>
            )}
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
                    <TableHead className="text-label font-semibold">Stage</TableHead>
                    <TableHead className="text-label font-semibold">Wert</TableHead>
                    <TableHead className="text-label font-semibold">Status</TableHead>
                    <TableHead className="text-label font-semibold">Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => {
                    const stage = deal.stage as { name: string } | null;
                    const dealOwner = deal.owner as { first_name: string; last_name: string } | null;
                    return (
                      <TableRow key={deal.id} className="cursor-pointer h-[52px] hover:bg-muted/50" onClick={() => navigate(`/deals/${deal.id}`)}>
                        <TableCell className="text-body font-medium">{deal.title}</TableCell>
                        <TableCell>
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium">{stage?.name ?? "–"}</span>
                        </TableCell>
                        <TableCell className="text-body text-muted-foreground">{formatCurrency(deal.value_amount)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${dealStatusColors[deal.status] ?? "bg-muted text-muted-foreground"}`}>
                            {deal.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-body text-muted-foreground">
                          {dealOwner ? `${dealOwner.first_name} ${dealOwner.last_name}` : "–"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="py-6 text-center text-label text-muted-foreground">Keine Deals vorhanden.</p>
            )}
          </div>
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-body font-semibold text-foreground mb-4">Verknüpfte Projekte</h2>
            {projects && projects.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-label font-semibold">Projekt</TableHead>
                    <TableHead className="text-label font-semibold">Status</TableHead>
                    <TableHead className="text-label font-semibold">Owner</TableHead>
                    <TableHead className="text-label font-semibold">Start</TableHead>
                    <TableHead className="text-label font-semibold">Ende</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const pOwner = project.owner as { first_name: string; last_name: string } | null;
                    return (
                      <TableRow key={project.id} className="cursor-pointer h-[52px] hover:bg-muted/50" onClick={() => navigate(`/projects/${project.id}`)}>
                        <TableCell className="text-body font-medium">{project.title}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${projectStatusColors[project.status] ?? "bg-muted text-muted-foreground"}`}>
                            {project.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-body text-muted-foreground">
                          {pOwner ? `${pOwner.first_name} ${pOwner.last_name}` : "–"}
                        </TableCell>
                        <TableCell className="text-body text-muted-foreground">{formatDate(project.start_date)}</TableCell>
                        <TableCell className="text-body text-muted-foreground">{formatDate(project.end_date)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="py-6 text-center text-label text-muted-foreground">Keine Projekte vorhanden.</p>
            )}
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-body font-semibold text-foreground mb-4">Notizen</h2>
            <Textarea
              value={currentNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notizen zur Company..."
              rows={6}
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => notesMutation.mutate()} disabled={notesMutation.isPending}>
                {notesMutation.isPending ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="mt-4">
          <div className={cardClass}>
            <h2 className="text-body font-semibold text-foreground mb-4">Tags</h2>
            <EntityTagsManager entityType="company" entityId={id!} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheets & Dialogs */}
      <EditCompanySheet company={company} open={editOpen} onOpenChange={setEditOpen} />
      <LinkContactDialog companyId={id!} open={linkContactOpen} onOpenChange={setLinkContactOpen} />
    </div>
  );
}

function Field({ label, value, isLink }: { label: string; value: string | null; isLink?: boolean }) {
  return (
    <div>
      <p className="text-label text-muted-foreground">{label}</p>
      {isLink && value ? (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-body text-primary hover:underline inline-flex items-center gap-1">
          {value} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="text-body text-foreground">{value ?? "–"}</p>
      )}
    </div>
  );
}
