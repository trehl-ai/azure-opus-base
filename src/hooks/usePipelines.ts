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
        const { data } = await supabase
          .from("deals")
          .select("pipeline_id, pipelines(id, name, is_default)")
          .is("deleted_at", null)
          .not("pipeline_id", "is", null);

        if (data) {
          const seen = new Set<string>();
          const unique: Pipeline[] = [];
          for (const row of data) {
            const p = row.pipelines as unknown as Pipeline;
            if (p && !seen.has(p.id)) {
              seen.add(p.id);
              unique.push(p);
            }
          }
          setPipelines(unique.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else {
        const { data } = await supabase
          .from("pipelines")
          .select("id, name, is_default")
          .eq("is_active", true)
          .order("name");
        if (data) setPipelines(data);
      }
      setLoading(false);
    }
    fetch();
  }, [onlyWithDeals]);

  return { pipelines, loading };
}
