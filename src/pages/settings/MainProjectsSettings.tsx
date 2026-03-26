import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Pencil, Upload, Trash2, Loader2 } from "lucide-react";

interface MainProject {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
}

export default function MainProjectsSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366F1");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366F1");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: mainProjects } = useQuery<MainProject[]>({
    queryKey: ["main-projects", false],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("main_projects")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Name ist Pflicht");
      const { error } = await (supabase as any)
        .from("main_projects")
        .insert({ name: newName.trim(), color: newColor });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Hauptprojekt erstellt" });
      setNewName("");
      setNewColor("#6366F1");
      qc.invalidateQueries({ queryKey: ["main-projects"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await (supabase as any)
        .from("main_projects")
        .update({ name: name.trim(), color })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Gespeichert" });
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["main-projects"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("main_projects")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["main-projects"] }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const handleImageUpload = async (projectId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Nur Bilder erlaubt (JPG/PNG)" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Maximale Dateigröße: 5 MB" });
      return;
    }
    setUploadingId(projectId);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${projectId}/image.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("main-project-images")
        .upload(filePath, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("main-project-images").getPublicUrl(filePath);
      const imageUrl = urlData?.publicUrl || null;
      const { error } = await (supabase as any)
        .from("main_projects")
        .update({ image_path: filePath, image_url: imageUrl })
        .eq("id", projectId);
      if (error) throw error;
      toast({ title: "Bild hochgeladen" });
      qc.invalidateQueries({ queryKey: ["main-projects"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload fehlgeschlagen", description: err.message });
    } finally {
      setUploadingId(null);
    }
  };

  const removeImageMutation = useMutation({
    mutationFn: async ({ id, imagePath }: { id: string; imagePath: string }) => {
      await supabase.storage.from("main-project-images").remove([imagePath]);
      const { error } = await (supabase as any)
        .from("main_projects")
        .update({ image_path: null, image_url: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bild entfernt" });
      qc.invalidateQueries({ queryKey: ["main-projects"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Hauptprojekte</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Hauptprojekte dienen als übergeordnete Kategorien für eure Projekte.
        </p>
      </div>

      {/* Create new */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Neues Hauptprojekt</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name eingeben…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Farbe</Label>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-10 w-10 rounded border border-border cursor-pointer"
          />
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newName.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Erstellen
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {mainProjects?.map((mp) => (
          <div key={mp.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            {/* Image */}
            <div className="shrink-0">
              <Avatar className="h-12 w-12">
                {mp.image_url ? (
                  <AvatarImage src={mp.image_url + "?t=" + Date.now()} alt={mp.name} className="object-cover" />
                ) : (
                  <AvatarFallback style={{ backgroundColor: mp.color || "#6366F1" }} className="text-white font-semibold">
                    {mp.name[0]?.toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {editId === mp.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: mp.id, name: editName, color: editColor })}
                    disabled={updateMutation.isPending}
                  >
                    Speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    Abbrechen
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: mp.color || "#6366F1" }}
                  />
                  <span className="text-sm font-medium truncate">{mp.name}</span>
                  {!mp.is_active && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inaktiv</span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={uploadingId === mp.id ? fileInputRef : undefined}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(mp.id, e.target.files[0]);
                    e.target.value = "";
                  }
                }}
                id={`img-upload-${mp.id}`}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => document.getElementById(`img-upload-${mp.id}`)?.click()}
                disabled={uploadingId === mp.id}
              >
                {uploadingId === mp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              {mp.image_path && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeImageMutation.mutate({ id: mp.id, imagePath: mp.image_path! })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setEditId(mp.id); setEditName(mp.name); setEditColor(mp.color || "#6366F1"); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Switch
                checked={mp.is_active}
                onCheckedChange={(checked) => toggleMutation.mutate({ id: mp.id, is_active: checked })}
              />
            </div>
          </div>
        ))}
        {(!mainProjects || mainProjects.length === 0) && (
          <p className="text-center text-muted-foreground py-8">Keine Hauptprojekte vorhanden.</p>
        )}
      </div>
    </div>
  );
}
