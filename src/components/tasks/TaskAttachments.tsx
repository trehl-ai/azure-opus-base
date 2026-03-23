import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Upload, Trash2, Download, ExternalLink, Eye,
  FileText, FileSpreadsheet, FileImage, File, Paperclip, AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
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
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;

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
  const { data: users } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

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

  // Load thumbnails for image attachments
  const loadThumbnail = useCallback(async (att: any) => {
    if (!att.file_type?.startsWith("image/") || thumbnails[att.id]) return;
    const { data } = await supabase.storage.from("task-files").createSignedUrl(att.file_path, 3600);
    if (data?.signedUrl) {
      setThumbnails(prev => ({ ...prev, [att.id]: data.signedUrl }));
    }
  }, [thumbnails]);

  // Load thumbnails when attachments change
  if (attachments) {
    attachments.forEach(att => {
      if (att.file_type?.startsWith("image/") && !thumbnails[att.id]) {
        loadThumbnail(att);
      }
    });
  }

  const getUserName = (userId: string | null) => {
    if (!userId || !users) return null;
    const u = users.find((u: any) => u.id === userId);
    return u ? `${u.first_name} ${u.last_name}` : null;
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES[file.type]) {
      return `„${file.name}" hat einen ungültigen Dateityp (${file.type || "unbekannt"}). Erlaubt: PDF, Word, Excel, Bilder, TXT.`;
    }
    if (file.size > MAX_SIZE) {
      return `„${file.name}" ist zu groß (${formatSize(file.size)}). Maximal 20 MB erlaubt.`;
    }
    if (file.size === 0) {
      return `„${file.name}" ist leer.`;
    }
    return null;
  };

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length > MAX_FILES) {
      toast({ variant: "destructive", title: "Zu viele Dateien", description: `Maximal ${MAX_FILES} Dateien gleichzeitig.` });
      return;
    }

    const errors: string[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      const err = validateFile(file);
      if (err) { errors.push(err); } else { validFiles.push(file); }
    }

    if (errors.length > 0) {
      toast({ variant: "destructive", title: `${errors.length} Datei(en) ungültig`, description: errors.join("\n") });
    }

    if (validFiles.length === 0) return;

    const queue = validFiles.map(f => ({ name: f.name, progress: 0 }));
    setUploadQueue(queue);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${taskId}/${Date.now()}_${safeName}`;

      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: 30 } : q));

      try {
        const { error: uploadError } = await supabase.storage
          .from("task-files")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: 70 } : q));

        const { error: dbError } = await supabase.from("task_attachments" as any).insert({
          task_id: taskId,
          file_name: file.name,
          file_path: storagePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by_user_id: user?.id ?? null,
        });
        if (dbError) throw dbError;

        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: 100 } : q));
      } catch (err: any) {
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: 0, error: err.message } : q));
      }
    }

    qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    toast({ title: `${validFiles.length} Datei(en) hochgeladen` });
    setTimeout(() => setUploadQueue([]), 2000);
  }, [taskId, user?.id, toast, qc]);

  const deleteAttachment = async (att: any) => {
    try {
      await supabase.storage.from("task-files").remove([att.file_path]);
      const { error } = await supabase.from("task_attachments" as any).delete().eq("id", att.id);
      if (error) throw error;
      toast({ title: "Datei gelöscht" });
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    }
  };

  const openPreview = async (att: any) => {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(att.file_path, 3600);
    if (!data?.signedUrl) return;
    if (att.file_type?.startsWith("image/")) {
      setPreviewType("image");
      setPreviewUrl(data.signedUrl);
    } else if (att.file_type?.includes("pdf")) {
      setPreviewType("pdf");
      setPreviewUrl(data.signedUrl);
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const downloadFile = async (att: any) => {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(att.file_path, 3600, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }, [uploadFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const isUploading = uploadQueue.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Anhänge
          {attachments && attachments.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({attachments.length})</span>
          )}
        </h3>
        <Button variant="ghost" size="sm" className="gap-1 text-[12px]" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
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
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">PDF, Word, Excel, Bilder · max. 20 MB · bis zu {MAX_FILES} Dateien</p>
      </div>

      {/* Upload progress */}
      {uploadQueue.length > 0 && (
        <div className="space-y-1.5">
          {uploadQueue.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs">
                {item.error ? <AlertCircle className="h-3 w-3 text-destructive" /> : <Upload className="h-3 w-3 text-muted-foreground" />}
                <span className={cn("truncate flex-1", item.error && "text-destructive")}>{item.name}</span>
                {item.error ? (
                  <span className="text-destructive text-[11px]">Fehler</span>
                ) : item.progress === 100 ? (
                  <span className="text-green-600 text-[11px]">✓</span>
                ) : null}
              </div>
              {!item.error && item.progress < 100 && <Progress value={item.progress} className="h-1" />}
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Laden…</p>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((att: any) => {
            const uploaderName = getUserName(att.uploaded_by_user_id);
            const isImage = att.file_type?.startsWith("image/");
            const isPdf = att.file_type?.includes("pdf");
            return (
              <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 group">
                {/* Thumbnail or icon */}
                {isImage && thumbnails[att.id] ? (
                  <img
                    src={thumbnails[att.id]}
                    alt={att.file_name}
                    className="h-8 w-8 rounded object-cover cursor-pointer flex-shrink-0"
                    onClick={() => openPreview(att)}
                  />
                ) : (
                  fileIcon(att.file_type)
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ALLOWED_TYPES[att.file_type] ?? att.file_type} · {formatSize(att.file_size)}
                    {uploaderName && <> · {uploaderName}</>}
                    {" · "}
                    {formatDistanceToNow(new Date(att.created_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(isImage || isPdf) && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(att)} title="Vorschau">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(att)} title="Öffnen">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(att)} title="Herunterladen">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAttachment(att)} title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Anhänge.</p>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewType(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
          {previewType === "image" && previewUrl && (
            <img src={previewUrl} alt="Vorschau" className="w-full h-auto max-h-[85vh] object-contain" />
          )}
          {previewType === "pdf" && previewUrl && (
            <iframe src={previewUrl} className="w-full h-[80vh]" title="PDF Vorschau" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
