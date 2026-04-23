import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CAMPAIGN_TAG_NAMES = ["WerteRaum Potential", "PLSC 2025", "SMM 2025", "Markenfestival"] as const;

export interface DashboardKpis {
  activeDeals: number;
  contacts: number;
  werteraumPotential: number;
  companies: number;
  lostThisWeek: number;
}

export interface PipelineTile {
  id: string;
  name: string;
  total: number;
  lost: number;
}

export interface CampaignFlag {
  name: (typeof CAMPAIGN_TAG_NAMES)[number];
  tagId: string | null;
  count: number;
  icon: string;
}

export interface RecentDeal {
  id: string;
  title: string;
  created_at: string;
  company_name: string | null;
  pipeline_name: string | null;
}

export function useEoIpsoKpis() {
  return useQuery({
    queryKey: ["eoipso", "kpis"],
    queryFn: async (): Promise<DashboardKpis> => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [activeDeals, contacts, companies, lost, werteraumTag] = await Promise.all([
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("status", "in", "(lost,won)"),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("status", "lost")
          .gte("lost_at", sevenDaysAgo),
        supabase.from("tags").select("id").eq("name", "WerteRaum Potential").maybeSingle(),
      ]);

      let werteraumCount = 0;
      if (werteraumTag.data?.id) {
        const { count } = await supabase
          .from("entity_tags")
          .select("id", { count: "exact", head: true })
          .eq("entity_type", "contact")
          .eq("tag_id", werteraumTag.data.id);
        werteraumCount = count ?? 0;
      }

      return {
        activeDeals: activeDeals.count ?? 0,
        contacts: contacts.count ?? 0,
        werteraumPotential: werteraumCount,
        companies: companies.count ?? 0,
        lostThisWeek: lost.count ?? 0,
      };
    },
  });
}

export function useEoIpsoPipelines() {
  return useQuery({
    queryKey: ["eoipso", "pipelines"],
    queryFn: async (): Promise<PipelineTile[]> => {
      const { data: pipelines, error: pErr } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("is_active", true);
      if (pErr) throw pErr;

      const { data: deals, error: dErr } = await supabase
        .from("deals")
        .select("pipeline_id, status")
        .is("deleted_at", null);
      if (dErr) throw dErr;

      const tiles: PipelineTile[] = (pipelines ?? []).map((p) => {
        const pipelineDeals = (deals ?? []).filter((d) => d.pipeline_id === p.id);
        return {
          id: p.id,
          name: p.name,
          total: pipelineDeals.length,
          lost: pipelineDeals.filter((d) => d.status === "lost").length,
        };
      });

      return tiles.sort((a, b) => b.total - a.total);
    },
  });
}

export function useEoIpsoCampaignFlags() {
  return useQuery({
    queryKey: ["eoipso", "campaign-flags"],
    queryFn: async (): Promise<CampaignFlag[]> => {
      const icons: Record<string, string> = {
        "WerteRaum Potential": "🎯",
        "PLSC 2025": "📋",
        "SMM 2025": "🎤",
        Markenfestival: "🎪",
      };

      const { data: tags, error } = await supabase
        .from("tags")
        .select("id, name")
        .in("name", CAMPAIGN_TAG_NAMES as unknown as string[]);
      if (error) throw error;

      const tagMap = new Map((tags ?? []).map((t) => [t.name, t.id]));
      const tagIds = (tags ?? []).map((t) => t.id);

      let countsByTag = new Map<string, number>();
      if (tagIds.length) {
        const { data: et, error: etErr } = await supabase
          .from("entity_tags")
          .select("tag_id")
          .eq("entity_type", "contact")
          .in("tag_id", tagIds);
        if (etErr) throw etErr;
        countsByTag = (et ?? []).reduce((acc, row) => {
          acc.set(row.tag_id, (acc.get(row.tag_id) ?? 0) + 1);
          return acc;
        }, new Map<string, number>());
      }

      return CAMPAIGN_TAG_NAMES.map((name) => {
        const tagId = tagMap.get(name) ?? null;
        return {
          name,
          tagId,
          icon: icons[name],
          count: tagId ? countsByTag.get(tagId) ?? 0 : 0,
        };
      });
    },
  });
}

export function useEoIpsoRecentDeals() {
  return useQuery({
    queryKey: ["eoipso", "recent-deals"],
    queryFn: async (): Promise<RecentDeal[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, title, created_at, company:companies(name), pipeline:pipelines!deals_pipeline_id_fkey(name)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        created_at: d.created_at,
        company_name: (d.company as { name: string } | null)?.name ?? null,
        pipeline_name: (d.pipeline as { name: string } | null)?.name ?? null,
      }));
    },
  });
}
