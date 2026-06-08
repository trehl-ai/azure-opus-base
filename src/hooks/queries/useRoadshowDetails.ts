import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { supabaseEIC } from "@/lib/supabaseEIC";

type RoadshowDetailsRow = Database["public"]["Tables"]["deal_roadshow_details"]["Row"];
type RoadshowDetailsUpdate = Database["public"]["Tables"]["deal_roadshow_details"]["Update"];

export function useRoadshowDetails(dealId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery<RoadshowDetailsRow | null>({
    queryKey: ["deal_roadshow_details", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      if (!dealId) return null;
      const { data, error } = await supabaseEIC
        .from("deal_roadshow_details")
        .select("*")
        .eq("deal_id", dealId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (fields: RoadshowDetailsUpdate) => {
      if (!dealId) throw new Error("dealId fehlt");
      const { error } = await supabaseEIC
        .from("deal_roadshow_details")
        .upsert({ ...fields, deal_id: dealId }, { onConflict: "deal_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Roadshow-Checkliste gespeichert" });
      qc.invalidateQueries({ queryKey: ["deal_roadshow_details", dealId] });
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    save: (fields: RoadshowDetailsUpdate) => mutation.mutate(fields),
    isSaving: mutation.isPending,
  };
}
