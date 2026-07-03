import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeadScoreTier, LEAD_TIER_STYLES } from "@/lib/leadScore";

type SponsoringLead = {
  contact_id: string;
  name: string | null;
  unternehmen: string | null;
  position: string | null;
  lead_score: number | null;
  academy_fit_score: number | null;
  sponsoring_score: number | null;
};

export default function Sponsoring() {
  const { data: leads, isLoading } = useQuery<SponsoringLead[]>({
    queryKey: ["sponsoring_leads"],
    queryFn: async () => {
      // as-any-Cast: generierte types.ts kennt die neue RPC (noch) nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_top_sponsoring_leads", { p_limit: 25 });
      if (error) throw error;
      return (data ?? []) as SponsoringLead[];
    },
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold text-foreground">Sponsoring-Leads</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Sortiert nach Sponsoring-Score (0,7·Lead-Score + 0,3·Academy-Fit)
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-card shadow-sm p-5 md:p-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : !leads || leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Leads gefunden.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Unternehmen</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Lead-Score</TableHead>
                <TableHead className="text-right">Academy-Fit</TableHead>
                <TableHead className="text-right">Sponsoring-Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead, i) => {
                const tier = getLeadScoreTier(lead.sponsoring_score);
                const styles = LEAD_TIER_STYLES[tier];
                const fullName = (lead.name ?? "").trim() || "—";
                return (
                  <TableRow key={lead.contact_id ?? `${fullName}-${i}`}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{lead.unternehmen ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.position ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-[12px] text-muted-foreground tabular-nums">
                      {lead.lead_score ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lead.academy_fit_score == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        lead.academy_fit_score
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          styles.bg,
                          styles.text,
                        )}
                      >
                        {styles.label}
                        <span className="opacity-90">{lead.sponsoring_score ?? 0}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
