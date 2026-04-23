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
        // Erst alle pipeline_ids mit Deals holen
        const { data: dealData } = await supabase
          .from("deals")
          .select("pipeline_id")
          .is("deleted_at", null)
          .not("pipeline_id", "is", null);

        const pipelineIds = [...new Set((dealData ?? []).map((d: any) => d.pipeline_id))];

        if (pipelineIds.length === 0) {
          setPipelines([]);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("pipelines")
          .select("id, name, is_default")
          .in("id", pipelineIds)
          .order("name");

        setPipelines(data ?? []);
      } else {
        const { data } = await supabase
          .from("pipelines")
          .select("id, name, is_default")
          .order("name");
        setPipelines(data ?? []);
      }

      setLoading(false);
    }
    fetch();
  }, [onlyWithDeals]);

  return { pipelines, loading };
}
