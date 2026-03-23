import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskStatuses, TaskStatus } from "@/hooks/queries/useTaskStatuses";
import { toast } from "sonner";
import { Plus, ShieldAlert, GripVertical, Pencil, Archive, Save, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function TaskStatusesSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: statuses = [], isLoading } = useTaskStatuses(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  if (user?.role !== "admin") {
    return (
      <Card className="rounded-2xl max-w-2xl">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">Kein Zugriff</h2>
          <p className="text-sm text-muted-foreground">Du benötigst Administrator-Rechte.</p>
        </CardContent>
      </Card>
    );
  }

  const slugify = (name: string) =>
    name.toLowerCase().replace(/[äöü]/g, (m) => ({ ä: "ae", ö: "oe", ü: "ue" }[m] || m))
      .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").substring(0, 50);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["task-statuses"] });

  const startEdit = (s: TaskStatus) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("task_statuses" as any)
        .update({ name: editName.trim() })
        .eq("id", editingId);
      if (error) throw error;
      toast.success("Status umbenannt");
      setEditingId(null);
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addStatus = async () => {
    if (!newName.trim()) return;
    const slug = slugify(newName);
    if (statuses.some((s) => s.slug === slug)) {
      toast.error("Ein Status mit diesem Slug existiert bereits.");
      return;
    }
    setSaving(true);
    try {
      const maxPos = Math.max(0, ...statuses.map((s) => s.position));
      const { error } = await supabase.from("task_statuses" as any).insert({
        name: newName.trim(),
        slug,
        position: maxPos + 1,
        is_active: true,
        is_default: false,
      });
      if (error) throw error;
      toast.success("Neuer Task-Status erstellt");
      setNewName("");
      setAddMode(false);
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: TaskStatus) => {
    // Check if tasks exist with this slug before deactivating
    if (s.is_active) {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", s.slug);
      if ((count ?? 0) > 0) {
        toast.warning(`${count} Task(s) haben diesen Status. Der Status wird archiviert, bestehende Tasks behalten ihren Status.`);
      }
    }
    const { error } = await supabase
      .from("task_statuses" as any)
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(s.is_active ? "Status deaktiviert" : "Status aktiviert");
    invalidate();
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    // Reorder in DB
    const reordered = [...statuses];
    const [item] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, item);
    setDragIdx(idx);
    // Save positions
    reordered.forEach(async (s, i) => {
      await supabase.from("task_statuses" as any).update({ position: i + 1 }).eq("id", s.id);
    });
    invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Task-Status</h2>
          <p className="text-sm text-muted-foreground mt-1">Verwalte die Spalten im Task-Board. Reihenfolge per Drag & Drop ändern.</p>
        </div>
        <Button onClick={() => { setAddMode(true); setNewName(""); }} className="gap-2">
          <Plus className="h-4 w-4" /> Neuer Status
        </Button>
      </div>

      {/* Add new */}
      {addMode && (
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 py-4 px-6">
            <Input
              placeholder="Status-Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStatus()}
              className="max-w-xs"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">Slug: {slugify(newName || "...")}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={addStatus} disabled={saving || !newName.trim()} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Erstellen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddMode(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : statuses.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-muted-foreground">Keine Task-Status vorhanden.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {statuses.map((s, idx) => (
            <Card
              key={s.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={() => setDragIdx(null)}
              className={cn("rounded-2xl cursor-grab", !s.is_active && "opacity-60")}
            >
              <CardContent className="flex items-center gap-3 py-3 px-5">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground w-6">{s.position}</span>

                {editingId === s.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="max-w-xs h-8"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={saveEdit} disabled={saving}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{s.slug}</Badge>
                    {s.is_default && <Badge variant="secondary" className="text-[10px]">Standard</Badge>}
                    {!s.is_active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        <Archive className="h-3 w-3 mr-1 inline" />Archiviert
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Aktiv</Label>
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(s)}
                    disabled={editingId === s.id}
                    className="gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
