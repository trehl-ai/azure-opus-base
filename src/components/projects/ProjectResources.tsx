import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Rocket, BarChart3, ExternalLink, Pencil, Trash2, Plus, Upload, Loader2 } from "lucide-react";

interface Resource {
  id: string;
  project_id: string;
  resource_type: string;
  display_name: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Globe; label: string; maxCount: number }> = {
  website: { icon: Globe, label: "Website", maxCount: 1 },
  landingpage: { icon: Rocket, label: "Landingpage", maxCount: 1 },
  presentation: { icon: BarChart3, label: "Präsentation", maxCount: 3 },
};

export function ProjectResources({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite } = usePermission();
  const canEdit = canWrite("projects");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ type: "website", name: "", url: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editResource, setEditResource] = useState<Resource | null>(null);

  const { data: resources } = useQuery<Resource[]>({
    queryKey: ["project-resources", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_resources")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const typeCounts: Record<string, number> = {};
  resources?.forEach((r) => { typeCounts[r.resource_type] = (typeCounts[r.resource_type] ?? 0) + 1; });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name ist Pflicht");
      let filePath: string | null = null;
      let fileName: string | null = null;
      let url: string | null = form.url.trim() || null;

      if (form.type === "presentation" && selectedFile) {
        const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "pdf";
        const allowed = ["pdf", "ppt", "pptx"];
        if (!allowed.includes(ext)) throw new Error("Nur PDF, PPT, PPTX erlaubt");
        if (selectedFile.size > 50 * 1024 * 1024) throw new Error("Max. 50 MB");

        filePath = `${projectId}/${Date.now()}_${selectedFile.name}`;
        fileName = selectedFile.name;
        const { error: upErr } = await supabase.storage
          .from("project-resources")
          .upload(filePath, selectedFile, { contentType: selectedFile.type });
        if (upErr) throw upErr;
      }

      const { error } = await (supabase as any)
        .from("project_resources")
        .insert({
          project_id: projectId,
          resource_type: form.type,
          display_name: form.name.trim(),
          url,
          file_path: filePath,
          file_name: fileName,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Ressource hinzugefügt" });
      resetDialog();
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editResource || !form.name.trim()) return;
      const { error } = await (supabase as any)
        .from("project_resources")
        .update({ display_name: form.name.trim(), url: form.url.trim() || null })
        .eq("id", editResource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Aktualisiert" });
      resetDialog();
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      if (resource.file_path) {
        await supabase.storage.from("project-resources").remove([resource.file_path]);
      }
      const { error } = await (supabase as any)
        .from("project_resources")
        .delete()
        .eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Ressource gelöscht" });
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const resetDialog = () => {
    setDialogOpen(false);
    setForm({ type: "website", name: "", url: "" });
    setSelectedFile(null);
    setEditResource(null);
  };

  const openResource = async (resource: Resource) => {
    if (resource.url) {
      window.open(resource.url, "_blank", "noopener,noreferrer");
    } else if (resource.file_path) {
      const { data } = await supabase.storage.from("project-resources").createSignedUrl(resource.file_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const openEdit = (r: Resource) => {
    setEditResource(r);
    setForm({ type: r.resource_type, name: r.display_name, url: r.url || "" });
    setDialogOpen(true);
  };

  const availableTypes = Object.entries(typeConfig).filter(
    ([type, cfg]) => (typeCounts[type] ?? 0) < cfg.maxCount
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Ressourcen</h3>
        {canEdit && availableTypes.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditResource(null); setForm({ type: availableTypes[0][0], name: "", url: "" }); setDialogOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Hinzufügen
          </Button>
        )}
      </div>

      {(!resources || resources.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">Keine Ressourcen vorhanden.</p>
      )}

      <div className="space-y-2">
        {resources?.map((r) => {
          const cfg = typeConfig[r.resource_type];
          const Icon = cfg?.icon ?? Globe;
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.display_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {cfg?.label} {r.file_name ? `· ${r.file_name}` : r.url ? `· ${r.url}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openResource(r)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editResource ? "Ressource bearbeiten" : "Ressource hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editResource && (
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableTypes.map(([type, cfg]) => (
                      <SelectItem key={type} value={type}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="z.B. Produktwebsite"
              />
            </div>
            {form.type !== "presentation" && (
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
            )}
            {form.type === "presentation" && !editResource && (
              <div className="space-y-1.5">
                <Label>Datei (PDF, PPT, PPTX, max. 50 MB)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Datei wählen
                  </Button>
                  {selectedFile && <span className="text-sm text-muted-foreground truncate">{selectedFile.name}</span>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.ppt,.pptx"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Abbrechen</Button>
            <Button
              onClick={() => editResource ? updateMutation.mutate() : createMutation.mutate()}
              disabled={createMutation.isPending || updateMutation.isPending || !form.name.trim()}
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
