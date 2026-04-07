import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, ArrowLeft, Building2, Users, Briefcase, ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type ExcelStep = "upload" | "preview" | "importing" | "result";

interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface ImportCounts {
  companies: { total: number; success: number; failed: number; duplicate: number };
  contacts: { total: number; success: number; failed: number; duplicate: number };
  deals: { total: number; success: number; failed: number; duplicate: number };
  roadshow: number;
}

const SHEET_PATTERNS = {
  companies: /1_companies|companies|firmen|unternehmen/i,
  contacts: /2_contacts|contacts|kontakte|ansprechpartner/i,
  deals: /3_deals|deals_roadshow|deals|roadshow/i,
};

const COMPANY_COL_MAP: Record<string, string> = {
  company_id: "_ext_id", name: "name", firmenname: "name", unternehmen: "name",
  street: "street", straße: "street", strasse: "street",
  postal_code: "postal_code", plz: "postal_code",
  city: "city", stadt: "city", ort: "city",
  region: "region",
  source: "source", quelle: "source",
  notes: "notes", notizen: "notes", bemerkungen: "notes",
  industry: "industry", branche: "industry",
  website: "website", webseite: "website",
  owner_user_id: "owner_user_id",
};

const CONTACT_COL_MAP: Record<string, string> = {
  contact_id: "_ext_id", company_id: "_company_ext_id", company_name: "_company_name",
  first_name: "first_name", vorname: "first_name",
  last_name: "last_name", nachname: "last_name",
  job_title: "job_title", position: "job_title", rolle: "job_title",
  email: "email", "e-mail": "email", mail: "email",
  phone: "phone", telefon: "phone", tel: "phone",
  source: "source", quelle: "source",
  mobile: "mobile", mobil: "mobile", handy: "mobile",
  owner_user_id: "owner_user_id",
};

const DEAL_COL_MAP: Record<string, string> = {
  deal_id: "_ext_id", company_id: "_company_ext_id", company_name: "_company_name",
  title: "title", titel: "title", name: "title",
  pipeline: "_pipeline_name", stage: "_stage_name",
  // Roadshow fields
  hort_ganztag: "hort_ganztag", hort: "hort_ganztag",
  schueler_2_3: "schueler_kl23_ausreichend", schueler_kl23: "schueler_kl23_ausreichend",
  schueler_kl23_ausreichend: "schueler_kl23_ausreichend",
  schueler_2_3_4: "schueler_kl234_ausreichend", schueler_kl234: "schueler_kl234_ausreichend",
  schueler_kl234_ausreichend: "schueler_kl234_ausreichend",
  turnhalle: "ausweichen_turnhalle", ausweichen_turnhalle: "ausweichen_turnhalle",
  platzbedarf: "platzbedarf_erfuellt", platzbedarf_erfuellt: "platzbedarf_erfuellt",
  untergrund: "untergrund",
  umzaeunung: "umzaeunung_aktionsflaeche", umzaeunung_aktionsflaeche: "umzaeunung_aktionsflaeche",
  baustelle: "baustelle_aktionszeitraum", baustelle_aktionszeitraum: "baustelle_aktionszeitraum",
  strom: "stromanschluss_230v", stromanschluss: "stromanschluss_230v", stromanschluss_230v: "stromanschluss_230v",
  zufahrt: "zufahrt_fahrzeuge", zufahrt_fahrzeuge: "zufahrt_fahrzeuge",
  intern_tempo: "intern_tempo_kommunikation", intern_tempo_kommunikation: "intern_tempo_kommunikation",
  intern_attraktivitaet: "intern_attraktivitaet_score", intern_attraktivitaet_score: "intern_attraktivitaet_score",
  intern_checkliste: "intern_checkliste_ausgefuellt", intern_checkliste_ausgefuellt: "intern_checkliste_ausgefuellt",
  region: "region",
  aufmerksam_geworden_durch: "aufmerksam_geworden_durch",
  potential_notizen: "potential_notizen",
  erstkontakt_datum: "erstkontakt_datum",
};

const ALLOWED_IMPORT_SOURCES = new Set([
  "manual",
  "csv_import",
  "excel_import",
  "email_intake",
  "referral",
  "website",
]);

const IMPORT_SOURCE_ALIASES: Record<string, string> = {
  csv: "csv_import",
  csvimport: "csv_import",
  excel: "excel_import",
  xlsx: "excel_import",
  excelimport: "excel_import",
  import: "excel_import",
  email: "email_intake",
  mail: "email_intake",
  intake: "email_intake",
  referral: "referral",
  empfehlung: "referral",
  website: "website",
  web: "website",
  manual: "manual",
  manuell: "manual",
};

