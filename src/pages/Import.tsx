import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight, ArrowLeft, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import ExcelMultiSheetImport from "@/components/import/ExcelMultiSheetImport";

type ImportType = "companies" | "contacts";
type WizardStep = "upload" | "mapping" | "preview" | "importing" | "result";
type ImportAuthDiagnosis =
  | "loading"
  | "missing_public_user"
  | "missing_context_auth_user"
  | "missing_live_auth_user"
  | "auth_user_mismatch"
  | "ready";

const companyFields = [
  { value: "name", label: "Firmenname", required: true },
  { value: "industry", label: "Branche" },
  { value: "website", label: "Website" },
  { value: "street", label: "Straße" },
  { value: "postal_code", label: "PLZ" },
  { value: "city", label: "Stadt" },
  { value: "country", label: "Land" },
  { value: "status", label: "Status" },
  { value: "source", label: "Quelle" },
  { value: "notes", label: "Notizen" },
];

const contactFields = [
  { value: "first_name", label: "Vorname", required: true },
  { value: "last_name", label: "Nachname", required: true },
  { value: "email", label: "E-Mail" },
  { value: "phone", label: "Telefon" },
  { value: "mobile", label: "Mobil" },
  { value: "job_title", label: "Position" },
  { value: "linkedin_url", label: "LinkedIn-URL" },
  { value: "status", label: "Status" },
  { value: "source", label: "Quelle" },
  { value: "notes", label: "Notizen" },
];

const autoMatchMap: Record<string, string> = {
  firmenname: "name", company: "name", firma: "name", unternehmen: "name", name: "name",
  branche: "industry", industry: "industry",
  website: "website", webseite: "website", url: "website",
  straße: "street", strasse: "street", street: "street", adresse: "street",
  plz: "postal_code", postleitzahl: "postal_code", postal_code: "postal_code", zip: "postal_code",
  stadt: "city", ort: "city", city: "city",
  land: "country", country: "country",
  status: "status",
  quelle: "source", source: "source",
  notizen: "notes", notes: "notes", bemerkungen: "notes",
  vorname: "first_name", first_name: "first_name", firstname: "first_name",
  nachname: "last_name", last_name: "last_name", lastname: "last_name",
  email: "email", "e-mail": "email", mail: "email",
  telefon: "phone", phone: "phone", tel: "phone",
  mobil: "mobile", mobile: "mobile", handy: "mobile",
  position: "job_title", job_title: "job_title", titel: "job_title", role: "job_title", rolle: "job_title",
  linkedin: "linkedin_url", linkedin_url: "linkedin_url",
};

const statusBadge: Record<string, string> = {
  uploaded: "bg-secondary text-secondary-foreground",
  mapping: "bg-info/10 text-info",
  processing: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
};

interface RowValidation {
  row: Record<string, string>;
  errors: string[];
  isDuplicate: boolean;
  selected: boolean;
}

interface ImportAuthState {
  ready: boolean;
  diagnosis: ImportAuthDiagnosis;
  title: string;
  description: string;
  liveAuthUser: { id: string; email: string | null } | null;
}

