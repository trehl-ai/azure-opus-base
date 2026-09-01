import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000; // PostgREST max-rows Hard-Cap
const MAX_PAGES = 25; // Sicherheitsnetz: max. 25.000 Zeilen

/**
 * Liest die vorkommenden Werte von companies.source und companies.category fuer
 * die Filter-Dropdowns.
 *
 * Warum seitenweise: PostgREST kappt jede Antwort still bei 1000 Zeilen. Ein
 * einzelnes select('source') haette bei >4.200 Firmen nur die Quellen der ersten
 * 1000 Zeilen gezeigt — das Dropdown waere unvollstaendig gewesen, ohne dass es
 * auffaellt. DISTINCT gibt es in PostgREST nicht, deshalb wird hier voll gelesen
 * (nur zwei schmale Spalten) und im Client dedupliziert.
 *
 * `category` ist in types.ts (Lovable-generiert) noch nicht enthalten, existiert
 * aber live auf ttgvhqygmgtnjgwunuwz — daher der Zugriff ueber (supabase as any).
 */
export function useCompanyFilterOptions(showArchived: boolean) {
  return useQuery({
    queryKey: ["company-filter-options", showArchived],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sources = new Set<string>();
      const categories = new Set<string>();
      let hasNullCategory = false;

      for (let page = 0; page < MAX_PAGES; page++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any).from("companies").select("source, category").order("id");
        q = showArchived ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
        const { data, error } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;

        const rows = (data ?? []) as { source: string | null; category: string | null }[];
        for (const row of rows) {
          if (row.source) sources.add(row.source);
          if (row.category) categories.add(row.category);
          else hasNullCategory = true;
        }
        if (rows.length < PAGE) break;
      }

      const collator = new Intl.Collator("de-DE", { sensitivity: "base" });
      return {
        sources: [...sources].sort(collator.compare),
        categories: [...categories].sort(collator.compare),
        hasNullCategory,
      };
    },
  });
}
