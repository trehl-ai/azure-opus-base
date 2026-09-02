import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useConflictCheck } from "@/hooks/useConflictCheck";
import { usePipelines } from "@/hooks/usePipelines";
import { ConflictWarning } from "@/components/shared/ConflictWarning";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { dezimalOderNull, ganzzahlOderNull } from "@/lib/zahlenfeld";

const ZEITRAUM_UNGUELTIG = "Das Ende darf nicht vor dem Beginn liegen.";
const CHECK_VERLETZT = "Das Ende des Leistungszeitraums darf nicht vor dem Beginn liegen.";
const KEINE_BERECHTIGUNG = "Keine Berechtigung zum Bearbeiten dieses Deals. Bitte Tomi ansprechen.";
const FIRMA_WEG = "Die gewaehlte Firma existiert nicht mehr. Bitte Auswahl aktualisieren.";

/**
 * Vergleich ueber die ISO-Zeichenkette, nicht ueber Date-Objekte: aus der DB
 * gelesene Daten entstehen als UTC-Mitternacht, aus dem Kalender gewaehlte als
 * lokale Mitternacht. Ein Date-Vergleich waere je nach Zeitzone um einen Tag daneben.
 */
function zeitraumUngueltig(von?: Date, bis?: Date) {
  if (!von || !bis) return false;
  return format(bis, "yyyy-MM-dd") < format(von, "yyyy-MM-dd");
}

interface DealData {
  id: string;
  title: string;
  company_id: string | null;
  primary_contact_id: string | null;
  /** aus dem Join in DealDetail; nur fuer die Anzeige des aktuellen Stands */
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string | null; last_name: string | null } | null;
  value_amount: number | null;
  currency: string | null;
  expected_close_date: string | null;
  service_start_date: string | null;
  service_end_date: string | null;
  probability_percent: number | null;
  priority: string | null;
  source: string | null;
  owner_user_id: string | null;
  description: string | null;
  pipeline_id: string;
  pipeline_stage_id: string;
}

