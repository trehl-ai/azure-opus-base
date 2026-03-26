import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Rocket, FileBarChart, Plus, ExternalLink, Pencil, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Resource {
  id: string;
  main_project_id: string;
  resource_type: string;
  display_name: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  sort_order: number;
  created_at: string;
}

interface Props {
  mainProjectId: string;
}

const typeConfig = {
  website: { icon: Globe, label: "Website", maxSlots: 1, isUrl: true },
  landingpage: { icon: Rocket, label: "Landingpage", maxSlots: 1, isUrl: true },
  presentation: { icon: FileBarChart, label: "Präsentation", maxSlots: 3, isUrl: false },
} as const;

type ResourceType = keyof typeof typeConfig;

export function MainProjectResources({ mainProjectId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite } = usePermission();
  const canEdit = canWrite("projects");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formType, setFormType] = useState<ResourceType>("website");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["main-project-resources", mainProjectId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("main_project_resources" as any)
        .select("*")
        .eq("main_project_id", mainProjectId)
        .order("sort_order") as any);
      if (error) throw error;
      return (data ?? []) as Resource[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: Resource) => {
      if (r.file_path) {
        await supabase.storage.from("main-project-resources").remove([r.file_path]);
      }
      const { error } = await (supabase.from("main_project_resources" as any).delete().eq("id", r.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["main-project-resources", mainProjectId] });
      toast({ title: "Ressource gelöscht" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fehler", description: e.message }),
  });

  const byType = (type: ResourceType) => resources.filter((r) => r.resource_type === type);
  const canAddType = (type: ResourceType) => byType(type).length < typeConfig[type].maxSlots;

  const openAdd = (type: ResourceType) => {
    setEditingResource(null);
    setFormType(type);
    setFormName("");
    setFormUrl("");
    setFormFile(null);
    setDialogOpen(true);
  };

  const openEdit = (r: Resource) => {
    setEditingResource(r);
    setFormType(r.resource_type as ResourceType);
    setFormName(r.display_name);
    setFormUrl(r.url ?? "");
    setFormFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ variant: "destructive", title: "Name ist erforderlich" });
      return;
    }
    setSaving(true);
    try {
      let filePath: string | null = editingResource?.file_path ?? null;
      let fileName: string | null = editingResource?.file_name ?? null;
      let url: string | null = formUrl || null;

      if (formFile) {
        const ext = formFile.name.split(".").pop();
        const path = `${mainProjectId}/${crypto.randomUUID()}.${ext}`;
        // Remove old file if replacing
        if (filePath) {
          await supabase.storage.from("main-project-resources").remove([filePath]);
        }
        const { error: uploadErr } = await supabase.storage
          .from("main-project-resources")
          .upload(path, formFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        filePath = path;
        fileName = formFile.name;
        url = null;
      }

      if (editingResource) {
        const { error } = await (supabase
          .from("main_project_resources" as any)
          .update({ display_name: formName, url, file_path: filePath, file_name: fileName })
          .eq("id", editingResource.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("main_project_resources" as any)
          .insert({
            main_project_id: mainProjectId,
            resource_type: formType,
            display_name: formName,
            url,
            file_path: filePath,
            file_name: fileName,
            sort_order: byType(formType).length,
          }) as any);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["main-project-resources", mainProjectId] });
      setDialogOpen(false);
      toast({ title: editingResource ? "Ressource aktualisiert" : "Ressource hinzugefügt" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const openResource = async (r: Resource) => {
    if (r.url) {
      window.open(r.url, "_blank", "noopener,noreferrer");
    } else if (r.file_path) {
      const { data } = await supabase.storage
        .from("main-project-resources")
        .createSignedUrl(r.file_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const isUrlType = typeConfig[formType]?.isUrl;

  return (
    <>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-[13px] font-semibold text-foreground">Ressourcen</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1.5">
          {(Object.keys(typeConfig) as ResourceType[]).map((type) => {
            const config = typeConfig[type];
            const items = byType(type);
            const Icon = config.icon;

            return (
              <div key={type}>
                {items.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group text-[12px]"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-foreground font-medium">{r.display_name}</span>
                    <button
                      onClick={() => openResource(r)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                      title="Öffnen"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => openEdit(r)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                          title="Bearbeiten"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(r)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          title="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {canEdit && canAddType(type) && (
                  <button
                    onClick={() => openAdd(type)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:text-primary hover:bg-muted/50 w-full transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{config.label} hinzufügen</span>
                  </button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Ressource bearbeiten" : "Ressource hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingResource && (
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as ResourceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeConfig) as ResourceType[])
                      .filter((t) => canAddType(t))
                      .map((t) => (
                        <SelectItem key={t} value={t}>{typeConfig[t].label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="z.B. Hauptwebsite" />
            </div>
            {isUrlType ? (
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://..." />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Datei (PDF, PPT, PPTX, max. 50 MB)</Label>
                <Input
                  type="file"
                  accept=".pdf,.ppt,.pptx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 50 * 1024 * 1024) {
                      toast({ variant: "destructive", title: "Datei zu groß (max. 50 MB)" });
                      return;
                    }
                    setFormFile(f ?? null);
                  }}
                />
                {editingResource?.file_name && !formFile && (
                  <p className="text-[11px] text-muted-foreground">Aktuelle Datei: {editingResource.file_name}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
