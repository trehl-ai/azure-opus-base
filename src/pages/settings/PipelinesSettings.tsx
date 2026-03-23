import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ShieldAlert, GripVertical, Trash2, Pencil, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

interface StageRow {
  id?: string;
  name: string;
  stage_type: string;
  probability_percent: number;
  is_won_stage: boolean;
  is_lost_stage: boolean;
  position: number;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface PipelineForm {
  id?: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  stages: StageRow[];
}

const emptyStage = (pos: number): StageRow => ({
  name: "", stage_type: "open", probability_percent: 0,
  is_won_stage: false, is_lost_stage: false, position: pos, _isNew: true,
});

const defaultNewPipeline: PipelineForm = {
  name: "",
  is_default: false,
  is_active: true,
  stages: [
    { name: "Neu", stage_type: "open", probability_percent: 10, is_won_stage: false, is_lost_stage: false, position: 1, _isNew: true },
    { name: "Verhandlung", stage_type: "open", probability_percent: 50, is_won_stage: false, is_lost_stage: false, position: 2, _isNew: true },
    { name: "Gewonnen", stage_type: "won", probability_percent: 100, is_won_stage: true, is_lost_stage: false, position: 3, _isNew: true },
    { name: "Verloren", stage_type: "lost", probability_percent: 0, is_won_stage: false, is_lost_stage: true, position: 4, _isNew: true },
  ],
};

export default function PipelinesSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<PipelineForm>(defaultNewPipeline);
  const [originalStageIds, setOriginalStageIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteHasDeals, setDeleteHasDeals] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["pipelines-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stagesMap = {} } = useQuery({
    queryKey: ["pipeline-stages-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_stages").select("*").order("position");
      if (error) throw error;
      const map: Record<string, any[]> = {};
      data.forEach(s => { (map[s.pipeline_id] ??= []).push(s); });
      return map;
    },
  });

  const { data: dealCounts = {} } = useQuery({
    queryKey: ["deal-counts-by-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("pipeline_id, pipeline_stage_id, status");
      if (error) throw error;
      const byPipeline: Record<string, number> = {};
      const byStage: Record<string, number> = {};
      data.forEach(d => {
        if (d.status === "open") {
          byPipeline[d.pipeline_id] = (byPipeline[d.pipeline_id] ?? 0) + 1;
          byStage[d.pipeline_stage_id] = (byStage[d.pipeline_stage_id] ?? 0) + 1;
        }
      });
      return { byPipeline, byStage };
    },
  });

  const openEdit = (pipeline?: any) => {
    if (pipeline) {
      const stages = (stagesMap[pipeline.id] ?? []).map((s: any) => ({
        id: s.id, name: s.name, stage_type: s.stage_type,
        probability_percent: s.probability_percent ?? 0,
        is_won_stage: s.is_won_stage ?? false, is_lost_stage: s.is_lost_stage ?? false,
        position: s.position,
      }));
      setForm({ id: pipeline.id, name: pipeline.name, is_default: pipeline.is_default ?? false, is_active: pipeline.is_active ?? true, stages });
      setOriginalStageIds(stages.map((s: StageRow) => s.id!).filter(Boolean));
    } else {
      setForm({ ...defaultNewPipeline, stages: defaultNewPipeline.stages.map(s => ({ ...s })) });
      setOriginalStageIds([]);
    }
    setEditOpen(true);
  };

  const activeStages = form.stages.filter(s => !s._deleted);

  const validate = (): string | null => {
    if (!form.name.trim()) return "Pipeline-Name ist erforderlich.";
    if (activeStages.length < 3) return "Mindestens 3 Stages erforderlich.";
    if (activeStages.some(s => !s.name.trim())) return "Alle Stage-Namen müssen ausgefüllt sein.";
    if (activeStages.filter(s => s.is_won_stage).length !== 1) return "Genau eine Won-Stage erforderlich.";
    if (activeStages.filter(s => s.is_lost_stage).length !== 1) return "Genau eine Lost-Stage erforderlich.";
    return null;
  };

  const updateStage = (idx: number, patch: Partial<StageRow>) => {
    setForm(prev => {
      const stages = [...prev.stages];
      const updated = { ...stages[idx], ...patch };
      // Auto-set flags from type
      if (patch.stage_type === "won") { updated.is_won_stage = true; updated.is_lost_stage = false; updated.probability_percent = 100; }
      if (patch.stage_type === "lost") { updated.is_lost_stage = true; updated.is_won_stage = false; updated.probability_percent = 0; }
      if (patch.stage_type === "open") { updated.is_won_stage = false; updated.is_lost_stage = false; }
      stages[idx] = updated;
      return { ...prev, stages };
    });
  };

  const removeStage = (idx: number) => {
    const stage = form.stages[idx];
    if (stage.id && (dealCounts as any).byStage?.[stage.id]) {
      toast.error(`Diese Stage hat noch ${(dealCounts as any).byStage[stage.id]} offene Deals.`);
      return;
    }
    setForm(prev => {
      const stages = [...prev.stages];
      if (stages[idx].id) stages[idx] = { ...stages[idx], _deleted: true };
      else stages.splice(idx, 1);
      return { ...prev, stages };
    });
  };

  const addStage = () => {
    const maxPos = Math.max(0, ...activeStages.map(s => s.position));
    setForm(prev => ({ ...prev, stages: [...prev.stages, emptyStage(maxPos + 1)] }));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setForm(prev => {
      const visible = prev.stages.filter(s => !s._deleted);
      const hidden = prev.stages.filter(s => s._deleted);
      const item = visible.splice(dragIdx, 1)[0];
      visible.splice(idx, 0, item);
      setDragIdx(idx);
      return { ...prev, stages: [...visible, ...hidden] };
    });
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      // Pipeline upsert
      if (form.is_default) {
        await supabase.from("pipelines").update({ is_default: false }).neq("id", form.id ?? "");
      }
      let pipelineId = form.id;
      if (pipelineId) {
        await supabase.from("pipelines").update({ name: form.name, is_default: form.is_default, is_active: form.is_active }).eq("id", pipelineId);
      } else {
        const { data, error } = await supabase.from("pipelines").insert({ name: form.name, is_default: form.is_default, is_active: form.is_active }).select().single();
        if (error) throw error;
        pipelineId = data.id;
      }

      // Stages: delete removed
      const deletedIds = form.stages.filter(s => s._deleted && s.id).map(s => s.id!);
      if (deletedIds.length) await supabase.from("pipeline_stages").delete().in("id", deletedIds);

      // Stages: upsert active
      for (let i = 0; i < activeStages.length; i++) {
        const s = activeStages[i];
        const payload = {
          pipeline_id: pipelineId!, name: s.name, stage_type: s.stage_type,
          probability_percent: s.probability_percent, is_won_stage: s.is_won_stage,
          is_lost_stage: s.is_lost_stage, position: i + 1,
        };
        if (s.id) {
          await supabase.from("pipeline_stages").update(payload).eq("id", s.id);
        } else {
          await supabase.from("pipeline_stages").insert(payload);
        }
      }

      toast.success("Pipeline gespeichert");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pipelines-all"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages-all"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = async (pipeline: any) => {
    // Check deal count before showing dialog
    const { count } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipeline.id)
      .is("deleted_at", null);
    setDeleteHasDeals((count ?? 0) > 0);
    setDeleteTarget(pipeline);
  };

  const archivePipeline = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("pipelines").update({ is_active: false }).eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Pipeline archiviert – bestehende Deals bleiben erhalten.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["pipelines-all"] });
    } catch (e: any) {
      toast.error(`Archivierung fehlgeschlagen: ${e.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const deletePipeline = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error: stagesErr } = await supabase
        .from("pipeline_stages").delete().eq("pipeline_id", deleteTarget.id);
      if (stagesErr) throw stagesErr;

      const { error: pipeErr } = await supabase
        .from("pipelines").delete().eq("id", deleteTarget.id);
      if (pipeErr) throw pipeErr;

      toast.success("Pipeline gelöscht");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["pipelines-all"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages-all"] });
      queryClient.invalidateQueries({ queryKey: ["deal-counts-by-pipeline"] });
    } catch (e: any) {
      toast.error(`Pipeline konnte nicht gelöscht werden: ${e.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleActive = async (p: any) => {
    await supabase.from("pipelines").update({ is_active: !p.is_active }).eq("id", p.id);
    queryClient.invalidateQueries({ queryKey: ["pipelines-all"] });
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pipelines</h2>
          <p className="text-sm text-muted-foreground mt-1">Verwalte deine Vertriebspipelines und konfiguriere die Stages.</p>
        </div>
        <Button onClick={() => openEdit()} className="gap-2"><Plus className="h-4 w-4" /> Neue Pipeline</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : pipelines.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center text-muted-foreground">Keine Pipelines vorhanden.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {pipelines.map(p => {
            const stageCount = stagesMap[p.id]?.length ?? 0;
            const dealCount = (dealCounts as any).byPipeline?.[p.id] ?? 0;
            return (
              <Card key={p.id} className={cn("rounded-2xl", !p.is_active && "opacity-60")}>
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.is_default && <Badge variant="secondary" className="text-xs">Standard</Badge>}
                        {!p.is_active && <Badge variant="outline" className="text-xs text-muted-foreground"><Archive className="h-3 w-3 mr-1 inline" />Archiviert</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stageCount} Stages{dealCount > 0 && ` · ${dealCount} offene Deals`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Aktiv</Label>
                      <Switch checked={p.is_active ?? true} onCheckedChange={() => toggleActive(p)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                    </Button>
                    {p.is_default ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span><Button variant="outline" size="sm" disabled className="text-destructive">Löschen</Button></span>
                        </TooltipTrigger>
                        <TooltipContent>Standard-Pipeline kann nicht gelöscht werden</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(p)}>Löschen</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? `Pipeline bearbeiten: ${form.name}` : "Neue Pipeline"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Pipeline fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pipeline-Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.is_default} onCheckedChange={c => setForm(f => ({ ...f, is_default: !!c }))} id="is_default" />
                  <Label htmlFor="is_default" className="text-sm">Als Standard-Pipeline setzen</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Aktiv</Label>
                  <Switch checked={form.is_active} onCheckedChange={c => setForm(f => ({ ...f, is_active: c }))} />
                </div>
              </div>
            </div>

            {/* Stages Editor */}
            <div>
              <Label className="text-sm font-semibold">Stages</Label>
              <div className="mt-2 space-y-1">
                {/* Header */}
                <div className="grid grid-cols-[28px_1fr_100px_80px_60px_60px_36px] gap-2 px-1 text-xs text-muted-foreground font-medium">
                  <span />
                  <span>Name</span>
                  <span>Typ</span>
                  <span>%</span>
                  <span>Won</span>
                  <span>Lost</span>
                  <span />
                </div>
                {form.stages.map((stage, idx) => {
                  if (stage._deleted) return null;
                  const activeIdx = activeStages.indexOf(stage);
                  const hasDeals = stage.id && (dealCounts as any).byStage?.[stage.id] > 0;
                  return (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => handleDragStart(activeIdx)}
                      onDragOver={e => handleDragOver(e, activeIdx)}
                      onDragEnd={() => setDragIdx(null)}
                      className="grid grid-cols-[28px_1fr_100px_80px_60px_60px_36px] gap-2 items-center rounded-lg border px-1 py-1.5 bg-card hover:bg-muted/50"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <Input value={stage.name} onChange={e => updateStage(idx, { name: e.target.value })} className="h-8 text-sm" />
                      <Select value={stage.stage_type} onValueChange={v => updateStage(idx, { stage_type: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0} max={100} value={stage.probability_percent} onChange={e => updateStage(idx, { probability_percent: Number(e.target.value) })} className="h-8 text-sm" />
                      <div className="flex justify-center">
                        <Checkbox checked={stage.is_won_stage} disabled />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox checked={stage.is_lost_stage} disabled />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!!hasDeals} onClick={() => removeStage(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        {hasDeals && <TooltipContent>Stage hat offene Deals</TooltipContent>}
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={addStage}>
                <Plus className="h-3.5 w-3.5" /> Stage hinzufügen
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteHasDeals ? "Pipeline archivieren" : "Pipeline löschen"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteHasDeals
                ? `Die Pipeline „${deleteTarget?.name}" hat noch verknüpfte Deals und kann nicht gelöscht werden. Du kannst sie stattdessen archivieren – bestehende Deals bleiben erhalten, aber die Pipeline erscheint nicht mehr in Auswahllisten.`
                : `Bist du sicher, dass du die Pipeline „${deleteTarget?.name}" endgültig löschen möchtest? Alle zugehörigen Stages werden ebenfalls entfernt.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Abbrechen</AlertDialogCancel>
            {deleteHasDeals ? (
              <AlertDialogAction
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={archivePipeline}
                disabled={deleteLoading}
              >
                <Archive className="h-4 w-4 mr-1" />
                {deleteLoading ? "Archivieren…" : "Archivieren"}
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={deletePipeline}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Löschen…" : "Endgültig löschen"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
