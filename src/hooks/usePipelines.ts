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
        // Server-side DISTINCT via RPC — umgeht PostgREST 1000-Row-Limit
        const { data } = await supabase.rpc("pipelines_with_deals");
        setPipelines((data ?? []) as Pipeline[]);
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
