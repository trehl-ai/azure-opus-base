import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export function useMoveTask() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "done") updates.completed_at = new Date().toISOString();
      else updates.completed_at = null;
      const { error } = await supabase.from("tasks").update(updates as any).eq("id", taskId);
      if (error) throw error;
    },
    // Optimistic update
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previous = qc.getQueryData(queryKeys.tasks.all);

      qc.setQueryData(queryKeys.tasks.all, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((t: any) =>
          t.id === taskId
            ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : null }
            : t
        );
      });

      return { previous };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.tasks.all, context.previous);
      }
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });
}
