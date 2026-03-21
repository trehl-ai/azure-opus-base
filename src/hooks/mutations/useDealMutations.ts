import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "@/lib/queryKeys";

export function useMoveDeal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ dealId, stageId, isWon }: { dealId: string; stageId: string; isWon: boolean }) => {
      const updates: Record<string, unknown> = { pipeline_stage_id: stageId };
      if (isWon) {
        updates.status = "won";
        updates.won_at = new Date().toISOString();
      }
      const { error } = await supabase.from("deals").update(updates).eq("id", dealId);
      if (error) throw error;
      if (isWon) {
        await new Promise((r) => setTimeout(r, 500));
        const { data: project } = await supabase
          .from("projects")
          .select("id, title")
          .eq("originating_deal_id", dealId)
          .maybeSingle();
        return project;
      }
      return null;
    },
    // Optimistic update for stage changes
    onMutate: async ({ dealId, stageId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.deals.all });
      const previousData = qc.getQueriesData({ queryKey: queryKeys.deals.all });

      // Update all deal board queries optimistically
      qc.setQueriesData({ queryKey: queryKeys.deals.all }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((d: any) =>
          d.id === dealId ? { ...d, pipeline_stage_id: stageId } : d
        );
      });

      return { previousData };
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
      if (project) {
        toast({
          title: "Deal gewonnen! Projekt wurde automatisch erstellt. 🎉",
          description: project.title,
        });
      }
    },
    onError: (err: Error, _vars, context) => {
      // Rollback optimistic update
      context?.previousData?.forEach(([key, data]: [any, any]) => {
        qc.setQueryData(key, data);
      });
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deal gelöscht" });
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
      navigate("/deals");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}

export function useWonDeal(id: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (wonStageId?: string) => {
      const updates: Record<string, unknown> = {
        status: "won",
        won_at: new Date().toISOString(),
      };
      if (wonStageId) updates.pipeline_stage_id = wonStageId;
      const { error } = await supabase.from("deals").update(updates).eq("id", id);
      if (error) throw error;
      await new Promise((r) => setTimeout(r, 500));
      const { data: project } = await supabase
        .from("projects")
        .select("id, title")
        .eq("originating_deal_id", id)
        .maybeSingle();
      return project;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.deals.project(id) });
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
      if (project) {
        toast({
          title: "Deal gewonnen! Projekt wurde automatisch erstellt. 🎉",
          description: project.title,
        });
      } else {
        toast({ title: "Deal als Won markiert 🎉" });
      }
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}
