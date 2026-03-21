import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { CreateDealSheet } from "@/components/deals/CreateDealSheet";
import { DealCard } from "@/components/deals/DealCard";
import { LostReasonDialog } from "@/components/deals/LostReasonDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Deals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { user } = useAuth();
  const { canWrite, role } = usePermission();
  const canWriteDeals = canWrite("deals");
  const showOwnerToggle = role === "sales";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState(showOwnerToggle ? (user?.id ?? "all") : "all");
  const [showAll, setShowAll] = useState(!showOwnerToggle);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  // Lost reason dialog state
  const [lostDialog, setLostDialog] = useState<{ open: boolean; dealId: string; dealTitle: string; stageId: string }>({
    open: false, dealId: "", dealTitle: "", stageId: "",
  });

  // Pipelines
  const { data: pipelines } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const activePipelineId = selectedPipelineId || pipelines?.find((p) => p.is_default)?.id || pipelines?.[0]?.id || "";

  // Stages
  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", activePipelineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_stages").select("*").eq("pipeline_id", activePipelineId).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!activePipelineId,
  });

  // Deals
  const { data: deals } = useQuery({
    queryKey: ["deals-board", activePipelineId, ownerFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("deals")
        .select("id, title, value_amount, currency, priority, pipeline_stage_id, status, company:companies(name), owner:users!deals_owner_user_id_fkey(first_name, last_name)")
        .eq("pipeline_id", activePipelineId);

      const effectiveOwner = showOwnerToggle && !showAll ? (user?.id ?? ownerFilter) : ownerFilter;
      if (effectiveOwner && effectiveOwner !== "all") q = q.eq("owner_user_id", effectiveOwner);
      if (dateFrom) q = q.gte("expected_close_date", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("expected_close_date", format(dateTo, "yyyy-MM-dd"));

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activePipelineId,
  });

  // Move deal mutation (for non-lost stages)
  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId, isWon }: { dealId: string; stageId: string; isWon: boolean }) => {
      const updates: Record<string, unknown> = { pipeline_stage_id: stageId };
      if (isWon) {
        updates.status = "won";
        updates.won_at = new Date().toISOString();
      }
      const { error } = await supabase.from("deals").update(updates).eq("id", dealId);
      if (error) throw error;
      // If won, fetch the created project
      if (isWon) {
        // Small delay to let trigger run
        await new Promise((r) => setTimeout(r, 500));
        const { data: project } = await supabase.from("projects").select("id, title").eq("originating_deal_id", dealId).maybeSingle();
        return project;
      }
      return null;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["deals-board"] });
      if (project) {
        toast({
          title: "Deal gewonnen! Projekt wurde automatisch erstellt. 🎉",
          description: project.title,
          action: <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${project.id}`)}>Zum Projekt</Button>,
        });
      }
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Fehler", description: err.message }),
  });

  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    if (!canWriteDeals) { e.preventDefault(); return; }
    e.dataTransfer.setData("dealId", dealId);
  }, [canWriteDeals]);

  const handleDrop = useCallback(
    (e: React.DragEvent, stageId: string) => {
      e.preventDefault();
      const dealId = e.dataTransfer.getData("dealId");
      if (!dealId || !stages) return;

      const stage = stages.find((s) => s.id === stageId);
      if (!stage) return;

      const deal = deals?.find((d) => d.id === dealId);
      if (!deal || deal.pipeline_stage_id === stageId) return;

      if (stage.is_lost_stage) {
        setLostDialog({ open: true, dealId, dealTitle: deal.title, stageId });
        return;
      }

      moveDealMutation.mutate({ dealId, stageId, isWon: stage.is_won_stage ?? false });
    },
    [stages, deals, moveDealMutation]
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Group deals by stage
  const dealsByStage = new Map<string, typeof deals>();
  deals?.forEach((deal) => {
    const list = dealsByStage.get(deal.pipeline_stage_id) ?? [];
    list.push(deal);
    dealsByStage.set(deal.pipeline_stage_id, list);
  });

  const formatSum = (v: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-section-title text-foreground">Deals</h1>
        {canWriteDeals && (
          <Button onClick={() => setSheetOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Deal
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Pipeline" /></SelectTrigger>
          <SelectContent>{pipelines?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Owner</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd.MM.yy") : "Von"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd.MM.yy") : "Bis"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Zeitraum zurücksetzen</Button>
        )}
        {showOwnerToggle && (
          <Button variant={showAll ? "secondary" : "outline"} size="sm" onClick={() => { setShowAll(!showAll); if (!showAll) setOwnerFilter("all"); else setOwnerFilter(user?.id ?? "all"); }}>
            {showAll ? "Alle Deals" : "Meine Deals"}
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {stages?.map((stage) => {
            const stageDeals = dealsByStage.get(stage.id) ?? [];
            const totalValue = stageDeals.reduce((sum, d) => sum + (d.value_amount ?? 0), 0);

            const bgClass = stage.is_won_stage
              ? "bg-success/5 border-success/20"
              : stage.is_lost_stage
                ? "bg-destructive/5 border-destructive/20"
                : "bg-[#F0F1F5] border-transparent";

            return (
              <div
                key={stage.id}
                className={cn("flex w-[280px] shrink-0 flex-col rounded-xl border p-3", bgClass)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header */}
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-label font-semibold text-foreground">{stage.name}</h3>
                    <span className="text-[11px] font-medium text-muted-foreground">{stage.probability_percent}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {stageDeals.length} Deal{stageDeals.length !== 1 ? "s" : ""} · {formatSum(totalValue)}
                  </p>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 min-h-[60px]">
                  {stageDeals.map((deal) => {
                    const company = deal.company as { name: string } | null;
                    const owner = deal.owner as { first_name: string; last_name: string } | null;
                    return (
                      <DealCard
                        key={deal.id}
                        deal={{
                          id: deal.id,
                          title: deal.title,
                          company_name: company?.name ?? null,
                          value_amount: deal.value_amount,
                          currency: deal.currency,
                          priority: deal.priority,
                          owner_first_name: owner?.first_name ?? null,
                          owner_last_name: owner?.last_name ?? null,
                        }}
                        onDragStart={handleDragStart}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CreateDealSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      <LostReasonDialog
        dealId={lostDialog.dealId}
        dealTitle={lostDialog.dealTitle}
        stageId={lostDialog.stageId}
        open={lostDialog.open}
        onOpenChange={(open) => setLostDialog((p) => ({ ...p, open }))}
        onComplete={() => setLostDialog({ open: false, dealId: "", dealTitle: "", stageId: "" })}
      />
    </div>
  );
}
