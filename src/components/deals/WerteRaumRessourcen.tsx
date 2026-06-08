import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseEIC } from "@/lib/supabaseEIC";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Rocket, FileText, File as FileIcon, BarChart3, Pencil, Trash2, Plus, Upload, Loader2 } from "lucide-react";
import { cn, getValidUrl, sanitizeStorageKey } from "@/lib/utils";

// All DB + storage operations go through supabaseEIC (EIC project ttgvhqygmgtnjgwunuwz).
const STORAGE_BUCKET = "project-files";
const STORAGE_PREFIX = "werteraum";
const SIGNED_URL_TTL = 3600;

interface Resource {
  id: string;
  type: string;
  name: string;
  url: string | null;
  storage_path: string | null;
  position: number | null;
}

const typeConfig: Record<string, { icon: typeof Globe; label: string }> = {
  website: { icon: Globe, label: "Website" },
  landingpage: { icon: Rocket, label: "Landingpage" },
  document: { icon: FileText, label: "Dokument" },
  flyer: { icon: FileIcon, label: "Flyer" },
  presentation: { icon: BarChart3, label: "Präsentation" },
};

const viewerUrl = (signedUrl: string) =>
  `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=false`;

export function WerteRaumRessourcen({ className }: { className?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite } = usePermission();
  const canEdit = canWrite("deals");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [form, setForm] = useState({ type: "website", name: "", url: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: resources } = useQuery<Resource[]>({
    queryKey: ["werteraum-resources"],
    queryFn: async () => {
      const { data, error } = await (supabaseEIC as any).from("werteraum_resources")
        .select("*")
        .order("position");
      if (error) throw error;
      return (data ?? []) as Resource[];
    },
  });

  const nextPosition = (resources?.reduce((m, r) => Math.max(m, r.position ?? 0), 0) ?? 0) + 1;

  // Uploads the selected file to project-files/werteraum/<sanitized-name>, returns its
  // storage_path. file.name is sanitized because Supabase Storage rejects Umlauts /
  // non-ASCII / spaces with "Invalid key". The user-visible Resource.name keeps the
  // original input (set separately in the form), so display stays unchanged.
  const uploadFile = async (file: File): Promise<string> => {
    const safeName = sanitizeStorageKey(file.name);
    const path = `${STORAGE_PREFIX}/${safeName}`;
    const { error } = await supabaseEIC.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name ist Pflicht");
      let storage_path: string | null = editResource?.storage_path ?? null;
      let url: string | null = form.url.trim() || null;
      if (selectedFile) {
        storage_path = await uploadFile(selectedFile);
        url = null; // a stored file supersedes a URL
      }
      if (editResource) {
        const { error } = await (supabaseEIC as any).from("werteraum_resources")
          .update({ type: form.type, name: form.name.trim(), url, storage_path })
          .eq("id", editResource.id);
        if (error) throw error;
      } else {
        const { error } = await (supabaseEIC as any).from("werteraum_resources")
          .insert({ type: form.type, name: form.name.trim(), url, storage_path, position: nextPosition });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editResource ? "Aktualisiert" : "Ressource hinzugefügt" });
      resetDialog();
      qc.invalidateQueries({ queryKey: ["werteraum-resources"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: Resource) => {
      // Deletes only the DB row (not the storage file — files may be shared/seeded).
      const { error } = await (supabaseEIC as any).from("werteraum_resources").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Ressource gelöscht" });
      qc.invalidateQueries({ queryKey: ["werteraum-resources"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const openResource = async (r: Resource) => {
    if (r.storage_path) {
      const { data, error } = await supabaseEIC.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(r.storage_path, SIGNED_URL_TTL);
      if (error || !data?.signedUrl) {
        toast({ variant: "destructive", title: "Dokument konnte nicht geladen werden" });
        return;
      }
      const lower = r.storage_path.toLowerCase();
      const isDoc = lower.endsWith(".docx") || lower.endsWith(".doc");
      window.open(isDoc ? viewerUrl(data.signedUrl) : data.signedUrl, "_blank", "noopener,noreferrer");
    } else if (r.url) {
      window.open(getValidUrl(r.url), "_blank", "noopener,noreferrer");
    }
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditResource(null);
    setForm({ type: "website", name: "", url: "" });
    setSelectedFile(null);
  };

  const openAdd = () => {
    setEditResource(null);
    setForm({ type: "website", name: "", url: "" });
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const openEdit = (r: Resource) => {
    setEditResource(r);
    setForm({ type: r.type, name: r.name, url: r.url ?? "" });
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const confirmDelete = (r: Resource) => {
    if (window.confirm(`„${r.name}" wirklich löschen?`)) deleteMutation.mutate(r);
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card/50 px-6 py-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-2 gap-2">
          {resources?.map((r) => {
            const Icon = typeConfig[r.type]?.icon ?? Globe;
            return (
              <div
                key={r.id}
                className="group relative flex w-[120px] items-center rounded-md border border-border bg-background px-2 py-1.5"
              >
                <button
                  onClick={() => openResource(r)}
                  title={r.name}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{r.name}</span>
                </button>
                {canEdit && (
                  <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded bg-background pl-1 group-hover:flex">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Bearbeiten"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => confirmDelete(r)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Löschen"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={openAdd}>
            <Plus className="mr-1 h-3 w-3" /> Hinzufügen
          </Button>
        )}
        {resources && resources.length === 0 && !canEdit && (
          <p className="text-[11px] text-muted-foreground">Noch keine Ressourcen.</p>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editResource ? "Ressource bearbeiten" : "Ressource hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([type, cfg]) => (
                    <SelectItem key={type} value={type}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="z.B. Webseite" />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://…" disabled={!!selectedFile} />
            </div>
            <div className="space-y-1.5">
              <Label>oder Datei hochladen</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Datei wählen
                </Button>
                {selectedFile && <span className="text-sm text-muted-foreground truncate">{selectedFile.name}</span>}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg"
                  onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); e.target.value = ""; }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Abbrechen</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name.trim()}
            >
              {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Speichern…</> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
