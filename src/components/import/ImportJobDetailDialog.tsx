import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ImportJob {
  id: string;
  file_name: string;
  import_type: string;
  status: string;
  total_rows: number | null;
  success_rows: number | null;
  failed_rows: number | null;
  created_at: string;
  finished_at: string | null;
}

interface ImportRow {
  id: string;
  row_number: number;
  status: string;
  error_message: string | null;
  mapped_payload_json: Record<string, string> | null;
  created_entity_id: string | null;
  created_entity_type: string | null;
}

interface Props {
  job: ImportJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportJobDetailDialog({ job, open, onOpenChange }: Props) {
  const [tab, setTab] = useState("fehler");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["import-rows", job?.id],
    enabled: !!job?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_rows")
        .select("*")
        .eq("import_job_id", job!.id)
        .order("row_number", { ascending: true });
      if (error) throw error;
      return data as unknown as ImportRow[];
    },
  });

  if (!job) return null;

  const failedRows = rows?.filter((r) => r.status === "failed") ?? [];
  const successRows = rows?.filter((r) => r.status === "success") ?? [];
  const duplicateRows = rows?.filter((r) => r.status === "duplicate") ?? [];

  // Group errors by type
  const errorGroups: Record<string, ImportRow[]> = {};
  failedRows.forEach((r) => {
    const key = r.error_message || "Unbekannter Fehler";
    if (!errorGroups[key]) errorGroups[key] = [];
    errorGroups[key].push(r);
  });
  const sortedErrorGroups = Object.entries(errorGroups).sort((a, b) => b[1].length - a[1].length);

  const getRowLabel = (r: ImportRow) => {
    const p = r.mapped_payload_json;
    if (!p) return `Zeile ${r.row_number}`;
    if (p.name) return p.name;
    if (p.first_name || p.last_name) return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    if (p.email) return p.email;
    return `Zeile ${r.row_number}`;
  };

  const exportFailedCsv = () => {
    if (failedRows.length === 0) return;
    const allKeys = new Set<string>();
    failedRows.forEach((r) => {
      if (r.mapped_payload_json) Object.keys(r.mapped_payload_json).forEach((k) => allKeys.add(k));
    });
    const keys = ["row_number", ...Array.from(allKeys), "error_message"];
    const header = keys.join(";");
    const lines = failedRows.map((r) => {
      return keys.map((k) => {
        if (k === "row_number") return String(r.row_number);
        if (k === "error_message") return `"${(r.error_message ?? "").replace(/"/g, '""')}"`;
        const val = r.mapped_payload_json?.[k] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(";");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fehler_${job.file_name.replace(/\.\w+$/, "")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderRowTable = (items: ImportRow[], showError: boolean) => (
    <div className="overflow-x-auto max-h-[350px] overflow-y-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Datensatz</TableHead>
            {showError && <TableHead>Fehler</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={showError ? 3 : 2} className="text-center text-muted-foreground py-8">Keine Einträge</TableCell></TableRow>
          ) : items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-muted-foreground">{r.row_number}</TableCell>
              <TableCell className="text-foreground text-sm">{getRowLabel(r)}</TableCell>
              {showError && <TableCell className="text-destructive text-sm">{r.error_message}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import-Details: {job.file_name}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{job.total_rows ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Gesamt</p>
          </div>
          <div className="rounded-xl bg-success/10 p-3 text-center">
            <p className="text-xl font-bold text-success">{job.success_rows ?? 0}</p>
            <p className="text-[11px] text-success">Erfolgreich</p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-3 text-center">
            <p className="text-xl font-bold text-destructive">{failedRows.length}</p>
            <p className="text-[11px] text-destructive">Fehlerhaft</p>
          </div>
          <div className="rounded-xl bg-warning/10 p-3 text-center">
            <p className="text-xl font-bold text-warning">{duplicateRows.length}</p>
            <p className="text-[11px] text-warning">Duplikate</p>
          </div>
        </div>

        {/* Error summary by type */}
        {sortedErrorGroups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Fehler nach Typ</h3>
            <div className="space-y-1.5">
              {sortedErrorGroups.map(([msg, items]) => (
                <div key={msg} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-destructive font-medium">{msg}</span>
                    <span className="text-[12px] text-muted-foreground font-medium">{items.length}×</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 3).map((r) => (
                      <span key={r.id} className="text-[11px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                        {getRowLabel(r)}
                      </span>
                    ))}
                    {items.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">+{items.length - 3} weitere</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="fehler" className="gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Fehler ({failedRows.length})
              </TabsTrigger>
              <TabsTrigger value="erfolgreich" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Erfolgreich ({successRows.length})
              </TabsTrigger>
              <TabsTrigger value="duplikate" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Duplikate ({duplicateRows.length})
              </TabsTrigger>
            </TabsList>
            {failedRows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportFailedCsv} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Fehler als CSV
              </Button>
            )}
          </div>

          <TabsContent value="fehler">{renderRowTable(failedRows, true)}</TabsContent>
          <TabsContent value="erfolgreich">{renderRowTable(successRows, false)}</TabsContent>
          <TabsContent value="duplikate">{renderRowTable(duplicateRows, true)}</TabsContent>
        </Tabs>

        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Lade Import-Zeilen…</p>}
      </DialogContent>
    </Dialog>
  );
}
