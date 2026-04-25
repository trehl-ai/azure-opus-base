import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Pipeline {
  id: string;
  name: string;
  is_default?: boolean;
}

interface UsePipelinesOptions {
  onlyWithDeals?: boolean;
}

export function usePipelines({ onlyWithDeals = false }: UsePipelinesOptions = {}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);

      if (onlyWithDeals) {
        // Paginiert alle deal pipeline_ids holen (umgeht PostgREST 1000-Row-Limit)
        const pageSize = 1000;
        let from = 0;
        const ids = new Set<string>();
        while (true) {
          const { data: page, error } = await supabase
            .from("deals")
            .select("pipeline_id")
            .is("deleted_at", null)
            .not("pipeline_id", "is", null)
            .range(from, from + pageSize - 1);
          if (error || !page || page.length === 0) break;
          for (const row of page) {
            if (row.pipeline_id) ids.add(row.pipeline_id as string);
          }
          if (page.length < pageSize) break;
          from += pageSize;
        }

        if (ids.size === 0) {
          setPipelines([]);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("pipelines")
          .select("id, name, is_default")
          .in("id", Array.from(ids))
          .eq("is_active", true)
          .order("name");
        setPipelines(data ?? []);
      } else {
        const { data } = await supabase
          .from("pipelines")
          .select("id, name, is_default")
          .eq("is_active", true)
          .order("name");
        setPipelines(data ?? []);
      }

      setLoading(false);
    }
    fetch();
  }, [onlyWithDeals]);

  return { pipelines, loading };
}
