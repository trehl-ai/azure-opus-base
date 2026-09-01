import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Sentinel fuer "category IS NULL" im Kategorie-Dropdown. Ein Select-Value darf
// nicht leer sein (Radix wirft sonst), und NULL ist kein Wert — daher ein
// Sentinel, der nie als echte Kategorie vorkommen kann.
export const CATEGORY_NONE = "__none__";

export interface CompaniesQueryParams {
  search: string;
  status: string;
  ownerUserId: string;
  source: string;
  category: string;
  /** true = NUR archivierte Firmen (deleted_at IS NOT NULL). Kein Mischzustand. */
  showArchived: boolean;
  page: number;
  pageSize: number;
}

/**
 * Setzt Quelle/Kategorie/Archiv-Filter auf eine companies-Query.
 * Wird von der Liste UND vom Excel-Export benutzt, damit der Export exakt das
 * exportiert, was auf dem Bildschirm steht.
 */
export function applyCompanyFilters<T>(
  query: T,
  { search, status, ownerUserId, source, category, showArchived }: Omit<CompaniesQueryParams, "page" | "pageSize">
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  q = showArchived ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
  if (status && status !== "all") q = q.eq("status", status);
  if (ownerUserId && ownerUserId !== "all") q = q.eq("owner_user_id", ownerUserId);
  if (source && source !== "all") q = q.eq("source", source);
  if (category && category !== "all") {
    q = category === CATEGORY_NONE ? q.is("category", null) : q.eq("category", category);
  }
  return q as T;
}

export function useCompanies(params: CompaniesQueryParams) {
  const { page, pageSize } = params;
  return useQuery({
    queryKey: [
      "companies",
      params.search,
      params.status,
      params.ownerUserId,
      params.source,
      params.category,
      params.showArchived,
      page,
      pageSize,
    ],
    queryFn: async () => {
      // count: 'exact' ist Pflicht — PostgREST kappt die Zeilen bei 1000 und die
      // Kopfzahl waere sonst still falsch (companies hat >4.200 Zeilen).
      const query = applyCompanyFilters(
        supabase
          .from("companies")
          .select("*, owner:users!companies_owner_user_id_fkey(id, first_name, last_name)", { count: "exact" }),
        params
      );

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

/**
 * Gesamtzahl der Firmen in der aktuellen Ansicht (aktiv ODER archiviert),
 * OHNE Such-/Quelle-/Kategorie-Filter — das "Y" in "X von Y Firmen".
 */
export function useCompaniesTotal(showArchived: boolean) {
  return useQuery({
    queryKey: ["companies-total", showArchived],
    queryFn: async () => {
      let q = supabase.from("companies").select("id", { count: "exact", head: true });
      q = showArchived ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
