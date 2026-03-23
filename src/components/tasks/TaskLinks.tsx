import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Plus, ExternalLink, Pencil, Trash2, Check, X } from "lucide-react";

interface Props { taskId: string; }

export function TaskLinks({ taskId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const { data: links, isLoading } = useQuery({
    queryKey: ["task-links", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_links" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!label.trim() || !url.trim()) throw new Error("Label und URL sind Pflicht");
      let finalUrl = url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
      const { error } = await supabase.from("task_links" as any).insert({
        task_id: taskId, label: label.trim(), url: finalUrl, created_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Link hinzugefügt" });
      setLabel(""); setUrl(""); setShowForm(false);
      qc.invalidateQueries({ queryKey: ["task-links", taskId] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editLabel.trim() || !editUrl.trim()) throw new Error("Label und URL sind Pflicht");
      let finalUrl = editUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
      const { error } = await supabase.from("task_links" as any).update({ label: editLabel.trim(), url: finalUrl }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Link aktualisiert" });
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["task-links", taskId] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_links" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Link gelöscht" }); qc.invalidateQueries({ queryKey: ["task-links", taskId] }); },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const startEdit = (link: any) => {
    setEditingId(link.id);
    setEditLabel(link.label);
    setEditUrl(link.url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Links
        </h3>
        <Button variant="ghost" size="sm" className="gap-1 text-[12px]" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> Link
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (z.B. Dokumentation)" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." onKeyDown={(e) => { if (e.key === "Enter") addMutation.mutate(); }} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>Hinzufügen</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setLabel(""); setUrl(""); }}>Abbrechen</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Laden…</p>
      ) : links && links.length > 0 ? (
        <div className="space-y-1.5">
          {links.map((link: any) => (
            <div key={link.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 group">
              {editingId === link.id ? (
                <div className="flex-1 space-y-1.5">
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-sm" />
                  <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="h-8 text-sm" />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => updateMutation.mutate()}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <>
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">{link.label}</a>
                    <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")} title="Öffnen">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(link)} title="Bearbeiten">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(link.id)} title="Löschen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Links.</p>
      )}
    </div>
  );
}