export default function Import() {
  const { user, authUser, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelMode, setExcelMode] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("upload");
  const [importType, setImportType] = useState<ImportType>("companies");
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; duplicate: number } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Past imports
  const { data: pastImports } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*, started_by:users!import_jobs_started_by_user_id_fkey(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const {
    data: importAuthState,
    isLoading: importAuthStateLoading,
    isFetching: importAuthStateFetching,
    refetch: refetchImportAuthState,
  } = useQuery<ImportAuthState>({
    queryKey: ["import-auth-context", user?.id ?? null, authUser?.id ?? null],
    enabled: !loading,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      const liveAuthUser = data.user ?? null;

      console.info("[Import] Auth-Kontextprüfung", {
        publicUserId: user?.id ?? null,
        publicUserEmail: user?.email ?? null,
        contextAuthUserId: authUser?.id ?? null,
        contextAuthUserEmail: authUser?.email ?? null,
        liveAuthUserId: liveAuthUser?.id ?? null,
        liveAuthUserEmail: liveAuthUser?.email ?? null,
        authError: error?.message ?? null,
      });

      if (error || !liveAuthUser) {
        return {
          ready: false,
          diagnosis: "missing_live_auth_user",
          title: "Anmeldung wird geprüft",
          description: "Deine aktive Sitzung ist noch nicht verfügbar. Bitte melde dich erneut an oder warte einen Moment.",
          liveAuthUser: null,
        } satisfies ImportAuthState;
      }

      if (!authUser) {
        return {
          ready: false,
          diagnosis: "missing_context_auth_user",
          title: "Sitzung wird synchronisiert",
          description: "Die Import-Seite wartet noch auf den vollständigen Auth-Kontext aus der App.",
          liveAuthUser: { id: liveAuthUser.id, email: liveAuthUser.email ?? null },
        } satisfies ImportAuthState;
      }

      if (authUser.id !== liveAuthUser.id) {
        return {
          ready: false,
          diagnosis: "auth_user_mismatch",
          title: "Anmeldung wird abgeglichen",
          description: "Die aktive Sitzung im Browser und der App-Kontext stimmen noch nicht überein. Bitte kurz warten oder die Seite neu laden.",
          liveAuthUser: { id: liveAuthUser.id, email: liveAuthUser.email ?? null },
        } satisfies ImportAuthState;
      }

      if (!user) {
        return {
          ready: false,
          diagnosis: "missing_public_user",
          title: "Benutzerprofil wird geladen",
          description: "Dein Anwendungsprofil ist noch nicht vollständig geladen. Der Import wird freigeschaltet, sobald es bereit ist.",
          liveAuthUser: { id: liveAuthUser.id, email: liveAuthUser.email ?? null },
        } satisfies ImportAuthState;
      }

      return {
        ready: true,
        diagnosis: "ready",
        title: "Import bereit",
        description: "Dein Benutzerkontext ist vollständig geladen und der CSV-Import kann gestartet werden.",
        liveAuthUser: { id: liveAuthUser.id, email: liveAuthUser.email ?? null },
      } satisfies ImportAuthState;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const authGate = useMemo<ImportAuthState>(() => {
    if (loading || importAuthStateLoading) {
      return {
        ready: false,
        diagnosis: "loading",
        title: "Authentifizierung wird geladen",
        description: "Die Import-Seite wartet, bis Sitzung und Benutzerprofil sicher geladen sind.",
        liveAuthUser: null,
      };
    }

    return importAuthState ?? {
      ready: false,
      diagnosis: "missing_live_auth_user",
      title: "Anmeldung wird geprüft",
      description: "Deine Sitzung konnte noch nicht verifiziert werden.",
      liveAuthUser: null,
    };
  }, [importAuthState, importAuthStateLoading, loading]);

  const importReady = authGate.ready;

  const targetFields = importType === "companies" ? companyFields : contactFields;
  const requiredFields = targetFields.filter((f) => f.required).map((f) => f.value);

  // File handling
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ variant: "destructive", title: "Nur CSV-Dateien erlaubt" });
      return;
    }
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);

        // Auto-match
        const autoMap: Record<string, string> = {};
        headers.forEach((h) => {
          const norm = h.toLowerCase().trim().replace(/[^a-zäöüß_]/g, "");
          const match = autoMatchMap[norm];
          if (match && targetFields.some((f) => f.value === match) && !Object.values(autoMap).includes(match)) {
            autoMap[h] = match;
          }
        });
        setMapping(autoMap);
      },
      error: () => toast({ variant: "destructive", title: "CSV konnte nicht gelesen werden" }),
    });
  }, [importType, targetFields, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // Step 1 → 2: create job
  const createJob = async () => {
    const { data: latestAuthState } = await refetchImportAuthState();
    const resolvedAuthState = latestAuthState ?? authGate;

    if (!resolvedAuthState?.ready || !user?.id) {
      toast({
        variant: "destructive",
        title: "Import noch nicht bereit",
        description: resolvedAuthState?.description ?? "Dein Benutzerkontext ist noch nicht vollständig geladen.",
      });
      return;
    }

    console.info("[Import] createJob freigegeben", {
      publicUserId: user.id,
      publicUserEmail: user.email,
      contextAuthUserId: authUser?.id ?? null,
      contextAuthUserEmail: authUser?.email ?? null,
      liveAuthUserId: resolvedAuthState.liveAuthUser?.id ?? null,
      liveAuthUserEmail: resolvedAuthState.liveAuthUser?.email ?? null,
    });

    const { data, error } = await supabase.from("import_jobs").insert({
      import_type: importType,
      file_name: fileName,
      started_by_user_id: user.id,
      status: "uploaded",
      total_rows: csvData.length,
    }).select("id").single();

    if (error) {
      console.error("[Import] import_jobs Insert fehlgeschlagen", {
        diagnosis: resolvedAuthState.diagnosis,
        publicUserId: user.id,
        publicUserEmail: user.email,
        contextAuthUserId: authUser?.id ?? null,
        contextAuthUserEmail: authUser?.email ?? null,
        liveAuthUserId: resolvedAuthState.liveAuthUser?.id ?? null,
        liveAuthUserEmail: resolvedAuthState.liveAuthUser?.email ?? null,
        errorMessage: error.message,
      });

      toast({
        variant: "destructive",
        title: "Import konnte nicht gestartet werden",
        description: "Bitte prüfe Anmeldung und Berechtigungen und versuche es erneut.",
      });
      return;
    }

    setJobId(data.id);
    setStep("mapping");
    await supabase.from("import_jobs").update({ status: "mapping" }).eq("id", data.id);
  };

  // Step 2 → 3: validate
  const validate = useCallback(async () => {
    const rows: RowValidation[] = [];
    // Load existing data for duplicate check
    let existingCompanies: { name: string; website: string | null }[] = [];
    let existingEmails: string[] = [];
    if (importType === "companies") {
      const { data } = await supabase.from("companies").select("name, website");
      existingCompanies = data ?? [];
    } else {
      const { data } = await supabase.from("contacts").select("email");
      existingEmails = (data ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean) as string[];
    }

    csvData.forEach((row) => {
      const mapped: Record<string, string> = {};
      Object.entries(mapping).forEach(([csvCol, field]) => { if (field) mapped[field] = row[csvCol]?.trim() ?? ""; });
      const errors: string[] = [];
      requiredFields.forEach((f) => { if (!mapped[f]) errors.push(`${targetFields.find((tf) => tf.value === f)?.label ?? f} ist leer`); });

      let isDuplicate = false;
      if (importType === "companies" && mapped.name) {
        isDuplicate = existingCompanies.some((c) => c.name.toLowerCase() === mapped.name.toLowerCase() && (!mapped.website || c.website?.toLowerCase() === mapped.website?.toLowerCase()));
      } else if (importType === "contacts" && mapped.email) {
        isDuplicate = existingEmails.includes(mapped.email.toLowerCase());
      }

      rows.push({ row: mapped, errors, isDuplicate, selected: errors.length === 0 });
    });
    setValidatedRows(rows);
    setStep("preview");
  }, [csvData, mapping, importType, requiredFields, targetFields]);

  // Step 3 → 4: import
  const runImport = useCallback(async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Import nicht möglich",
        description: "Dein Benutzerprofil ist nicht geladen. Bitte lade die Seite neu.",
      });
      return;
    }

    setStep("importing");
    setImportProgress(0);
    const selected = validatedRows.filter((r) => r.selected);
    let success = 0, failed = 0, duplicate = 0;

    await supabase.from("import_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", jobId!);

    for (let i = 0; i < selected.length; i++) {
      const v = selected[i];
      const mapped = { ...v.row };
      // Set defaults
      if (!mapped.source) mapped.source = "csv_import";
      if (importType === "companies" && !mapped.country) mapped.country = "Deutschland";

      try {
        if (v.isDuplicate) {
          await supabase.from("import_rows").insert({
            import_job_id: jobId!, row_number: i + 1,
            raw_payload_json: csvData[validatedRows.indexOf(v)] as unknown as Json,
            mapped_payload_json: mapped as unknown as Json,
            status: "duplicate", error_message: "Duplikat erkannt",
            created_entity_type: importType === "companies" ? "company" : "contact",
          });
          duplicate++;
        } else {
          let entityId: string | undefined;
          if (importType === "companies") {
            const { data, error } = await supabase.from("companies").insert({
              name: mapped.name, industry: mapped.industry || null, website: mapped.website || null,
              street: mapped.street || null, postal_code: mapped.postal_code || null,
              city: mapped.city || null, country: mapped.country || null,
              status: mapped.status || "prospect", source: mapped.source,
                notes: mapped.notes || null, created_by_user_id: user.id,
            }).select("id").single();
            if (error) throw error;
            entityId = data.id;
          } else {
            const { data, error } = await supabase.from("contacts").insert({
              first_name: mapped.first_name, last_name: mapped.last_name,
              email: mapped.email || null, phone: mapped.phone || null,
              mobile: mapped.mobile || null, job_title: mapped.job_title || null,
              linkedin_url: mapped.linkedin_url || null,
              status: mapped.status || "lead", source: mapped.source,
                notes: mapped.notes || null, created_by_user_id: user.id,
            }).select("id").single();
            if (error) throw error;
            entityId = data.id;
          }
          await supabase.from("import_rows").insert({
            import_job_id: jobId!, row_number: i + 1,
            mapped_payload_json: mapped as unknown as Json,
            status: "success",
            created_entity_type: importType === "companies" ? "company" : "contact",
            created_entity_id: entityId,
          });
          success++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        await supabase.from("import_rows").insert({
          import_job_id: jobId!, row_number: i + 1,
          mapped_payload_json: mapped as unknown as Json,
          status: "failed", error_message: msg,
          created_entity_type: importType === "companies" ? "company" : "contact",
        });
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / selected.length) * 100));
    }

    // Handle unselected as skipped
    const skipped = validatedRows.filter((r) => !r.selected);
    for (const v of skipped) {
      await supabase.from("import_rows").insert({
        import_job_id: jobId!, row_number: 0,
        mapped_payload_json: v.row as unknown as Json,
        status: "failed", error_message: v.errors.join(", ") || "Übersprungen",
      });
      failed++;
    }

    await supabase.from("import_jobs").update({
      status: "completed", success_rows: success, failed_rows: failed + duplicate,
      total_rows: validatedRows.length, finished_at: new Date().toISOString(),
    }).eq("id", jobId!);

    setImportResult({ success, failed, duplicate });
    setStep("result");
    qc.invalidateQueries({ queryKey: ["import-jobs"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }, [validatedRows, jobId, csvData, importType, user, qc]);

  const resetWizard = () => {
    setWizardOpen(false); setStep("upload"); setFileName(""); setCsvHeaders([]);
    setCsvData([]); setMapping({}); setJobId(null); setValidatedRows([]);
    setImportProgress(0); setImportResult(null); setShowErrors(false);
  };

  // ──── RENDER ────
  if (excelMode) {
    return <ExcelMultiSheetImport onClose={() => setExcelMode(false)} />;
  }

  if (wizardOpen) {
    if (!importReady) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={resetWizard}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
            <h1 className="text-[28px] font-semibold text-foreground">Neuer Import</h1>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <div className="space-y-2">
                <h2 className="text-[15px] font-semibold text-foreground">{authGate.title}</h2>
                <p className="text-sm text-muted-foreground">{authGate.description}</p>
                <p className="text-[12px] text-muted-foreground">
                  Freigabe erst, wenn App-Sitzung, Live-Session und Benutzerprofil vollständig synchronisiert sind.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={resetWizard}>Abbrechen</Button>
              <Button onClick={() => void refetchImportAuthState()} disabled={loading || importAuthStateFetching}>
                {loading || importAuthStateFetching ? "Prüft…" : "Erneut prüfen"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={resetWizard}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
          <h1 className="text-[28px] font-semibold text-foreground">Neuer Import</h1>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-2">
          {(["upload", "mapping", "preview", "importing", "result"] as WizardStep[]).map((s, i) => (
            <div key={s} className={cn("flex-1 h-1.5 rounded-full", step === s ? "bg-primary" : i < ["upload", "mapping", "preview", "importing", "result"].indexOf(step) ? "bg-primary/40" : "bg-muted")} />
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Import-Typ</label>
              <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="companies">Companies</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              {fileName ? (
                <div>
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-[12px] text-muted-foreground mt-1">{csvData.length} Zeilen erkannt</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground">CSV-Datei hierher ziehen</p>
                  <p className="text-[12px] text-muted-foreground mt-1">oder klicken zum Auswählen</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>

            {csvData.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={createJob} className="gap-1.5">Weiter <ArrowRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <h2 className="text-[15px] font-semibold text-foreground">Feld-Zuordnung</h2>
            <div className="space-y-3">
              {csvHeaders.map((h) => (
                <div key={h} className="flex items-center gap-4">
                  <span className="w-[200px] text-sm font-medium text-foreground truncate">{h}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={mapping[h] ?? "_skip"} onValueChange={(v) => setMapping((p) => ({ ...p, [h]: v === "_skip" ? "" : v }))}>
                    <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">– Überspringen –</SelectItem>
                      {targetFields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}{f.required ? " *" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {csvData.length > 0 && (
              <div>
                <h3 className="text-[13px] font-medium text-muted-foreground mb-2">Vorschau (erste 3 Zeilen)</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/30">
                      {Object.values(mapping).filter(Boolean).map((f) => <th key={f} className="text-left px-3 py-2 text-[12px] font-medium text-muted-foreground">{targetFields.find((tf) => tf.value === f)?.label ?? f}</th>)}
                    </tr></thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {Object.entries(mapping).filter(([, v]) => v).map(([csvCol, field]) => (
                            <td key={field} className="px-3 py-2 text-foreground">{row[csvCol] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
              <Button onClick={validate} disabled={!Object.values(mapping).some(Boolean)} className="gap-1.5">Validieren <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Validation */}
        {step === "preview" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Vorschau & Validierung</h2>
              <div className="flex gap-3 text-[12px] text-muted-foreground">
                <span className="text-success font-medium">{validatedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate).length} OK</span>
                <span className="text-warning font-medium">{validatedRows.filter((r) => r.isDuplicate).length} Dubletten</span>
                <span className="text-destructive font-medium">{validatedRows.filter((r) => r.errors.length > 0).length} Fehler</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border">
                  <th className="px-3 py-2 text-left w-10"><Checkbox checked={validatedRows.every((r) => r.selected)} onCheckedChange={(c) => setValidatedRows((p) => p.map((r) => ({ ...r, selected: !!c })))} /></th>
                  <th className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">#</th>
                  {Object.values(mapping).filter(Boolean).map((f) => <th key={f} className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">{targetFields.find((tf) => tf.value === f)?.label ?? f}</th>)}
                  <th className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Status</th>
                </tr></thead>
                <tbody>
                  {validatedRows.map((v, i) => (
                    <tr key={i} className={cn("border-b border-border last:border-0", v.errors.length > 0 && "bg-destructive/5", v.isDuplicate && v.errors.length === 0 && "bg-warning/5")}>
                      <td className="px-3 py-2"><Checkbox checked={v.selected} onCheckedChange={(c) => setValidatedRows((p) => p.map((r, j) => j === i ? { ...r, selected: !!c } : r))} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      {Object.values(mapping).filter(Boolean).map((f) => <td key={f} className="px-3 py-2 text-foreground">{v.row[f] ?? ""}</td>)}
                      <td className="px-3 py-2">
                        {v.errors.length > 0 ? <span className="text-[11px] text-destructive">{v.errors[0]}</span>
                          : v.isDuplicate ? <span className="text-[11px] text-warning">Dublette</span>
                          : <span className="text-[11px] text-success">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
              <Button onClick={runImport} disabled={!validatedRows.some((r) => r.selected)} className="gap-1.5">Import starten ({validatedRows.filter((r) => r.selected).length} Zeilen)</Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-6">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-primary animate-pulse" />
            <div>
              <p className="text-lg font-semibold text-foreground">Import läuft…</p>
              <p className="text-sm text-muted-foreground mt-1">{importProgress}% abgeschlossen</p>
            </div>
            <Progress value={importProgress} className="max-w-md mx-auto" />
          </div>
        )}

        {/* Step 5: Result */}
        {step === "result" && importResult && (
          <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Import abgeschlossen</h2>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="rounded-xl bg-success/10 p-4 text-center">
                <p className="text-2xl font-bold text-success">{importResult.success}</p>
                <p className="text-[12px] text-success">Erfolgreich</p>
              </div>
              <div className="rounded-xl bg-destructive/10 p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
                <p className="text-[12px] text-destructive">Fehlerhaft</p>
              </div>
              <div className="rounded-xl bg-warning/10 p-4 text-center">
                <p className="text-2xl font-bold text-warning">{importResult.duplicate}</p>
                <p className="text-[12px] text-warning">Dubletten</p>
              </div>
            </div>

            {importResult.failed > 0 && (
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={() => setShowErrors(!showErrors)}>
                  {showErrors ? "Fehlerbericht ausblenden" : "Fehlerbericht anzeigen"}
                </Button>
              </div>
            )}

            {showErrors && (
              <div className="overflow-x-auto rounded-lg border border-border max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card"><tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Daten</th>
                    <th className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Fehler</th>
                  </tr></thead>
                  <tbody>
                    {validatedRows.filter((r) => r.errors.length > 0 || r.isDuplicate).map((v, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-foreground text-[12px]">{JSON.stringify(v.row).slice(0, 80)}…</td>
                        <td className="px-3 py-2 text-destructive text-[12px]">{v.errors.length > 0 ? v.errors.join(", ") : "Dublette"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button variant="outline" asChild>
                <Link to={importType === "companies" ? "/companies" : "/contacts"}>Zur {importType === "companies" ? "Companies" : "Contacts"}-Liste</Link>
              </Button>
              <Button onClick={resetWizard}>Neuer Import</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──── Import Center ────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold text-foreground">CSV Import</h1>
        <Button onClick={() => setWizardOpen(true)} className="gap-1.5" disabled={!importReady}><Plus className="h-4 w-4" /> Neuer Import</Button>
      </div>

      {!importReady && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{authGate.title}</p>
              <p className="text-sm text-muted-foreground">{authGate.description}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dateiname</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gesamt</TableHead>
              <TableHead>Erfolgreich</TableHead>
              <TableHead>Fehlerhaft</TableHead>
              <TableHead>Datum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!pastImports || pastImports.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Noch keine Imports durchgeführt.</TableCell></TableRow>
            ) : pastImports.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.file_name}</TableCell>
                <TableCell className="capitalize">{job.import_type}</TableCell>
                <TableCell><span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", statusBadge[job.status])}>{job.status}</span></TableCell>
                <TableCell>{job.total_rows ?? 0}</TableCell>
                <TableCell className="text-success">{job.success_rows ?? 0}</TableCell>
                <TableCell className="text-destructive">{job.failed_rows ?? 0}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(job.created_at), "dd.MM.yyyy HH:mm")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
