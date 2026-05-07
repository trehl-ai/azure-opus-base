import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useRoadshowDetails(dealId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["roadshow-details", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_roadshow_details" as any)
        .select("*")
        .eq("deal_id", dealId!)
        .maybeSingle();
      // Tabelle existiert evtl. (noch) nicht im DB-Schema → leise null zurückgeben
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("does not exist")) {
          return null;
        }
        throw error;
      }
      return data as any;
    },
    enabled: !!dealId,
    retry: false,
  });

  const upsertMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from("deal_roadshow_details" as any)
          .update(fields)
          .eq("deal_id", dealId!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("deal_roadshow_details" as any)
          .insert({ deal_id: dealId!, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Roadshow-Checkliste gespeichert" });
      qc.invalidateQueries({ queryKey: ["roadshow-details", dealId] });
      qc.invalidateQueries({ queryKey: ["deals-board"] });
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return { data: query.data, isLoading: query.isLoading, save: upsertMutation.mutate, isSaving: upsertMutation.isPending };
}
