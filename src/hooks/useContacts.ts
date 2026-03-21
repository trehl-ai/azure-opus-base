import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactsQueryParams {
  search: string;
  status: string;
  ownerUserId: string;
  page: number;
  pageSize: number;
}

export function useContacts({ search, status, ownerUserId, page, pageSize }: ContactsQueryParams) {
  return useQuery({
    queryKey: ["contacts-list", search, status, ownerUserId, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select(
          "*, owner:users!contacts_owner_user_id_fkey(id, first_name, last_name), company_contacts(is_primary, company:companies(id, name))",
          { count: "exact" }
        );

      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
        );
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
