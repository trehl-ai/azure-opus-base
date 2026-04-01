import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePipelines, usePipelineStages } from "@/hooks/queries/usePipelines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertTriangle, CheckCircle2, XCircle, ChevronDown, Info, Building2, User, Handshake, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { parseEmailBody, cleanSubject, splitFullName, type ExtractionSource } from "@/lib/intakeParser";

const statusBadge: Record<string, string> = {
  new: "bg-secondary text-secondary-foreground",
  parsed: "bg-info/10 text-info",
  review_required: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  imported: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};
const statusLabel: Record<string, string> = {
  new: "Neu", parsed: "Geparst", review_required: "Zu prüfen",
  approved: "Genehmigt", imported: "Importiert", rejected: "Abgelehnt",
};

interface FormData {
  company_name: string; company_industry: string; company_website: string; company_city: string; company_address: string;
  contact_first_name: string; contact_last_name: string; contact_email: string; contact_phone: string; contact_mobile: string; contact_job_title: string;
  deal_title: string; deal_value: string; notes: string;
}

const emptyForm: FormData = {
  company_name: "", company_industry: "", company_website: "", company_city: "", company_address: "",
  contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "", contact_mobile: "", contact_job_title: "",
  deal_title: "", deal_value: "", notes: "",
};

