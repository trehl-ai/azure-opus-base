import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Trash2, Download, ExternalLink,
  FileText, FileSpreadsheet, FileImage, File, Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "text/plain": "TXT",
};
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function fileIcon(type: string) {
  if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (type.includes("word") || type.includes("msword")) return <FileText className="h-4 w-4 text-blue-500" />;
  if (type.includes("excel") || type.includes("spreadsheet")) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (type.startsWith("image/")) return <FileImage className="h-4 w-4 text-purple-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
}

interface Props { taskId: string; }

export function TaskAttachments({ taskId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const uploadFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES[file.type]) {
      toast({ variant: "destructive", title: "Ungültiger Dateityp", description: `${file.type || "Unbekannt"} ist nicht erlaubt.` });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ variant: "destructive", title: "Datei zu groß", description: "Maximal 20 MB erlaubt." });
      return;
    }

    setUploading(true);
    setUploadProgress(30);

    const safeName = sanitizeFileName(file.name);
    const storagePath = `${taskId}/${Date.now()}_${safeName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("task-files")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { error: dbError } = await supabase.from("task_attachments" as any).insert({
        task_id: taskId,
        file_name: file.name,
        file_path: storagePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by_user_id: user?.id ?? null,
      });
      if (dbError) throw dbError;

      setUploadProgress(100);
      toast({ title: "Datei hochgeladen" });
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload fehlgeschlagen", description: err.message });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [taskId, user?.id, toast, qc]);

  const deleteMutation = useMutation({
    mutationFn: async (att: any) => {
      const { error: storageErr } = await supabase.storage.from("task-files").remove([att.file_path]);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase.from("task_attachments" as any).delete().eq("id", att.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => { toast({ title: "Datei gelöscht" }); qc.invalidateQueries({ queryKey: ["task-attachments", taskId] }); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const openFile = async (att: any) => {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(att.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const downloadFile = async (att: any) => {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(att.file_path, 3600, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [uploadFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(uploadFile);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Anhänge
        </h3>
        <Button variant="ghost" size="sm" className="gap-1 text-[12px]" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="h-3 w-3" /> Hochladen
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={handleFileInput} multiple />
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">Dateien hierher ziehen oder klicken</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">PDF, Word, Excel, Bilder · max. 20 MB</p>
      </div>

      {uploading && <Progress value={uploadProgress} className="h-1.5" />}

      {/* File list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Laden…</p>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 group">
              {fileIcon(att.file_type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ALLOWED_TYPES[att.file_type] ?? att.file_type} · {formatSize(att.file_size)} · {format(new Date(att.created_at), "dd.MM.yyyy")}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openFile(att)} title="Öffnen">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(att)} title="Herunterladen">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(att)} title="Löschen">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Anhänge.</p>
      )}
    </div>
  );
}
