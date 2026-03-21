import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface EntityTagsManagerProps {
  entityType: string;
  entityId: string;
}

export function EntityTagsManager({ entityType, entityId }: EntityTagsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [showInput, setShowInput] = useState(false);

  const { data: entityTags } = useQuery({
    queryKey: ["entity-tags", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_tags")
        .select("id, tag:tags(id, name, color)")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return data;
    },
  });

  const { data: allTags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from("entity_tags").insert({
        tag_id: tagId,
        entity_type: entityType,
        entity_id: entityId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-tags", entityType, entityId] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Fehler", description: err.message.includes("duplicate") ? "Tag bereits zugeordnet" : err.message });
    },
  });

  const createAndAddMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("tags").insert({ name: name.trim() }).select("id").single();
      if (error) throw error;
      const { error: linkError } = await supabase.from("entity_tags").insert({
        tag_id: data.id,
        entity_type: entityType,
        entity_id: entityId,
      });
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-tags", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTagName("");
      setShowInput(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (entityTagId: string) => {
      const { error } = await supabase.from("entity_tags").delete().eq("id", entityTagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-tags", entityType, entityId] });
    },
  });

  const assignedTagIds = new Set(entityTags?.map((et) => (et.tag as any)?.id));
  const availableTags = allTags?.filter((t) => !assignedTagIds.has(t.id)) ?? [];

  return (
    <div className="space-y-3">
      {/* Current tags */}
      <div className="flex flex-wrap gap-2">
        {entityTags?.map((et) => {
          const tag = et.tag as { id: string; name: string; color: string | null } | null;
          if (!tag) return null;
          return (
            <span
              key={et.id}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium text-white"
              style={{ backgroundColor: tag.color ?? "#6366F1" }}
            >
              {tag.name}
              <button onClick={() => removeTagMutation.mutate(et.id)} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {(!entityTags || entityTags.length === 0) && !showInput && (
          <p className="text-label text-muted-foreground">Keine Tags zugeordnet.</p>
        )}
      </div>

      {/* Add tag */}
      <div className="flex flex-wrap gap-2">
        {!showInput ? (
          <Button variant="outline" size="sm" onClick={() => setShowInput(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Tag hinzufügen
          </Button>
        ) : (
          <div className="space-y-2 w-full">
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addTagMutation.mutate(tag.id)}
                    className="rounded-full border border-border px-2.5 py-1 text-[12px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Neuen Tag erstellen…"
                className="h-8 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTagName.trim()) createAndAddMutation.mutate(newTagName);
                }}
              />
              <Button size="sm" onClick={() => { if (newTagName.trim()) createAndAddMutation.mutate(newTagName); }} disabled={!newTagName.trim()}>
                Erstellen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowInput(false); setNewTagName(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
