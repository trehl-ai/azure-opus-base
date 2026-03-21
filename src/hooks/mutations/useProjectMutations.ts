import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "@/lib/queryKeys";
import { format } from "date-fns";

export function useMoveProject() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "completed") updates.end_date = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.all }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Projekt gelöscht" });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      navigate("/projects");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}
