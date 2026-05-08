import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { usePipelines } from "@/hooks/usePipelines";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateDealSheet } from "@/components/deals/CreateDealSheet";
import { DealCard } from "@/components/deals/DealCard";
import { LostReasonDialog } from "@/components/deals/LostReasonDialog";
import { MobileCard } from "@/components/shared/MobileCard";
import { MobileStageSelector, StageChangeSheet } from "@/components/shared/MobileStageSelector";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, ArrowRightLeft, Download, Trash2 } from "lucide-react";
import { usePresence } from "@/hooks/usePresence";
import { PresenceAvatars } from "@/components/shared/PresenceAvatars";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToExcel, todayString } from "@/lib/excelExport";

const eur = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default function Deals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const contactParam = searchParams.get("contact");
  const { data: users } = useUsers();
  const { user } = useAuth();
  const { canWrite, role } = usePermission();
  const canWriteDeals = canWrite("deals");
  const showOwnerToggle = role === "sales";
  const onlineUsers = usePresence("/deals");
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Auto-open sheet when navigated with ?contact=<id>
  useEffect(() => {
    if (contactParam) setSheetOpen(true);
  }, [contactParam]);

  const handleSheetChange = (o: boolean) => {
    setSheetOpen(o);
    if (!o && contactParam) {
      searchParams.delete("contact");
      setSearchParams(searchParams, { replace: true });
    }
  };
  const [ownerFilter, setOwnerFilter] = useState(showOwnerToggle ? (user?.id ?? "all") : "all");
  const [showAll, setShowAll] = useState(!showOwnerToggle);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [eignungFilter, setEignungFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leitfadenUrl, setLeitfadenUrl] = useState<string | null>(null);
  const [leitfadenName, setLeitfadenName] = useState<string | null>(null);
  const [uploadingLeitfaden, setUploadingLeitfaden] = useState(false);

  const handleLeitfadenUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLeitfaden(true);
    try {
      const path = `werteraum/leitfaden/${file.name}`;
      const { error } = await supabase.storage
        .from("project-files")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage
        .from("project-files")
        .getPublicUrl(path);
      setLeitfadenUrl(data.publicUrl);
      setLeitfadenName(file.name);
    } catch (err) {
      console.error("Leitfaden-Upload fehlgeschlagen:", err);
    } finally {
      setUploadingLeitfaden(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLeitfadenDelete = async () => {
    if (!leitfadenName) return;
    try {
      await supabase.storage
        .from("project-files")
        .remove([`werteraum/leitfaden/${leitfadenName}`]);
    } catch (err) {
      console.error("Leitfaden-Löschen fehlgeschlagen:", err);
    }
    setLeitfadenUrl(null);
    setLeitfadenName(null);
  };

  const handleExport = async () => {
    if (!activePipelineId || !stages) return;
    setExporting(true);
    try {
      const effectiveOwner = showOwnerToggle && !showAll ? (user?.id ?? ownerFilter) : ownerFilter;
      let q = supabase
        .from("deals")
        .select("title, value_amount, probability_percent, status, created_at, pipeline_stage_id, company:companies(name), owner:users!deals_owner_user_id_fkey(first_name, last_name), primary_contact:contacts!deals_primary_contact_id_fkey(first_name, last_name)")
        .eq("pipeline_id", activePipelineId)
        .is("deleted_at", null);
      if (effectiveOwner && effectiveOwner !== "all") q = q.eq("owner_user_id", effectiveOwner);
      if (dateFrom) q = q.gte("expected_close_date", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("expected_close_date", format(dateTo, "yyyy-MM-dd"));
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      let exportData = data ?? [];
      if (eignungFilter !== "all") {
        exportData = exportData.filter((d: any) => (roadshowMap?.get(d.id) ?? "grau") === eignungFilter);
      }

      const pipelineName = pipelines?.find(p => p.id === activePipelineId)?.name ?? "";
      const stageMap = new Map(stages.map(s => [s.id, s.name]));

      exportToExcel(exportData, [
        { header: "Titel", accessor: (r: any) => r.title },
        { header: "Pipeline", accessor: () => pipelineName },
        { header: "Stage", accessor: (r: any) => stageMap.get(r.pipeline_stage_id) ?? "" },
        { header: "Wert", accessor: (r: any) => r.value_amount },
        { header: "Wahrscheinlichkeit %", accessor: (r: any) => r.probability_percent },
        { header: "Unternehmen", accessor: (r: any) => (r.company as any)?.name ?? "" },
        { header: "Kontakt", accessor: (r: any) => { const c = r.primary_contact as any; return c ? `${c.first_name} ${c.last_name}` : ""; } },
        { header: "Owner", accessor: (r: any) => { const o = r.owner as any; return o ? `${o.first_name} ${o.last_name}` : ""; } },
        { header: "Status", accessor: (r: any) => r.status },
        { header: "Erstellt am", accessor: (r: any) => r.created_at ? new Date(r.created_at).toLocaleDateString("de-DE") : "" },
      ], `deals_${todayString()}.xlsx`);
      toast({ title: `${exportData.length} Deals exportiert` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export fehlgeschlagen", description: err.message });
    } finally {
      setExporting(false);
    }
  };

  // Mobile stage selector state
  const [mobileStageId, setMobileStageId] = useState<string>("");
  const [stageChangeSheet, setStageChangeSheet] = useState<{ open: boolean; dealId: string; dealTitle: string; currentStageId: string }>({
    open: false, dealId: "", dealTitle: "", currentStageId: "",
  });

  // Lost reason dialog
  const [lostDialog, setLostDialog] = useState<{ open: boolean; dealId: string; dealTitle: string; stageId: string }>({
    open: false, dealId: "", dealTitle: "", stageId: "",
  });

  // Pipelines (live from DB, only those with at least 1 active deal)
  const { pipelines } = usePipelines({ onlyWithDeals: false });

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

  // Set initial mobile stage
  const effectiveMobileStageId = mobileStageId || stages?.[0]?.id || "";

  // Deals
  const { data: deals } = useQuery({
    queryKey: ["deals-board", activePipelineId, ownerFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("deals")
        .select("id, title, value_amount, currency, priority, pipeline_stage_id, status, company:companies(name), owner:users!deals_owner_user_id_fkey(first_name, last_name), primary_contact:contacts!deals_primary_contact_id_fkey(phone, mobile)")
        .eq("pipeline_id", activePipelineId)
        .is("deleted_at", null);

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

  // Filtered deals by eignung
  const filteredDeals = deals?.filter((d) => {
    if (eignungFilter === "all") return true;
    const eignung = roadshowMap?.get(d.id) ?? "grau";
    return eignung === eignungFilter;
  });

  // Move deal mutation
  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId, isWon }: { dealId: string; stageId: string; isWon: boolean }) => {
      if (isWon) {
        const { data, error } = await supabase.rpc("set_deal_won_and_create_project", {
          p_deal_id: dealId,
          p_winning_user_id: user?.id ?? "",
        });
        if (error) throw error;
        if (data) {
          const { data: project } = await supabase.from("projects").select("id, title").eq("id", data).maybeSingle();
          return project;
        }
        return null;
      }
      const { error } = await supabase.from("deals").update({ pipeline_stage_id: stageId }).eq("id", dealId);
      if (error) throw error;
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

  const handleMobileStageChange = (dealId: string, dealTitle: string, newStageId: string) => {
    const stage = stages?.find((s) => s.id === newStageId);
    if (!stage) return;
    if (stage.is_lost_stage) {
      setLostDialog({ open: true, dealId, dealTitle, stageId: newStageId });
      return;
    }
    moveDealMutation.mutate({ dealId, stageId: newStageId, isWon: stage.is_won_stage ?? false });
  };

  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    if (!canWriteDeals) { e.preventDefault(); return; }
    e.dataTransfer.setData("dealId", dealId);
  }, [canWriteDeals]);

  const handleDrop = useCallback((e: React.DragEvent, stageId: string) => {
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
  }, [stages, deals, moveDealMutation]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Group deals by stage
  const dealsByStage = new Map<string, typeof filteredDeals>();
  filteredDeals?.forEach((deal) => {
    const list = dealsByStage.get(deal.pipeline_stage_id) ?? [];
    list.push(deal);
    dealsByStage.set(deal.pipeline_stage_id, list);
  });

  const formatSum = (v: number) => eur(v);

  // Mobile: deals in selected stage
  const mobileDeals = filteredDeals?.filter((d) => d.pipeline_stage_id === effectiveMobileStageId) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-semibold text-foreground">Deals</h1>
          <PresenceAvatars users={onlineUsers} />
        </div>
        <div className="flex gap-2 w-full sm:w-auto items-center">
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
            <Download className="h-4 w-4" /> {exporting ? "Exportiert…" : "Exportieren"}
          </Button>
          {activePipelineId === "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e" && (
            leitfadenUrl ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => window.open(leitfadenUrl, "_blank")}
                  className="inline-flex items-center gap-1 border border-gray-300 text-blue-600 text-sm px-3 py-2 rounded-md hover:border-blue-400 hover:underline max-w-[220px]"
                  title={leitfadenName ?? undefined}
                >
                  <span aria-hidden>📎</span>
                  <span className="truncate">{leitfadenName}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLeitfadenDelete}
                  aria-label="Leitfaden löschen"
                  className="text-gray-400 hover:text-red-500 transition-colors p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLeitfaden}
                  className="border border-gray-300 text-gray-600 text-sm px-3 py-2 rounded-md hover:border-blue-400 transition-colors disabled:opacity-50"
                >
                  📎 {uploadingLeitfaden ? "Lädt…" : "Gesprächsleitfaden"}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept=".pdf,.docx,.pptx"
                  onChange={handleLeitfadenUpload}
                />
              </>
            )
          )}
          {canWriteDeals && (
            <Button onClick={() => setSheetOpen(true)} className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
              <Plus className="h-4 w-4" /> Neuer Deal
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-4">
        <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]"><SelectValue placeholder="Pipeline" /></SelectTrigger>
          <SelectContent>{pipelines?.map((p) => <SelectItem key={p.id} value={p.id} className="min-h-[44px]">{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Alle Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Owner</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={u.id} className="min-h-[44px]">{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!isMobile && (
          <div className="flex gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("flex-1 sm:w-[150px] min-h-[44px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd.MM.yy") : "Von"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("flex-1 sm:w-[150px] min-h-[44px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd.MM.yy") : "Bis"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
        )}
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Zeitraum zurücksetzen</Button>
        )}
        {showOwnerToggle && (
          <Button variant={showAll ? "secondary" : "outline"} size="sm" className="min-h-[44px]" onClick={() => { setShowAll(!showAll); if (!showAll) setOwnerFilter("all"); else setOwnerFilter(user?.id ?? "all"); }}>
            {showAll ? "Alle Deals" : "Meine Deals"}
          </Button>
        )}
        <Select value={eignungFilter} onValueChange={setEignungFilter}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Roadshow-Eignung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Eignungen</SelectItem>
            <SelectItem value="gruen">🟢 Geeignet</SelectItem>
            <SelectItem value="gelb">🟡 Eingeschränkt</SelectItem>
            <SelectItem value="rot">🔴 Ungeeignet</SelectItem>
            <SelectItem value="grau">⚪ Offen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Stage selector + card list */}
      {isMobile ? (
        <div className="flex-1 space-y-3">
          {stages && (
            <MobileStageSelector
              stages={stages}
              selectedStageId={effectiveMobileStageId}
              onStageChange={setMobileStageId}
            />
          )}
          <p className="text-[12px] text-muted-foreground">
            {mobileDeals.length} Deal{mobileDeals.length !== 1 ? "s" : ""} · {formatSum(mobileDeals.reduce((s, d) => s + (d.value_amount ?? 0), 0))}
          </p>
          <div className="space-y-2">
            {mobileDeals.map((deal) => {
              const company = deal.company as { name: string } | null;
              const owner = deal.owner as { first_name: string; last_name: string } | null;
              return (
                <MobileCard
                  key={deal.id}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                  title={deal.title}
                  subtitle={company?.name || undefined}
                  badge={deal.priority ? <span className={cn("h-2 w-2 rounded-full", deal.priority === "high" ? "bg-destructive" : deal.priority === "medium" ? "bg-warning" : "bg-muted-foreground")} /> : undefined}
                  rightContent={
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {deal.value_amount ? <span className="text-[13px] font-semibold text-foreground">{eur(deal.value_amount)}</span> : null}
                      {canWriteDeals && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setStageChangeSheet({ open: true, dealId: deal.id, dealTitle: deal.title, currentStageId: deal.pipeline_stage_id }); }}
                          className="flex items-center gap-1 text-[11px] text-primary font-medium"
                        >
                          <ArrowRightLeft className="h-3 w-3" /> Stage
                        </button>
                      )}
                    </div>
                  }
                />
              );
            })}
            {mobileDeals.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Deals in dieser Stage.</p>}
          </div>
        </div>
      ) : (
        /* Desktop: Kanban Board */
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2.5 min-w-max pb-4">
            {stages?.map((stage) => {
              const stageDeals = dealsByStage.get(stage.id) ?? [];
              const totalValue = stageDeals.reduce((sum, d) => sum + (d.value_amount ?? 0), 0);
              const bgClass = stage.is_won_stage ? "bg-success/5 border-success/20" : stage.is_lost_stage ? "bg-destructive/5 border-destructive/20" : "bg-[#D8DAE5] border-transparent";

              return (
                <div key={stage.id} className={cn("flex w-[200px] shrink-0 flex-col rounded-lg border p-1.5", bgClass)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, stage.id)}>
                  <div className="mb-1.5 px-0.5 h-[32px] flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold text-foreground">{stage.name}</h3>
                      <span className="text-[9px] font-medium text-muted-foreground">{stage.probability_percent}%</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-none">
                      {stageDeals.length} Deal{stageDeals.length !== 1 ? "s" : ""} · {formatSum(totalValue)}
                    </p>
                  </div>
                  <div className="flex-1 space-y-1.5 min-h-[40px]">
                    {stageDeals.map((deal) => {
                      const company = deal.company as { name: string } | null;
                      const owner = deal.owner as { first_name: string; last_name: string } | null;
                      const contact = deal.primary_contact as { phone: string | null; mobile: string | null } | null;
                      const dealPhone = contact?.phone || contact?.mobile || null;
                      return (
                        <DealCard
                          key={deal.id}
                          deal={{
                            id: deal.id, title: deal.title, company_name: company?.name ?? null,
                            value_amount: deal.value_amount, currency: deal.currency,
                            priority: deal.priority, owner_first_name: owner?.first_name ?? null,
                            owner_last_name: owner?.last_name ?? null,
                            phone: dealPhone,
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
      )}

      <CreateDealSheet open={sheetOpen} onOpenChange={handleSheetChange} defaultContactId={contactParam ?? undefined} />
      <LostReasonDialog
        dealId={lostDialog.dealId} dealTitle={lostDialog.dealTitle} stageId={lostDialog.stageId}
        open={lostDialog.open} onOpenChange={(open) => setLostDialog((p) => ({ ...p, open }))}
        onComplete={() => setLostDialog({ open: false, dealId: "", dealTitle: "", stageId: "" })}
      />
      {stages && (
        <StageChangeSheet
          open={stageChangeSheet.open}
          onOpenChange={(open) => setStageChangeSheet((p) => ({ ...p, open }))}
          stages={stages}
          currentStageId={stageChangeSheet.currentStageId}
          dealTitle={stageChangeSheet.dealTitle}
          onSelect={(stageId) => handleMobileStageChange(stageChangeSheet.dealId, stageChangeSheet.dealTitle, stageId)}
        />
      )}
    </div>
  );
}
