import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/useUsers";
import { useTaskStatuses } from "@/hooks/queries/useTaskStatuses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ListenHinweis } from "@/components/shared/ListenHinweis";
import { CreateTaskSheet } from "@/components/tasks/CreateTaskSheet";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { datumDe, useLinienAufgaben } from "./linienDaten";

const KEINE_BERECHTIGUNG = "Keine Berechtigung für diese Änderung. Bitte Tomi ansprechen.";

/**
 * Aufgaben einer Kampagnenlinie.
 *
 * Bewusst KEINE zweite Aufgabenlogik: Anlegen laeuft ueber den vorhandenen
 * CreateTaskSheet (um eine optionale campaignId erweitert), Bearbeiten ueber den
 * vorhandenen TaskDetailSheet. Hier steht nur die Liste und das Haekchen.
 */
export function LinienAufgaben({ campaignId }: { campaignId: string }) {
  const { data, isLoading, error } = useLinienAufgaben(campaignId);
  const { data: users } = useUsers();
  const { data: statuses = [] } = useTaskStatuses();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [neu, setNeu] = useState(false);
  const [offeneAufgabe, setOffeneAufgabe] = useState<string | null>(null);

  // Der Fertig-Zustand kommt aus task_statuses, nicht aus der Position in der Liste:
  // "der letzte Status" ist eine Anzeigereihenfolge, kein Zustand.
  const doneSlug = statuses.find((s) => s.slug === "erledigt")?.slug ?? "erledigt";

  const abhaken = useMutation({
    mutationFn: async ({ id, fertig }: { id: string; fertig: boolean }) => {
      const { data: zeilen, error: fehler } = await supabase
        .from("tasks")
        .update({
          status: fertig ? doneSlug : "offen",
          completed_at: fertig ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select("id");
      if (fehler) {
        if (fehler.code === "42501") throw new Error(KEINE_BERECHTIGUNG);
        throw fehler;
      }
      if (!zeilen || zeilen.length === 0) throw new Error(KEINE_BERECHTIGUNG);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eic", "campaign_tasks", campaignId] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fehler", description: e.message }),
  });

  // Offene zuerst; innerhalb der Gruppe bleibt die Reihenfolge der Query (Faelligkeit).
  const sortiert = data
    ? [...data].sort((a, b) => Number(a.status === doneSlug) - Number(b.status === doneSlug))
    : [];

  const nameZu = (id: string | null) => {
    if (!id) return null;
    const u = users?.find((x) => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : null;
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-body font-semibold text-foreground">Aufgaben</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setNeu(true)}>
          <Plus className="h-4 w-4" /> Neue Aufgabe
        </Button>
      </div>

      {isLoading || error || sortiert.length === 0 ? (
        <ListenHinweis
          laedt={isLoading}
          fehler={(error as Error) ?? null}
          leerText="Für diese Kampagne ist keine Aufgabe hinterlegt."
        />
      ) : (
        <div className="divide-y divide-border">
          {sortiert.map((t) => {
            const fertig = t.status === doneSlug;
            const wer = nameZu(t.assigned_user_id);
            const faellig = datumDe(t.due_date);
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <Checkbox
                  checked={fertig}
                  onCheckedChange={(v) => abhaken.mutate({ id: t.id, fertig: v === true })}
                  aria-label="Als erledigt markieren"
                />
                <button
                  className="flex-1 text-left"
                  onClick={() => setOffeneAufgabe(t.id)}
                >
                  <span
                    className={
                      fertig ? "text-body text-muted-foreground line-through" : "text-body text-foreground"
                    }
                  >
                    {t.title}
                  </span>
                  {(wer || faellig) && (
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {[faellig && `fällig ${faellig}`, wer].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
                {fertig && (
                  <Badge variant="secondary" className="shrink-0">
                    Erledigt
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateTaskSheet open={neu} onOpenChange={setNeu} campaignId={campaignId} />
      <TaskDetailSheet
        taskId={offeneAufgabe}
        open={!!offeneAufgabe}
        onOpenChange={(v) => !v && setOffeneAufgabe(null)}
      />
    </>
  );
}
