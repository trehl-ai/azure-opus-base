import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CompaniesQueryParams {
  search: string;
  status: string;
  ownerUserId: string;
  page: number;
  pageSize: number;
}

export function useCompanies({ search, status, ownerUserId, page, pageSize }: CompaniesQueryParams) {
  return useQuery({
    queryKey: ["companies", search, status, ownerUserId, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select(
          "*, owner:users!companies_owner_user_id_fkey(id, first_name, last_name)",
          { count: "exact" }
        )
        .is("deleted_at", null);

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (ownerUserId && ownerUserId !== "all") {
        query = query.eq("owner_user_id", ownerUserId);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
  });
}
