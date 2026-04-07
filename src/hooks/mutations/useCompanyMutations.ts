import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "@/lib/queryKeys";

export function useCreateCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      industry?: string | null;
      website?: string | null;
      street?: string | null;
      postal_code?: string | null;
      city?: string | null;
      country?: string | null;
      status?: string;
      source?: string | null;
      notes?: string | null;
      owner_user_id?: string | null;
      created_by_user_id?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from("companies")
        .insert(data)
        .select("id")
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: "Company erstellt" });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}

export function useUpdateCompany(id: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase.from("companies").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Company aktualisiert" });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      qc.invalidateQueries({ queryKey: queryKeys.companies.detail(id) });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Company gelöscht" });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate("/companies", { replace: true });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}
