import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, role, is_active")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });
}
