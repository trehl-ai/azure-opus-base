import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseEIC, type OutreachStats } from "@/lib/supabaseEIC";
import { PlausibleWidget } from "@/components/campaigns/PlausibleWidget";

function useStats() {
  return useQuery({
    queryKey: ["eic", "vr_stiftungen_stats"],
    queryFn: async () => {
      const { data, error } = await (supabaseEIC as any).rpc("get_vr_stiftungen_stats");
      if (error) throw error;
      return data as OutreachStats;
    },
  });
}

type ActivityRow = {
  title: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  activity_type: string | null;
};

function useActivities() {
  return useQuery({
    queryKey: ["eic", "outreach_activities", "vr_stiftungen"],
    queryFn: async () => {
      // deal_activities ist nicht anon-lesbar (RLS) — der anon `supabaseEIC` bekommt 401.
      // Session-Client `supabase` (gleiche DB ttgvhqygmgtnjgwunuwz) trägt die auth.uid()-Session,
      // die die RLS-Policy braucht. Gleicher Fix wie PR #96/#97. get_outreach_activities ist
      // der gemeinsame SECURITY-DEFINER-Feed — p_pipeline_id grenzt auf die VR-Stiftungen-Pipeline ein.
      const { data, error } = await (supabase as any).rpc("get_outreach_activities", {
        p_limit: 20,
        p_pipeline_id: "341c067d-39fe-46ae-82c7-33d6c55a2a60",
      });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });
}

export default function CampaignVrStiftungen() {
  const statsQ = useStats();
  const activitiesQ = useActivities();

  const stats = statsQ.data;
  const total = stats?.gesamt ?? 0;
  const emailSent = stats?.email_sent ?? 0;
  const conversion = emailSent > 0 ? ((stats?.replied ?? 0) / emailSent) * 100 : 0;

  const funnel = stats
    ? [
        { label: "Pending", value: stats.pending, color: "#9ca3af" },
        { label: "Email versendet", value: stats.email_sent, color: "#378ADD" },
        { label: "Link geklickt", value: stats.link_clicked, color: "#1D9E75" },
        { label: "Geantwortet", value: stats.replied, color: "#16a34a" },
        { label: "Nicht kontaktieren", value: stats.terminated, color: "#7c3aed" },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kampagnen
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">VR Stiftungen 2026</h1>
        <Badge className="bg-success/15 text-success hover:bg-success/15">Aktiv</Badge>
      </header>

      {statsQ.error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">
          Fehler: {(statsQ.error as Error).message}
        </Card>
      )}

      {/* BLOCK 1 — KPI */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
        {(
          [
            { label: "Gesamt", value: total },
            { label: "Versendet", value: stats?.email_sent ?? 0 },
            { label: "Link geklickt", value: stats?.link_clicked ?? 0 },
            { label: "Geantwortet", value: stats?.replied ?? 0, tone: "success" as const },
            {
              label: "Opt-Out",
              value: stats?.opt_out ?? 0,
              subtitle: `Nicht kontaktieren: ${stats?.terminated ?? 0}`,
            },
            { label: "Conversion", value: `${conversion.toFixed(1)}%` },
          ] satisfies {
            label: string;
            value: number | string;
            subtitle?: string;
            tone?: "success";
          }[]
        ).map((k) => (
          <Card key={k.label} className="p-4">
            <p
              className={`text-[12px] font-medium tracking-wider uppercase ${
                k.tone === "success" ? "text-success" : "text-muted-foreground"
              }`}
            >
              {k.label}
            </p>
            <p
              className={`text-[28px] font-semibold mt-1 ${
                k.tone === "success" ? "text-success" : ""
              }`}
            >
              {statsQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : k.value}
            </p>
            {k.subtitle && (
              <p className="text-[11px] text-muted-foreground mt-1">{k.subtitle}</p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* BLOCK 2.5 — Plausible Analytics (oben, direkt unter Stats) */}
          <PlausibleWidget site="viktoria-roadshow.com" />

          {/* BLOCK 2 — Funnel */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Status-Funnel</h2>
            <div className="space-y-3">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground">{f.value}</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(f.value / funnelMax) * 100}%`, background: f.color }}
                    />
                  </div>
                </div>
              ))}
              {!stats && !statsQ.isLoading && (
                <p className="text-sm text-muted-foreground">Keine Daten</p>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN — Aktivitäten */}
        <div className="space-y-6 h-fit lg:sticky lg:top-6">
          {/* BLOCK 5 — Aktivitäts-Feed */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Aktivitäten</h2>
            {activitiesQ.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade…
              </div>
            )}
            {activitiesQ.error && (
              <p className="text-sm text-destructive">{(activitiesQ.error as Error).message}</p>
            )}
            {activitiesQ.data && (
              <ul className="space-y-3">
                {activitiesQ.data.map((a, i) => (
                  <li key={i} className="border-l-2 border-primary/30 pl-3">
                    <p className="text-sm font-medium leading-tight">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[a.company_name, formatRelative(a.created_at)].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
                {activitiesQ.data.length === 0 && (
                  <li className="text-sm text-muted-foreground">Keine Aktivitäten</li>
                )}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tg.`;
}
