import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "@/lib/queryKeys";

export function useCreateContact() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      first_name: string;
      last_name: string;
      email?: string | null;
      phone?: string | null;
      mobile?: string | null;
      job_title?: string | null;
      linkedin_url?: string | null;
      status?: string;
      source?: string | null;
      notes?: string | null;
      owner_user_id?: string | null;
      created_by_user_id?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from("contacts")
        .insert(data)
        .select("id")
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: "Kontakt erstellt" });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}

export function useUpdateContact(id: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase.from("contacts").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Kontakt aktualisiert" });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(id) });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Kontakt gelöscht" });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      navigate("/contacts", { replace: true });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });
}