function cleanSubject(subject: string | null): string {
  if (!subject) return "";
  return subject.replace(/^(Fwd?|Fw|WG|AW|Re|Aw):\s*/gi, "").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── Mail Body Display ── */
function MailBodyDisplay({ rawBody, parsedPayload }: { rawBody: string | null; parsedPayload: Record<string, unknown> | null }) {
  let bodyText = rawBody || "";
  if (!bodyText && parsedPayload) {
    bodyText = (parsedPayload.body_text as string) || "";
    if (!bodyText && parsedPayload.body_html) {
      bodyText = stripHtml(parsedPayload.body_html as string);
    }
  }

  if (!bodyText) {
    return <p className="text-muted-foreground text-xs italic">Kein Text vorhanden.</p>;
  }

  return (
    <pre className="whitespace-pre-wrap text-sm leading-relaxed select-text max-h-[60vh] overflow-y-auto">
      {bodyText}
    </pre>
  );
}

export default function Intake() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [simulateOpen, setSimulateOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const { data: messages } = useQuery({
    queryKey: ["intake-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("intake_messages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pending = useMemo(() => messages?.filter((m) => ["review_required", "parsed", "new"].includes(m.status)) ?? [], [messages]);
  const approved = useMemo(() => messages?.filter((m) => ["approved", "imported"].includes(m.status)) ?? [], [messages]);
  const rejected = useMemo(() => messages?.filter((m) => m.status === "rejected") ?? [], [messages]);

  const renderTable = (items: typeof pending) => (
    <div className="rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Absender</TableHead>
            <TableHead>Betreff</TableHead>
            <TableHead>Empfangen</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">Keine Einträge.</TableCell></TableRow>
          ) : items.map((m) => (
            <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50 h-[52px]" onClick={() => setReviewId(m.id)}>
              <TableCell className="font-medium">{m.sender_email ?? "–"}</TableCell>
              <TableCell>{m.subject ?? "–"}</TableCell>
              <TableCell className="text-muted-foreground">{m.received_at ? format(new Date(m.received_at), "dd.MM.yyyy HH:mm") : "–"}</TableCell>
              <TableCell><span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", statusBadge[m.status])}>{statusLabel[m.status] ?? m.status}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold text-foreground">E-Mail Intake</h1>
        <Button onClick={() => setSimulateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Intake simulieren</Button>
      </div>
      <SenderHintBox />
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Zu prüfen ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Genehmigt ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Abgelehnt ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">{renderTable(pending)}</TabsContent>
        <TabsContent value="approved" className="mt-4">{renderTable(approved)}</TabsContent>
        <TabsContent value="rejected" className="mt-4">{renderTable(rejected)}</TabsContent>
      </Tabs>
      <SimulateDialog open={simulateOpen} onOpenChange={setSimulateOpen} />
      <ReviewSheet messageId={reviewId} open={!!reviewId} onOpenChange={(o) => { if (!o) setReviewId(null); }} />
    </div>
  );
}

/* ── Sender Hint Box ── */
function SenderHintBox() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-muted/50 transition-colors">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-foreground">Hinweis für Einsender</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-b-xl border border-t-0 border-border bg-muted/30 px-4 py-4 text-sm text-foreground space-y-3">
          <p>Bitte sende deine Anfrage an: <span className="font-semibold text-primary">sales@ts-connect.cloud</span></p>
          <p className="text-muted-foreground">E-Mails werden automatisch erfasst. Felder können manuell ausgefüllt werden.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Simulate Dialog ── */
function SimulateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ sender_email: "", subject: "", raw_body: "" });
  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("intake_messages").insert({
        sender_email: form.sender_email || null,
        subject: form.subject || null,
        raw_body: form.raw_body || null,
        status: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Intake-Nachricht erstellt" });
      qc.invalidateQueries({ queryKey: ["intake-messages"] });
      setForm({ sender_email: "", subject: "", raw_body: "" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Intake simulieren</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Absender-E-Mail</Label><Input value={form.sender_email} onChange={(e) => u("sender_email", e.target.value)} placeholder="max@firma.de" /></div>
            <div className="space-y-1"><Label>Betreff</Label><Input value={form.subject} onChange={(e) => u("subject", e.target.value)} placeholder="Anfrage Zusammenarbeit" /></div>
          </div>
          <div className="space-y-1">
            <Label>E-Mail-Text (Body)</Label>
            <Textarea value={form.raw_body} onChange={(e) => u("raw_body", e.target.value)} rows={10} placeholder="Vollständiger E-Mail-Text..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Erstellen…" : "Erstellen"}</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Review Sheet ── */
function ReviewSheet({ messageId, open, onOpenChange }: { messageId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: message } = useQuery({
    queryKey: ["intake-message", messageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("intake_messages").select("*").eq("id", messageId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!messageId && open,
  });

  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [createCompany, setCreateCompany] = useState(true);
  const [createContact, setCreateContact] = useState(true);
  const [createDeal, setCreateDeal] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [duplicateCompany, setDuplicateCompany] = useState<{ id: string; name: string } | null>(null);
  const [duplicateContact, setDuplicateContact] = useState<{ id: string; name: string } | null>(null);
  const [useExistingCompany, setUseExistingCompany] = useState(false);
  const [useExistingContact, setUseExistingContact] = useState(false);

  const { data: pipelines } = usePipelines();
  const { data: stages } = usePipelineStages(selectedPipelineId || undefined);

  // Initialize form — all fields empty, only deal_title = cleaned subject
  useEffect(() => {
    if (!message) return;
    setForm({
      ...emptyForm,
      deal_title: cleanSubject(message.subject),
    });
    setCreateCompany(true);
    setCreateContact(true);
    setCreateDeal(true);
    setDuplicateCompany(null);
    setDuplicateContact(null);
    setUseExistingCompany(false);
    setUseExistingContact(false);
    setSelectedPipelineId("");
    setSelectedStageId("");
  }, [message]);

  // Duplicate check company
  useEffect(() => {
    if (!open || !form.company_name) { setDuplicateCompany(null); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("companies").select("id, name").ilike("name", form.company_name).is("deleted_at", null).limit(1);
      setDuplicateCompany(data?.[0] ?? null);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.company_name, open]);

  // Duplicate check contact
  useEffect(() => {
    if (!open || !form.contact_email) { setDuplicateContact(null); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").ilike("email", form.contact_email).is("deleted_at", null).limit(1);
      setDuplicateContact(data?.[0] ? { id: data[0].id, name: `${data[0].first_name} ${data[0].last_name}` } : null);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.contact_email, open]);

  const u = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));

  // Approve & Import
  const approveMutation = useMutation({
    mutationFn: async () => {
      let companyId: string | null = null;
      let contactId: string | null = null;
      let dealId: string | null = null;
      const createdEntities: string[] = [];

      if (createCompany && form.company_name) {
        if (duplicateCompany && useExistingCompany) {
          companyId = duplicateCompany.id;
          createdEntities.push(`Company "${duplicateCompany.name}" (bestehend)`);
        } else {
          const { data, error } = await supabase.from("companies").insert({
            name: form.company_name, industry: form.company_industry || null,
            website: form.company_website || null, city: form.company_city || null,
            street: form.company_address || null,
            source: "email_intake", created_by_user_id: user?.id ?? null,
          }).select("id").single();
          if (error) throw error;
          companyId = data.id;
          createdEntities.push(`Company "${form.company_name}"`);
        }
      }

      if (createContact && form.contact_first_name && form.contact_last_name) {
        if (duplicateContact && useExistingContact) {
          contactId = duplicateContact.id;
          createdEntities.push(`Contact "${duplicateContact.name}" (bestehend)`);
        } else {
          const { data, error } = await supabase.from("contacts").insert({
            first_name: form.contact_first_name, last_name: form.contact_last_name,
            email: form.contact_email || null, phone: form.contact_phone || null,
            mobile: form.contact_mobile || null, job_title: form.contact_job_title || null,
            source: "email_intake", created_by_user_id: user?.id ?? null,
          }).select("id").single();
          if (error) throw error;
          contactId = data.id;
          createdEntities.push(`Contact "${form.contact_first_name} ${form.contact_last_name}"`);
        }
        if (companyId && contactId) {
          await supabase.from("company_contacts").insert({ company_id: companyId, contact_id: contactId, is_primary: true });
        }
      }

      if (createDeal && form.deal_title && selectedPipelineId && selectedStageId) {
        const { data, error } = await supabase.from("deals").insert({
          title: form.deal_title, value_amount: form.deal_value ? parseFloat(form.deal_value) : 0,
          company_id: companyId, primary_contact_id: contactId,
          pipeline_id: selectedPipelineId, pipeline_stage_id: selectedStageId,
          source: "email_intake", created_by_user_id: user?.id ?? null,
          description: form.notes || null,
        }).select("id").single();
        if (error) throw error;
        dealId = data.id;
        createdEntities.push(`Deal "${form.deal_title}"`);
      }

      const { error } = await supabase.from("intake_messages").update({
        status: "imported",
        reviewed_by_user_id: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        created_company_id: companyId,
        created_contact_id: contactId,
        created_deal_id: dealId,
        parsed_payload_json: form as unknown as Json,
      }).eq("id", messageId!);
      if (error) throw error;
      return createdEntities;
    },
    onSuccess: (entities) => {
      toast({ title: "Erfolgreich importiert", description: entities.length > 0 ? `${entities.join(", ")} angelegt.` : "Keine Datensätze angelegt." });
      qc.invalidateQueries({ queryKey: ["intake-messages"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("intake_messages").update({
        status: "rejected", reviewed_by_user_id: user?.id ?? null, reviewed_at: new Date().toISOString(),
      }).eq("id", messageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Nachricht abgelehnt" });
      qc.invalidateQueries({ queryKey: ["intake-messages"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const isReadOnly = message?.status === "imported" || message?.status === "rejected";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader><SheetTitle>Intake prüfen</SheetTitle></SheetHeader>
        {!message ? (
          <p className="mt-8 text-center text-muted-foreground">Laden…</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Original Email */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Original-E-Mail
              </h3>
              <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-foreground space-y-3">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div><span className="font-medium">Von:</span> {message.sender_email ?? "–"}</div>
                  <div><span className="font-medium">Betreff:</span> {message.subject ?? "–"}</div>
                  <div><span className="font-medium">Empfangen:</span> {message.received_at ? format(new Date(message.received_at), "dd.MM.yyyy HH:mm") : "–"}</div>
                </div>
                <div className="border-t border-border pt-3">
                  <MailBodyDisplay rawBody={message.raw_body} parsedPayload={message.parsed_payload_json as Record<string, unknown> | null} />
                </div>
              </div>

              {isReadOnly && (
                <div className={cn("rounded-lg px-4 py-3 text-sm font-medium text-center", message.status === "imported" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  {message.status === "imported" ? "Importiert" : "Abgelehnt"} am {message.reviewed_at ? format(new Date(message.reviewed_at), "dd.MM.yyyy HH:mm") : "–"}
                </div>
              )}

              {message.status === "imported" && (
                <div className="space-y-1 text-sm">
                  {message.created_company_id && <Link to={`/companies/${message.created_company_id}`} className="block text-primary hover:underline">→ Company öffnen</Link>}
                  {message.created_contact_id && <Link to={`/contacts/${message.created_contact_id}`} className="block text-primary hover:underline">→ Contact öffnen</Link>}
                  {message.created_deal_id && <Link to={`/deals/${message.created_deal_id}`} className="block text-primary hover:underline">→ Deal öffnen</Link>}
                </div>
              )}
            </div>

            {/* RIGHT: Manual Form */}
            <div className="space-y-5">
              {/* Duplicate warnings */}
              {duplicateCompany && createCompany && !isReadOnly && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div>Mögliche Dublette: <Link to={`/companies/${duplicateCompany.id}`} className="font-medium text-primary hover:underline">{duplicateCompany.name}</Link></div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={useExistingCompany} onCheckedChange={(c) => setUseExistingCompany(!!c)} />
                      <span className="text-xs">Bestehende verwenden</span>
                    </label>
                  </div>
                </div>
              )}
              {duplicateContact && createContact && !isReadOnly && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div>Mögliche Dublette: <Link to={`/contacts/${duplicateContact.id}`} className="font-medium text-primary hover:underline">{duplicateContact.name}</Link></div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={useExistingContact} onCheckedChange={(c) => setUseExistingContact(!!c)} />
                      <span className="text-xs">Bestehenden verwenden</span>
                    </label>
                  </div>
                </div>
              )}

              {/* COMPANY */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Building2 className="h-4 w-4 text-muted-foreground" /> Company</h3>
                  {!isReadOnly && <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"><Checkbox checked={createCompany} onCheckedChange={(c) => setCreateCompany(!!c)} />Anlegen</label>}
                </div>
                <div className={cn("grid grid-cols-2 gap-2.5", !createCompany && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Name</Label><Input value={form.company_name} onChange={(e) => u("company_name", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Website</Label><Input value={form.company_website} onChange={(e) => u("company_website", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Branche</Label><Input value={form.company_industry} onChange={(e) => u("company_industry", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Adresse</Label><Input value={form.company_address} onChange={(e) => u("company_address", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                </div>
              </div>

              {/* CONTACT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><User className="h-4 w-4 text-muted-foreground" /> Contact</h3>
                  {!isReadOnly && <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"><Checkbox checked={createContact} onCheckedChange={(c) => setCreateContact(!!c)} />Anlegen</label>}
                </div>
                <div className={cn("grid grid-cols-2 gap-2.5", !createContact && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1"><Label className="text-xs">Vorname</Label><Input value={form.contact_first_name} onChange={(e) => u("contact_first_name", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Nachname</Label><Input value={form.contact_last_name} onChange={(e) => u("contact_last_name", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">E-Mail</Label><Input value={form.contact_email} onChange={(e) => u("contact_email", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Telefon</Label><Input value={form.contact_phone} onChange={(e) => u("contact_phone", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Mobil</Label><Input value={form.contact_mobile} onChange={(e) => u("contact_mobile", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Position</Label><Input value={form.contact_job_title} onChange={(e) => u("contact_job_title", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                </div>
              </div>

              {/* DEAL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Handshake className="h-4 w-4 text-muted-foreground" /> Deal</h3>
                  {!isReadOnly && <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"><Checkbox checked={createDeal} onCheckedChange={(c) => setCreateDeal(!!c)} />Anlegen</label>}
                </div>
                <div className={cn("grid grid-cols-2 gap-2.5", !createDeal && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Titel</Label><Input value={form.deal_title} onChange={(e) => u("deal_title", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pipeline</Label>
                    {isReadOnly ? (
                      <Input value={pipelines?.find((p) => p.id === selectedPipelineId)?.name ?? ""} readOnly className="h-8 text-sm" />
                    ) : (
                      <Select value={selectedPipelineId} onValueChange={(v) => { setSelectedPipelineId(v); setSelectedStageId(""); }}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Pipeline wählen" /></SelectTrigger>
                        <SelectContent>{pipelines?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stage</Label>
                    {isReadOnly ? (
                      <Input value={stages?.find((s) => s.id === selectedStageId)?.name ?? ""} readOnly className="h-8 text-sm" />
                    ) : (
                      <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Stage wählen" /></SelectTrigger>
                        <SelectContent>{stages?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Wert (€)</Label><Input type="number" value={form.deal_value} onChange={(e) => u("deal_value", e.target.value)} readOnly={isReadOnly} className="h-8 text-sm" /></div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Notizen</Label><Textarea value={form.notes} onChange={(e) => u("notes", e.target.value)} rows={2} readOnly={isReadOnly} className="text-sm" /></div>
                </div>
              </div>

              {/* Actions */}
              {!isReadOnly && (
                <div className="flex gap-3 pt-3 border-t border-border">
                  <Button className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? "Importieren…" : "Genehmigen & Anlegen"}
                  </Button>
                  <Button variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                    <XCircle className="h-4 w-4" /> Ablehnen
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