function normalizeImportSource(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "excel_import";
  if (ALLOWED_IMPORT_SOURCES.has(normalized)) return normalized;

  const compact = normalized.replace(/[^a-z]/g, "");
  return IMPORT_SOURCE_ALIASES[compact] ?? "excel_import";
}

function mapRow(row: Record<string, string>, colMap: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [rawCol, val] of Object.entries(row)) {
    const norm = rawCol.toLowerCase().trim().replace(/[^a-zäöüß0-9_]/g, "");
    const target = colMap[norm];
    if (target && val?.trim()) mapped[target] = val.trim();
  }
  return mapped;
}

function detectSheets(wb: XLSX.WorkBook): { companies?: SheetData; contacts?: SheetData; deals?: SheetData } {
  const result: { companies?: SheetData; contacts?: SheetData; deals?: SheetData } = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    const data: SheetData = { name, headers, rows: json.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))) };

    if (SHEET_PATTERNS.companies.test(name)) result.companies = data;
    else if (SHEET_PATTERNS.contacts.test(name)) result.contacts = data;
    else if (SHEET_PATTERNS.deals.test(name)) result.deals = data;
  }
  return result;
}

interface Props {
  onClose: () => void;
}

export default function ExcelMultiSheetImport({ onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ExcelStep>("upload");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [sheets, setSheets] = useState<{ companies?: SheetData; contacts?: SheetData; deals?: SheetData }>({});
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [result, setResult] = useState<ImportCounts | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!/\.xlsx?$/i.test(file.name)) {
      toast({ variant: "destructive", title: "Nur Excel-Dateien (.xlsx) erlaubt" });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "array" });
      const detected = detectSheets(wb);
      if (!detected.companies && !detected.contacts && !detected.deals) {
        toast({ variant: "destructive", title: "Keine passenden Sheets erkannt", description: "Erwartet: 1_companies, 2_contacts, 3_deals_roadshow" });
        return;
      }
      setSheets(detected);
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const runImport = useCallback(async () => {
    if (!user?.id) return;
    setStep("importing");
    setProgressPercent(0);
    const counts: ImportCounts = {
      companies: { total: 0, success: 0, failed: 0, duplicate: 0 },
      contacts: { total: 0, success: 0, failed: 0, duplicate: 0 },
      deals: { total: 0, success: 0, failed: 0, duplicate: 0 },
      roadshow: 0,
    };
    const importErrors: string[] = [];
    // Maps: ext_id → supabase uuid
    const companyMap = new Map<string, string>();
    const companyNameMap = new Map<string, string>(); // lowercase name → id

    // Create import job
    const { data: job, error: jobErr } = await supabase.from("import_jobs").insert({
      import_type: "mixed",
      file_name: fileName,
      started_by_user_id: user.id,
      status: "processing",
      started_at: new Date().toISOString(),
      total_rows: (sheets.companies?.rows.length ?? 0) + (sheets.contacts?.rows.length ?? 0) + (sheets.deals?.rows.length ?? 0),
    }).select("id").single();
    if (jobErr) { toast({ variant: "destructive", title: "Import-Job konnte nicht erstellt werden" }); setStep("upload"); return; }
    const jobId = job.id;

    // Load existing data for dupe checks
    const { data: existingCompanies } = await supabase.from("companies").select("id, name").is("deleted_at", null);
    const existingCompanyNames = new Map((existingCompanies ?? []).map(c => [c.name.toLowerCase(), c.id]));
    const { data: existingContacts } = await supabase.from("contacts").select("id, email, first_name, last_name").is("deleted_at", null);
    const existingContactNames = new Map(
      (existingContacts ?? []).map(c => [`${c.first_name?.toLowerCase()}_${c.last_name?.toLowerCase()}`, c.id])
    );

    // Load pipelines & stages for deal matching
    const { data: pipelines } = await supabase.from("pipelines").select("id, name, is_default").eq("is_active", true);
    const { data: allStages } = await supabase.from("pipeline_stages").select("id, name, pipeline_id, position").order("position");
    const defaultPipeline = pipelines?.find(p => p.is_default) ?? pipelines?.[0];

    // ─── 1) COMPANIES ───
    if (sheets.companies) {
      setProgressLabel("Companies importieren…");
      const rows = sheets.companies.rows;
      counts.companies.total = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const mapped = mapRow(rows[i], COMPANY_COL_MAP);
        const extId = mapped._ext_id || "";
        if (!mapped.name) { counts.companies.failed++; importErrors.push(`Company Zeile ${i + 1}: Name fehlt`); continue; }

        const existingId = existingCompanyNames.get(mapped.name.toLowerCase());
        if (existingId) {
          counts.companies.duplicate++;
          companyMap.set(extId, existingId);
          companyNameMap.set(mapped.name.toLowerCase(), existingId);
          continue;
        }

        try {
          const { data, error } = await supabase.from("companies").insert({
            name: mapped.name,
            street: mapped.street || null,
            postal_code: mapped.postal_code || null,
            city: mapped.city || null,
            industry: mapped.industry || null,
            website: mapped.website || null,
            source: normalizeImportSource(mapped.source),
            notes: mapped.notes || null,
            created_by_user_id: user.id,
          }).select("id").single();
          if (error) throw error;
          companyMap.set(extId, data.id);
          companyNameMap.set(mapped.name.toLowerCase(), data.id);
          existingCompanyNames.set(mapped.name.toLowerCase(), data.id);
          counts.companies.success++;
        } catch (err: unknown) {
          counts.companies.failed++;
          importErrors.push(`Company "${mapped.name}": ${err instanceof Error ? err.message : "Fehler"}`);
        }
        setProgressPercent(Math.round(((i + 1) / rows.length) * 33));
      }
    }

    // ─── 2) CONTACTS ───
    if (sheets.contacts) {
      setProgressLabel("Contacts importieren…");
      const rows = sheets.contacts.rows;
      counts.contacts.total = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const mapped = mapRow(rows[i], CONTACT_COL_MAP);
        if (!mapped.first_name || !mapped.last_name) { counts.contacts.failed++; importErrors.push(`Contact Zeile ${i + 1}: Vor- oder Nachname fehlt`); continue; }

        const nameKey = `${mapped.first_name.toLowerCase()}_${mapped.last_name.toLowerCase()}`;
        if (existingContactNames.has(nameKey)) { counts.contacts.duplicate++; continue; }

        // Resolve company
        let companyId: string | null = null;
        if (mapped._company_ext_id) companyId = companyMap.get(mapped._company_ext_id) ?? null;
        if (!companyId && mapped._company_name) companyId = companyNameMap.get(mapped._company_name.toLowerCase()) ?? existingCompanyNames.get(mapped._company_name.toLowerCase()) ?? null;

        try {
          const { data, error } = await supabase.from("contacts").insert({
            first_name: mapped.first_name,
            last_name: mapped.last_name,
            email: mapped.email || null,
            phone: mapped.phone || null,
            mobile: mapped.mobile || null,
            job_title: mapped.job_title || null,
            source: normalizeImportSource(mapped.source),
            created_by_user_id: user.id,
          }).select("id").single();
          if (error) throw error;

          // Link to company
          if (companyId) {
            await supabase.from("company_contacts").insert({
              company_id: companyId,
              contact_id: data.id,
              is_primary: true,
            });
          }
          existingContactNames.set(nameKey, data.id);
          counts.contacts.success++;
        } catch (err: unknown) {
          counts.contacts.failed++;
          importErrors.push(`Contact "${mapped.first_name} ${mapped.last_name}": ${err instanceof Error ? err.message : "Fehler"}`);
        }
        setProgressPercent(33 + Math.round(((i + 1) / rows.length) * 33));
      }
    }

    // ─── 3) DEALS + ROADSHOW ───
    if (sheets.deals) {
      setProgressLabel("Deals & Roadshow importieren…");
      const rows = sheets.deals.rows;
      counts.deals.total = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const mapped = mapRow(rows[i], DEAL_COL_MAP);
        if (!mapped.title) { counts.deals.failed++; importErrors.push(`Deal Zeile ${i + 1}: Titel fehlt`); continue; }

        // Resolve company
        let companyId: string | null = null;
        if (mapped._company_ext_id) companyId = companyMap.get(mapped._company_ext_id) ?? null;
        if (!companyId && mapped._company_name) companyId = companyNameMap.get(mapped._company_name.toLowerCase()) ?? existingCompanyNames.get(mapped._company_name.toLowerCase()) ?? null;

        // Resolve pipeline & stage
        let pipelineId = defaultPipeline?.id;
        let stageId: string | undefined;
        if (mapped._pipeline_name && pipelines) {
          const found = pipelines.find(p => p.name.toLowerCase() === mapped._pipeline_name.toLowerCase());
          if (found) pipelineId = found.id;
        }
        if (pipelineId && allStages) {
          const pipeStages = allStages.filter(s => s.pipeline_id === pipelineId);
          if (mapped._stage_name) {
            const found = pipeStages.find(s => s.name.toLowerCase() === mapped._stage_name.toLowerCase());
            stageId = found?.id ?? pipeStages[0]?.id;
          } else {
            stageId = pipeStages[0]?.id;
          }
        }

        if (!pipelineId || !stageId) {
          counts.deals.failed++;
          importErrors.push(`Deal "${mapped.title}": Keine Pipeline/Stage gefunden`);
          continue;
        }

        try {
          // Resolve primary contact from company_contacts
          let primaryContactId: string | null = null;
          if (companyId) {
            const { data: cc } = await supabase
              .from("company_contacts")
              .select("contact_id")
              .eq("company_id", companyId)
              .eq("is_primary", true)
              .limit(1)
              .maybeSingle();
            if (cc) primaryContactId = cc.contact_id;
            if (!primaryContactId) {
              const { data: ccAny } = await supabase
                .from("company_contacts")
                .select("contact_id")
                .eq("company_id", companyId)
                .limit(1)
                .maybeSingle();
              if (ccAny) primaryContactId = ccAny.contact_id;
            }
          }

          const { data, error } = await supabase.from("deals").insert({
            title: mapped.title,
            company_id: companyId,
            primary_contact_id: primaryContactId,
            pipeline_id: pipelineId,
            pipeline_stage_id: stageId,
            source: "excel_import",
            created_by_user_id: user.id,
          }).select("id").single();
          if (error) throw error;

          // Insert roadshow details
          const roadshowFields: Record<string, unknown> = { deal_id: data.id };
          const rsKeys = [
            "hort_ganztag", "schueler_kl23_ausreichend", "schueler_kl234_ausreichend",
            "ausweichen_turnhalle", "platzbedarf_erfuellt", "untergrund",
            "umzaeunung_aktionsflaeche", "baustelle_aktionszeitraum", "stromanschluss_230v",
            "zufahrt_fahrzeuge", "intern_tempo_kommunikation", "intern_checkliste_ausgefuellt",
            "region", "aufmerksam_geworden_durch", "potential_notizen", "erstkontakt_datum",
          ];
          let hasRoadshowData = false;
          for (const key of rsKeys) {
            if (mapped[key]) { roadshowFields[key] = mapped[key]; hasRoadshowData = true; }
          }
          if (mapped.intern_attraktivitaet_score) {
            const score = parseInt(mapped.intern_attraktivitaet_score, 10);
            if (!isNaN(score)) { roadshowFields.intern_attraktivitaet_score = Math.min(10, Math.max(1, score)); hasRoadshowData = true; }
          }

          if (hasRoadshowData) {
            const { error: rsErr } = await supabase.from("deal_roadshow_details" as any).insert(roadshowFields);
            if (rsErr) importErrors.push(`Roadshow für "${mapped.title}": ${rsErr.message}`);
            else counts.roadshow++;
          }

          counts.deals.success++;
        } catch (err: unknown) {
          counts.deals.failed++;
          importErrors.push(`Deal "${mapped.title}": ${err instanceof Error ? err.message : "Fehler"}`);
        }
        setProgressPercent(66 + Math.round(((i + 1) / rows.length) * 34));
      }
    }

    // Finalize
    await supabase.from("import_jobs").update({
      status: "completed",
      success_rows: counts.companies.success + counts.contacts.success + counts.deals.success,
      failed_rows: counts.companies.failed + counts.contacts.failed + counts.deals.failed,
      total_rows: counts.companies.total + counts.contacts.total + counts.deals.total,
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);

    setResult(counts);
    setErrors(importErrors);
    setStep("result");
    qc.invalidateQueries({ queryKey: ["import-jobs"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["deals-board"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["roadshow-details"] });
  }, [user, sheets, fileName, toast, qc]);

  const sheetCount = [sheets.companies, sheets.contacts, sheets.deals].filter(Boolean).length;
  const totalRows = (sheets.companies?.rows.length ?? 0) + (sheets.contacts?.rows.length ?? 0) + (sheets.deals?.rows.length ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
        <h1 className="text-[28px] font-semibold text-foreground">Excel Multi-Sheet Import</h1>
      </div>

      <div className="flex gap-2">
        {(["upload", "preview", "importing", "result"] as ExcelStep[]).map((s, i) => (
          <div key={s} className={cn("flex-1 h-1.5 rounded-full", step === s ? "bg-primary" : i < ["upload", "preview", "importing", "result"].indexOf(step) ? "bg-primary/40" : "bg-muted")} />
        ))}
      </div>

      {/* Upload */}
      {step === "upload" && (
        <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-[15px] font-semibold text-foreground">Excel-Datei mit 3 Sheets hochladen</h2>
            <p className="text-sm text-muted-foreground">
              Erwartet: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">1_companies</code>,{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">2_contacts</code>,{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">3_deals_roadshow</code>
            </p>
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
                <p className="text-[12px] text-muted-foreground mt-1">{sheetCount} Sheets erkannt · {totalRows} Zeilen</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-foreground">Excel-Datei (.xlsx) hierher ziehen</p>
                <p className="text-[12px] text-muted-foreground mt-1">oder klicken zum Auswählen</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          {sheetCount > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => setStep("preview")} className="gap-1.5">Vorschau <ArrowRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {step === "preview" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="text-[15px] font-semibold text-foreground">Vorschau der erkannten Sheets</h2>

          {([
            { key: "companies" as const, label: "Companies", icon: Building2, color: "text-primary" },
            { key: "contacts" as const, label: "Contacts", icon: Users, color: "text-info" },
            { key: "deals" as const, label: "Deals + Roadshow", icon: Briefcase, color: "text-success" },
          ]).map(({ key, label, icon: Icon, color }) => {
            const sheet = sheets[key];
            if (!sheet) return (
              <div key={key} className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{label}: Sheet nicht gefunden</span>
              </div>
            );
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", color)} />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <Badge variant="secondary" className="text-[11px]">{sheet.rows.length} Zeilen</Badge>
                  <Badge variant="outline" className="text-[11px]">Sheet: {sheet.name}</Badge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border max-h-[180px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        {sheet.headers.slice(0, 8).map(h => (
                          <th key={h} className="px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                        {sheet.headers.length > 8 && <th className="px-3 py-1.5 text-[11px] text-muted-foreground">+{sheet.headers.length - 8}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {sheet.headers.slice(0, 8).map(h => (
                            <td key={h} className="px-3 py-1.5 text-foreground text-[12px] whitespace-nowrap max-w-[200px] truncate">{row[h] ?? ""}</td>
                          ))}
                          {sheet.headers.length > 8 && <td className="px-3 py-1.5 text-muted-foreground text-[11px]">…</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Import-Reihenfolge</span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              1. Companies erstellen → 2. Contacts erstellen & mit Companies verknüpfen → 3. Deals erstellen & Roadshow-Checkliste befüllen
            </p>
            <p className="text-[12px] text-muted-foreground">
              Duplikate werden per Name erkannt und übersprungen. Verknüpfung über <code className="bg-muted px-1 rounded">company_id</code> und <code className="bg-muted px-1 rounded">company_name</code>.
            </p>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
            <Button onClick={runImport} className="gap-1.5">Import starten ({totalRows} Zeilen) <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === "importing" && (
        <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-6">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <div>
            <p className="text-lg font-semibold text-foreground">{progressLabel || "Import läuft…"}</p>
            <p className="text-sm text-muted-foreground mt-1">{progressPercent}% abgeschlossen</p>
          </div>
          <Progress value={progressPercent} className="max-w-md mx-auto" />
        </div>
      )}

      {/* Result */}
      {step === "result" && result && (
        <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-3" />
            <h2 className="text-lg font-semibold text-foreground">Import abgeschlossen</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {([
              { label: "Companies", c: result.companies, icon: Building2 },
              { label: "Contacts", c: result.contacts, icon: Users },
              { label: "Deals", c: result.deals, icon: Briefcase },
              { label: "Roadshow", c: { success: result.roadshow, total: result.roadshow, failed: 0, duplicate: 0 }, icon: ClipboardCheck },
            ]).map(({ label, c, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="text-success font-medium">{c.success} ✓</span>
                  {c.duplicate > 0 && <span className="text-warning font-medium">{c.duplicate} Dupl.</span>}
                  {c.failed > 0 && <span className="text-destructive font-medium">{c.failed} ✗</span>}
                </div>
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setShowErrors(!showErrors)}>
                {showErrors ? "Fehlerbericht ausblenden" : `Fehlerbericht anzeigen (${errors.length})`}
              </Button>
            </div>
          )}

          {showErrors && errors.length > 0 && (
            <div className="overflow-y-auto max-h-[300px] rounded-lg border border-border p-3 space-y-1">
              {errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  <span className="text-destructive">{e}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" asChild><Link to="/deals">Zur Deals-Übersicht</Link></Button>
            <Button onClick={onClose}>Neuer Import</Button>
          </div>
        </div>
      )}
    </div>
  );
}
