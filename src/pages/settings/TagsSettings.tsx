import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tags, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#3B45F1", "#6366F1", "#8B5CF6", "#EC4899",
  "#EF4444", "#F59E0B", "#22C55E", "#14B8A6",
  "#0EA5E9", "#64748B", "#A16207", "#166534",
];

export default function TagsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editTag, setEditTag] = useState<{ id?: string; name: string; color: string }>({ name: "", color: PRESET_COLORS[0] });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const canAccess = user?.role === "admin" || user?.role === "sales";

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: usageCounts = {} } = useQuery({
    queryKey: ["tag-usage-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entity_tags").select("tag_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.tag_id] = (counts[r.tag_id] ?? 0) + 1; });
      return counts;
    },
  });

  const openCreate = () => { setEditTag({ name: "", color: PRESET_COLORS[0] }); setEditOpen(true); };
  const openEdit = (t: any) => { setEditTag({ id: t.id, name: t.name, color: t.color ?? PRESET_COLORS[0] }); setEditOpen(true); };

  const save = async () => {
    if (!editTag.name.trim()) { toast.error("Name ist erforderlich"); return; }
    if (editTag.name.length > 30) { toast.error("Maximal 30 Zeichen"); return; }

    // Uniqueness check
    const { data: existing } = await supabase.from("tags").select("id").eq("name", editTag.name.trim()).maybeSingle();
    if (existing && existing.id !== editTag.id) { toast.error("Ein Tag mit diesem Namen existiert bereits"); return; }

    setSaving(true);
    try {
      if (editTag.id) {
        const { error } = await supabase.from("tags").update({ name: editTag.name.trim(), color: editTag.color }).eq("id", editTag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert({ name: editTag.name.trim(), color: editTag.color });
        if (error) throw error;
      }
      toast.success(editTag.id ? "Tag aktualisiert" : "Tag erstellt");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tags-all"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("tags").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Tag gelöscht");
      queryClient.invalidateQueries({ queryKey: ["tags-all"] });
      queryClient.invalidateQueries({ queryKey: ["tag-usage-counts"] });
    }
    setDeleteTarget(null);
  };

  if (!canAccess) {
    return (
      <Card className="rounded-2xl max-w-2xl">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">Kein Zugriff</h2>
          <p className="text-sm text-muted-foreground">Du benötigst Admin- oder Sales-Rechte.</p>
        </CardContent>
      </Card>
    );
  }

  const deleteCount = deleteTarget ? (usageCounts[deleteTarget.id] ?? 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground mt-1">Tags können Companies, Contacts, Deals, Projekten und Aufgaben zugeordnet werden.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Neuer Tag</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : tags.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Tags className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Noch keine Tags angelegt</h3>
            <p className="text-sm text-muted-foreground mb-4">Erstelle deinen ersten Tag, um Datensätze zu kategorisieren.</p>
            <Button onClick={openCreate}>Ersten Tag erstellen</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tags.map(t => {
            const count = usageCounts[t.id] ?? 0;
            return (
              <Card key={t.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge style={{ backgroundColor: t.color ?? "#6366F1", color: "#fff" }} className="text-xs">
                      {t.name}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{count} Verwendung{count !== 1 ? "en" : ""}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTag.id ? "Tag bearbeiten" : "Neuer Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Label>Name *</Label>
                <Input value={editTag.name} maxLength={30} onChange={e => setEditTag(t => ({ ...t, name: e.target.value }))} placeholder="z.B. VIP Kunde" />
                <p className="text-xs text-muted-foreground">{editTag.name.length}/30</p>
              </div>
              {/* Live preview */}
              <div className="pt-5">
                <Badge style={{ backgroundColor: editTag.color, color: "#fff" }} className="text-sm">
                  {editTag.name || "Vorschau"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                      editTag.color === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditTag(t => ({ ...t, color: c }))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs text-muted-foreground shrink-0">Hex:</Label>
                <Input
                  value={editTag.color}
                  onChange={e => setEditTag(t => ({ ...t, color: e.target.value }))}
                  className="h-8 w-28 text-xs font-mono"
                  placeholder="#000000"
                />
                <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: editTag.color }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag löschen</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCount > 0
                ? `Dieser Tag wird von ${deleteCount} Datensätz${deleteCount === 1 ? "" : "en"} verwendet. Beim Löschen wird er von allen entfernt.`
                : "Dieser Tag wird aktuell nicht verwendet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