interface Props {
  deal: DealData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDealSheet({ deal, open, onOpenChange }: Props) {
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { captureTimestamp, checkConflict, dismissConflict, hasConflict } = useConflictCheck("deals", deal.id);
  const { pipelines } = usePipelines();

  const [form, setForm] = useState({
    title: "", value_amount: "", currency: "EUR", probability_percent: "",
    priority: "medium", source: "", owner_user_id: "", description: "",
    pipeline_id: "", pipeline_stage_id: "",
  });
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>();
  const [serviceStartDate, setServiceStartDate] = useState<Date>();
  const [serviceEndDate, setServiceEndDate] = useState<Date>();
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  /** gesetzt = Rueckfrage offen, bevor der Hauptkontakt entfernt wird */
  const [kontaktWarnung, setKontaktWarnung] = useState<{ kontakt: string; firma: string } | null>(null);

  useEffect(() => {
    if (open && deal) {
      setForm({
        title: deal.title,
        value_amount: deal.value_amount?.toString() ?? "",
        currency: deal.currency ?? "EUR",
        probability_percent: deal.probability_percent?.toString() ?? "",
        priority: deal.priority ?? "medium",
        source: deal.source ?? "",
        owner_user_id: deal.owner_user_id ?? "",
        description: deal.description ?? "",
        pipeline_id: deal.pipeline_id,
        pipeline_stage_id: deal.pipeline_stage_id,
      });
      setExpectedCloseDate(deal.expected_close_date ? new Date(deal.expected_close_date) : undefined);
      setServiceStartDate(deal.service_start_date ? new Date(deal.service_start_date) : undefined);
      setServiceEndDate(deal.service_end_date ? new Date(deal.service_end_date) : undefined);
      setCompanyId(deal.company_id ?? "");
      setContactId(deal.primary_contact_id ?? "");
      setCompanySearch("");
      setContactSearch("");
      setKontaktWarnung(null);
      captureTimestamp();
    }
  }, [open, deal, captureTimestamp]);

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", form.pipeline_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pipeline_stages").select("*").eq("pipeline_id", form.pipeline_id).order("position");
      if (error) throw error;
      return data;
    },
    enabled: open && !!form.pipeline_id,
  });

  // When pipeline changes and stages load, ensure stage_id is valid
  useEffect(() => {
    if (!stages || stages.length === 0) return;
    const currentValid = stages.some(s => s.id === form.pipeline_stage_id);
    if (!currentValid) {
      const firstOpen = stages.find(s => s.stage_type === "open") ?? stages[0];
      setForm(prev => ({ ...prev, pipeline_stage_id: firstOpen.id }));
    }
  }, [stages, form.pipeline_stage_id]);

  // Firmensuche wie im CreateDealSheet, ABER mit deleted_at-Filter: seit #234
  // koennen Firmen archiviert werden, und eine archivierte Firma darf hier nicht
  // waehlbar sein — sonst haengt der Deal an einer Firma, die weggeraeumt wurde.
  const { data: companies } = useQuery({
    queryKey: ["companies-deal-edit-search", companySearch],
    queryFn: async () => {
      let q = supabase.from("companies").select("id, name").is("deleted_at", null).order("name").limit(20);
      if (companySearch.trim()) q = q.ilike("name", `%${companySearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Die aktuell gesetzte Firma steht nicht zwangslaeufig in den ersten 20
  // Suchtreffern. Ohne diese Abfrage bliebe das Feld beim Oeffnen leer und der
  // Nutzer haette den Eindruck, es sei nichts hinterlegt.
  const { data: aktuelleFirma } = useQuery({
    queryKey: ["company-current", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle();
      return data;
    },
    enabled: open && !!companyId,
  });

  // Kontakte auf die GEWAEHLTE Firma einschraenken — dasselbe Muster wie
  // CreateDealSheet:133, zusaetzlich ohne geloeschte Kontakte.
  const { data: contacts } = useQuery({
    queryKey: ["contacts-deal-edit-search", contactSearch, companyId],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, first_name, last_name").is("deleted_at", null).order("first_name").limit(20);
      if (contactSearch.trim()) q = q.or(`first_name.ilike.%${contactSearch.trim()}%,last_name.ilike.%${contactSearch.trim()}%`);
      if (companyId) {
        const { data: linked } = await supabase.from("company_contacts").select("contact_id").eq("company_id", companyId);
        const ids = linked?.map((l) => l.contact_id) ?? [];
        if (ids.length === 0) return [];
        q = q.in("id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: aktuellerKontakt } = useQuery({
    queryKey: ["contact-current", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("id", contactId).maybeSingle();
      return data;
    },
    enabled: open && !!contactId,
  });

  const handlePipelineChange = (newPipelineId: string) => {
    setForm(prev => ({ ...prev, pipeline_id: newPipelineId, pipeline_stage_id: "" }));
  };

  const u = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const zeitraumFehler = zeitraumUngueltig(serviceStartDate, serviceEndDate);

  const firmaGeaendert = companyId !== (deal.company_id ?? "");
  const kontaktGeaendert = contactId !== (deal.primary_contact_id ?? "");

  /**
   * Beim Firmenwechsel wird primary_contact_id NICHT automatisch mitgezogen.
   * Bleibt ein Kontakt stehen, der zur neuen Firma nicht gehoert, sieht das in
   * DealDetail aus wie eine gueltige Zuordnung — falsche Daten ohne sichtbares
   * Zeichen. Deshalb hier pruefen und im Zweifel nachfragen, statt stillschweigend
   * stehenzulassen (so wuerde es beim blossen Kopieren des CreateDealSheet enden).
   */
  const pruefeUndSpeichern = async () => {
    const konflikt = await checkConflict();
    if (konflikt) return;
    if (firmaGeaendert && companyId && contactId) {
      const { data } = await supabase
        .from("company_contacts")
        .select("contact_id")
        .eq("company_id", companyId)
        .eq("contact_id", contactId)
        .maybeSingle();
      if (!data) {
        const k = aktuellerKontakt ?? deal.contact;
        const f = companies?.find((c) => c.id === companyId) ?? aktuelleFirma;
        setKontaktWarnung({
          kontakt: `${k?.first_name ?? ""} ${k?.last_name ?? ""}`.trim() || "Der Ansprechpartner",
          firma: f?.name ?? "der gewaehlten Firma",
        });
        return;
      }
    }
    mutation.mutate({});
  };

  const mutation = useMutation({
    mutationFn: async ({ kontaktLeeren = false }: { kontaktLeeren?: boolean } = {}) => {
      if (zeitraumUngueltig(serviceStartDate, serviceEndDate)) throw new Error(ZEITRAUM_UNGUELTIG);

      // company_id und primary_contact_id werden NUR mitgesendet, wenn der Nutzer
      // sie wirklich angefasst hat. Ein nicht beruehrtes Feld darf die bestehende
      // Zuordnung niemals auf null setzen — das war bisher dadurch garantiert,
      // dass beide Felder gar nicht im Payload standen.
      const patch: Record<string, unknown> = {
        title: form.title.trim(),
        value_amount: dezimalOderNull(form.value_amount),
        currency: form.currency.trim() || null,
        expected_close_date: expectedCloseDate ? format(expectedCloseDate, "yyyy-MM-dd") : null,
        probability_percent: ganzzahlOderNull(form.probability_percent),
        priority: form.priority,
        source: form.source.trim() || null,
        owner_user_id: form.owner_user_id || null,
        description: form.description.trim() || null,
        pipeline_id: form.pipeline_id,
        pipeline_stage_id: form.pipeline_stage_id,
        service_start_date: serviceStartDate ? format(serviceStartDate, "yyyy-MM-dd") : null,
        service_end_date: serviceEndDate ? format(serviceEndDate, "yyyy-MM-dd") : null,
      };
      if (firmaGeaendert) patch.company_id = companyId || null;
      if (kontaktLeeren) patch.primary_contact_id = null;
      else if (kontaktGeaendert) patch.primary_contact_id = contactId || null;

      const { data, error } = await (supabase as any).from("deals").update(patch).eq("id", deal.id).select("id");
      // Ein UPDATE, das RLS nicht erfuellt, ist kein Fehler: PostgREST meldet 204
      // und null Zeilen. Ohne .select() saehe eine Ablehnung wie Erfolg aus.
      if (error) {
        if (error.code === "23514") throw new Error(CHECK_VERLETZT);
        if (error.code === "23503") throw new Error(FIRMA_WEG);
        if (error.code === "42501") throw new Error(KEINE_BERECHTIGUNG);
        throw error;
      }
      if (!data || data.length === 0) throw new Error(KEINE_BERECHTIGUNG);
    },
    onSuccess: () => {
      toast({ title: "Deal aktualisiert" });
      qc.invalidateQueries({ queryKey: ["deal", deal.id] });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Deal bearbeiten</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          {hasConflict && (
            <ConflictWarning
              onForceOverwrite={() => { dismissConflict(); mutation.mutate({}); }}
              onReload={() => { dismissConflict(); onOpenChange(false); qc.invalidateQueries({ queryKey: ["deal", deal.id] }); }}
            />
          )}
          <div className="space-y-1.5">
            <Label>Deal-Name</Label>
            <Input value={form.title} onChange={(e) => u("title", e.target.value)} />
          </div>
          {/* Firma — archivierte Firmen erscheinen hier nicht (deleted_at-Filter). */}
          <div className="space-y-1.5">
            <Label>Firma</Label>
            {companyId ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-body">{(companies?.find((c) => c.id === companyId) ?? aktuelleFirma)?.name ?? "…"}</span>
                <button type="button" onClick={() => setCompanyId("")} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Firma suchen…" className="pl-10" />
                </div>
                {companySearch.trim() && companies && companies.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {companies.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setCompanyId(c.id); setCompanySearch(""); }} className="flex w-full px-3 py-2 text-left text-body hover:bg-muted/50">{c.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hauptkontakt — auf die Kontakte der GEWAEHLTEN Firma eingeschraenkt. */}
          <div className="space-y-1.5">
            <Label>Hauptkontakt</Label>
            {contactId ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-body">{(() => { const k = contacts?.find((c) => c.id === contactId) ?? aktuellerKontakt; return `${k?.first_name ?? ""} ${k?.last_name ?? ""}`.trim() || "…"; })()}</span>
                <button type="button" onClick={() => setContactId("")} className="text-muted-foreground hover:text-foreground text-[12px]">Entfernen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder={companyId ? "Kontakt der Firma suchen…" : "Kontakt suchen…"} className="pl-10" />
                </div>
                {contactSearch.trim() && contacts && contacts.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {contacts.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setContactId(c.id); setContactSearch(""); }} className="flex w-full px-3 py-2 text-left text-body hover:bg-muted/50">{c.first_name} {c.last_name}</button>
                    ))}
                  </div>
                )}
                {contactSearch.trim() && contacts && contacts.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">Kein Kontakt dieser Firma gefunden.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Pipeline</Label>
              <Select value={form.pipeline_id} onValueChange={handlePipelineChange}>
                <SelectTrigger><SelectValue placeholder="Pipeline wählen" /></SelectTrigger>
                <SelectContent>{pipelines?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.pipeline_stage_id} onValueChange={(v) => u("pipeline_stage_id", v)}>
                <SelectTrigger><SelectValue placeholder={stages ? "Stage wählen" : "Laden…"} /></SelectTrigger>
                <SelectContent>{stages?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Deal-Wert</Label>
              <Input type="number" value={form.value_amount} onChange={(e) => u("value_amount", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Währung</Label>
              <Input value={form.currency} onChange={(e) => u("currency", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Abschlussdatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedCloseDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedCloseDate ? format(expectedCloseDate, "dd.MM.yyyy") : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={expectedCloseDate} onSelect={setExpectedCloseDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Wahrscheinlichkeit (%)</Label>
              <Input type="number" min="0" max="100" value={form.probability_percent} onChange={(e) => u("probability_percent", e.target.value)} />
            </div>
          </div>
          {/* Leistungszeitraum — massgeblich fuer die Jahreszuordnung des Umsatzes.
              Beide Felder optional; "bis" wird bewusst NICHT aus "von" vorbefuellt. */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Leistungszeitraum von</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !serviceStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {serviceStartDate ? format(serviceStartDate, "dd.MM.yyyy") : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={serviceStartDate} onSelect={setServiceStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {serviceStartDate && (
                <button type="button" onClick={() => setServiceStartDate(undefined)} className="text-[12px] text-muted-foreground hover:text-foreground">Leeren</button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Leistungszeitraum bis</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !serviceEndDate && "text-muted-foreground", zeitraumFehler && "border-destructive")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {serviceEndDate ? format(serviceEndDate, "dd.MM.yyyy") : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={serviceEndDate} onSelect={setServiceEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {serviceEndDate && (
                <button type="button" onClick={() => setServiceEndDate(undefined)} className="text-[12px] text-muted-foreground hover:text-foreground">Leeren</button>
              )}
              {zeitraumFehler && <p className="text-[12px] text-destructive">{ZEITRAUM_UNGUELTIG}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priorität</Label>
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
              <Label>Quelle</Label>
              <Input value={form.source} onChange={(e) => u("source", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={form.owner_user_id} onValueChange={(v) => u("owner_user_id", v)}>
              <SelectTrigger><SelectValue placeholder="Owner zuweisen" /></SelectTrigger>
              <SelectContent>{users?.map((usr) => <SelectItem key={usr.id} value={usr.id}>{`${usr.first_name || ''} ${usr.last_name || ''}`.trim() || usr.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => u("description", e.target.value)} rows={3} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={pruefeUndSpeichern} disabled={mutation.isPending || !form.pipeline_stage_id || zeitraumFehler}>{mutation.isPending ? "Speichern…" : "Speichern"}</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={!!kontaktWarnung} onOpenChange={(o) => { if (!o) setKontaktWarnung(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ansprechpartner wird entfernt</AlertDialogTitle>
            <AlertDialogDescription>
              {kontaktWarnung
                ? `Der Ansprechpartner ${kontaktWarnung.kontakt} ist bei ${kontaktWarnung.firma} nicht hinterlegt und wird vom Deal entfernt. Du kannst anschliessend im selben Formular einen neuen Ansprechpartner waehlen.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setKontaktWarnung(null); setContactId(""); mutation.mutate({ kontaktLeeren: true }); }}>
              Firma wechseln und entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}