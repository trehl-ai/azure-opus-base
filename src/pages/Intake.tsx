import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertTriangle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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

interface ParsedPayload {
  company_name?: string; company_industry?: string; company_website?: string; company_city?: string;
  contact_first_name?: string; contact_last_name?: string; contact_email?: string; contact_phone?: string; contact_job_title?: string;
  deal_title?: string; deal_value?: string; notes?: string;
}

export default function Intake() {
  const { user } = useAuth();
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

/* ── Simulate Dialog ── */
function SimulateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sender_email: "", subject: "", raw_body: "",
    company_name: "", contact_first_name: "", contact_last_name: "",
    contact_email: "", contact_phone: "", deal_title: "", deal_value: "", notes: "",
  });
  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed: ParsedPayload = {
        company_name: form.company_name || undefined,
        contact_first_name: form.contact_first_name || undefined,
        contact_last_name: form.contact_last_name || undefined,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
        deal_title: form.deal_title || undefined,
        deal_value: form.deal_value || undefined,
        notes: form.notes || undefined,
      };
      const { error } = await supabase.from("intake_messages").insert({
        sender_email: form.sender_email || null,
        subject: form.subject || null,
        raw_body: form.raw_body || null,
        parsed_payload_json: parsed as unknown as Json,
        status: "review_required",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Intake-Nachricht erstellt" });
      qc.invalidateQueries({ queryKey: ["intake-messages"] });
      setForm({ sender_email: "", subject: "", raw_body: "", company_name: "", contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "", deal_title: "", deal_value: "", notes: "" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Intake simulieren</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold text-muted-foreground">E-Mail-Daten</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Absender-E-Mail</Label><Input value={form.sender_email} onChange={(e) => u("sender_email", e.target.value)} /></div>
            <div className="space-y-1"><Label>Betreff</Label><Input value={form.subject} onChange={(e) => u("subject", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>E-Mail-Text</Label><Textarea value={form.raw_body} onChange={(e) => u("raw_body", e.target.value)} rows={3} /></div>

          <h3 className="text-[13px] font-semibold text-muted-foreground pt-2">Geparste Felder</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Firmenname</Label><Input value={form.company_name} onChange={(e) => u("company_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Vorname</Label><Input value={form.contact_first_name} onChange={(e) => u("contact_first_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Nachname</Label><Input value={form.contact_last_name} onChange={(e) => u("contact_last_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Kontakt-E-Mail</Label><Input value={form.contact_email} onChange={(e) => u("contact_email", e.target.value)} /></div>
            <div className="space-y-1"><Label>Telefon</Label><Input value={form.contact_phone} onChange={(e) => u("contact_phone", e.target.value)} /></div>
            <div className="space-y-1"><Label>Deal-Titel</Label><Input value={form.deal_title} onChange={(e) => u("deal_title", e.target.value)} /></div>
            <div className="space-y-1"><Label>Deal-Wert</Label><Input value={form.deal_value} onChange={(e) => u("deal_value", e.target.value)} /></div>
            <div className="space-y-1"><Label>Notizen</Label><Input value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
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

  const parsed = (message?.parsed_payload_json ?? {}) as ParsedPayload;

  const [form, setForm] = useState<ParsedPayload>({});
  const [rejectReason, setRejectReason] = useState("");
  const [duplicateCompany, setDuplicateCompany] = useState<{ id: string; name: string } | null>(null);
  const [duplicateContact, setDuplicateContact] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (parsed && message) {
      setForm({
        company_name: parsed.company_name ?? "",
        company_industry: parsed.company_industry ?? "",
        company_website: parsed.company_website ?? "",
        company_city: parsed.company_city ?? "",
        contact_first_name: parsed.contact_first_name ?? "",
        contact_last_name: parsed.contact_last_name ?? "",
        contact_email: parsed.contact_email ?? "",
        contact_phone: parsed.contact_phone ?? "",
        contact_job_title: parsed.contact_job_title ?? "",
        deal_title: parsed.deal_title ?? "",
        deal_value: parsed.deal_value ?? "",
        notes: parsed.notes ?? "",
      });
      setDuplicateCompany(null);
      setDuplicateContact(null);
      setRejectReason("");
    }
  }, [message]);

  // Duplicate check
  useEffect(() => {
    if (!open || !form.company_name) return;
    (async () => {
      const { data } = await supabase.from("companies").select("id, name").ilike("name", form.company_name!).limit(1);
      setDuplicateCompany(data?.[0] ?? null);
    })();
  }, [form.company_name, open]);

  useEffect(() => {
    if (!open || !form.contact_email) return;
    (async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").ilike("email", form.contact_email!).limit(1);
      setDuplicateContact(data?.[0] ? { id: data[0].id, name: `${data[0].first_name} ${data[0].last_name}` } : null);
    })();
  }, [form.contact_email, open]);

  const u = (f: keyof ParsedPayload, v: string) => setForm((p) => ({ ...p, [f]: v }));

  // Approve & Import
  const approveMutation = useMutation({
    mutationFn: async () => {
      let companyId: string | null = null;
      let contactId: string | null = null;
      let dealId: string | null = null;

      // Create company if name provided and not duplicate
      if (form.company_name && !duplicateCompany) {
        const { data, error } = await supabase.from("companies").insert({
          name: form.company_name, industry: form.company_industry || null,
          website: form.company_website || null, city: form.company_city || null,
          source: "email_intake", created_by_user_id: user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        companyId = data.id;
      } else if (duplicateCompany) {
        companyId = duplicateCompany.id;
      }

      // Create contact
      if (form.contact_first_name && form.contact_last_name) {
        if (duplicateContact) {
          contactId = duplicateContact.id;
        } else {
          const { data, error } = await supabase.from("contacts").insert({
            first_name: form.contact_first_name, last_name: form.contact_last_name,
            email: form.contact_email || null, phone: form.contact_phone || null,
            job_title: form.contact_job_title || null,
            source: "email_intake", created_by_user_id: user?.id ?? null,
          }).select("id").single();
          if (error) throw error;
          contactId = data.id;
        }
      }

      // Link contact to company
      if (companyId && contactId) {
        await supabase.from("company_contacts").insert({
          company_id: companyId, contact_id: contactId, is_primary: true,
        });
      }

      // Create deal if title provided
      if (form.deal_title) {
        // Get default pipeline + first stage
        const { data: pipeline } = await supabase.from("pipelines").select("id").eq("is_default", true).single();
        if (pipeline) {
          const { data: stage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipeline.id).order("position").limit(1).single();
          if (stage) {
            const { data, error } = await supabase.from("deals").insert({
              title: form.deal_title,
              value_amount: form.deal_value ? parseFloat(form.deal_value) : 0,
              company_id: companyId, primary_contact_id: contactId,
              pipeline_id: pipeline.id, pipeline_stage_id: stage.id,
              source: "email_intake", created_by_user_id: user?.id ?? null,
              description: form.notes || null,
            }).select("id").single();
            if (error) throw error;
            dealId = data.id;
          }
        }
      }

      // Update intake message
      const { error } = await supabase.from("intake_messages").update({
        status: "imported",
        reviewed_by_user_id: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        created_company_id: companyId,
        created_contact_id: contactId,
        created_deal_id: dealId,
      }).eq("id", messageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Datensätze erfolgreich importiert" });
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
        status: "rejected",
        reviewed_by_user_id: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
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
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>Intake prüfen</SheetTitle></SheetHeader>
        {!message ? (
          <p className="mt-8 text-center text-muted-foreground">Laden…</p>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Duplicate warnings */}
            {duplicateCompany && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>Mögliche Firmendublette: <Link to={`/companies/${duplicateCompany.id}`} className="font-medium text-primary hover:underline">{duplicateCompany.name}</Link></div>
              </div>
            )}
            {duplicateContact && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>Mögliche Kontaktdublette: <Link to={`/contacts/${duplicateContact.id}`} className="font-medium text-primary hover:underline">{duplicateContact.name}</Link></div>
              </div>
            )}

            {/* Raw email */}
            <div>
              <h3 className="text-[13px] font-semibold text-muted-foreground mb-2">Original-E-Mail</h3>
              <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                <div className="text-[12px] text-muted-foreground mb-2">
                  <span className="font-medium">Von:</span> {message.sender_email ?? "–"}<br />
                  <span className="font-medium">Betreff:</span> {message.subject ?? "–"}
                </div>
                {message.raw_body ?? "Kein Text."}
              </div>
            </div>

            {/* Parsed form */}
            <div>
              <h3 className="text-[13px] font-semibold text-muted-foreground mb-2">Firma</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input value={form.company_name ?? ""} onChange={(e) => u("company_name", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>Branche</Label><Input value={form.company_industry ?? ""} onChange={(e) => u("company_industry", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>Website</Label><Input value={form.company_website ?? ""} onChange={(e) => u("company_website", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>Stadt</Label><Input value={form.company_city ?? ""} onChange={(e) => u("company_city", e.target.value)} readOnly={isReadOnly} /></div>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-semibold text-muted-foreground mb-2">Kontakt</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Vorname</Label><Input value={form.contact_first_name ?? ""} onChange={(e) => u("contact_first_name", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>Nachname</Label><Input value={form.contact_last_name ?? ""} onChange={(e) => u("contact_last_name", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>E-Mail</Label><Input value={form.contact_email ?? ""} onChange={(e) => u("contact_email", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>Telefon</Label><Input value={form.contact_phone ?? ""} onChange={(e) => u("contact_phone", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1 col-span-2"><Label>Position</Label><Input value={form.contact_job_title ?? ""} onChange={(e) => u("contact_job_title", e.target.value)} readOnly={isReadOnly} /></div>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-semibold text-muted-foreground mb-2">Deal</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Titel</Label><Input value={form.deal_title ?? ""} onChange={(e) => u("deal_title", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1"><Label>Wert (€)</Label><Input type="number" value={form.deal_value ?? ""} onChange={(e) => u("deal_value", e.target.value)} readOnly={isReadOnly} /></div>
                <div className="space-y-1 col-span-2"><Label>Notizen</Label><Textarea value={form.notes ?? ""} onChange={(e) => u("notes", e.target.value)} rows={2} readOnly={isReadOnly} /></div>
              </div>
            </div>

            {/* Actions */}
            {!isReadOnly && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <Button className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? "Importieren…" : "Genehmigen & Importieren"}
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                    <XCircle className="h-4 w-4" /> Ablehnen
                  </Button>
                </div>
              </div>
            )}

            {isReadOnly && (
              <div className={cn("rounded-lg px-4 py-3 text-sm font-medium text-center", message.status === "imported" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                {message.status === "imported" ? "Importiert" : "Abgelehnt"} am {message.reviewed_at ? format(new Date(message.reviewed_at), "dd.MM.yyyy HH:mm") : "–"}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
