import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { usePermission } from "@/hooks/usePermission";
import { useUsers } from "@/hooks/useUsers";
import { useIsMobile } from "@/hooks/use-mobile";
import { CompanyStatusBadge } from "@/components/companies/CompanyStatusBadge";
import { CreateCompanySheet } from "@/components/companies/CreateCompanySheet";
import { MobileCard } from "@/components/shared/MobileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel, todayString } from "@/lib/excelExport";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const statusFilterOptions = [
  { value: "all", label: "Alle Status" },
  { value: "prospect", label: "Prospect" },
  { value: "active_customer", label: "Active Customer" },
  { value: "inactive", label: "Inactive" },
  { value: "partner", label: "Partner" },
];

export default function Companies() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { canWrite } = usePermission();
  const canWriteCompanies = canWrite("companies");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: users } = useUsers();
  const { data, isLoading } = useCompanies({
    search,
    status: statusFilter,
    ownerUserId: ownerFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const companies = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-section-title text-foreground">Companies</h1>
        {canWriteCompanies && (
          <Button onClick={() => setSheetOpen(true)} className="gap-2 w-full sm:w-auto min-h-[44px]">
            <Plus className="h-4 w-4" /> Neue Company
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Suche nach Firmenname..." className="pl-10 rounded-full min-h-[44px]" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((o) => <SelectItem key={o.value} value={o.value} className="min-h-[44px]">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Alle Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">Alle Owner</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={u.id} className="min-h-[44px]">{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Card List */}
      {isMobile ? (
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-4 w-40 rounded bg-muted mb-2" />
                <div className="h-3 w-28 rounded bg-muted" />
              </div>
            ))
          ) : companies.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Keine Companies gefunden.</p>
          ) : (
            companies.map((company) => {
              const owner = company.owner as { id: string; first_name: string; last_name: string } | null;
              const initials = company.name.substring(0, 2).toUpperCase();
              return (
                <MobileCard
                  key={company.id}
                  onClick={() => navigate(`/companies/${company.id}`)}
                  initials={initials}
                  title={company.name}
                  subtitle={[company.industry, company.city].filter(Boolean).join(" · ") || undefined}
                  badge={<CompanyStatusBadge status={company.status} />}
                  meta={owner ? <p className="text-[12px] text-muted-foreground">Owner: {owner.first_name} {owner.last_name[0]}.</p> : undefined}
                />
              );
            })
          )}
        </div>
      ) : (
        /* Desktop Table */
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-label font-semibold">Firmenname</TableHead>
                <TableHead className="text-label font-semibold">Branche</TableHead>
                <TableHead className="text-label font-semibold">Stadt</TableHead>
                <TableHead className="text-label font-semibold">Status</TableHead>
                <TableHead className="text-label font-semibold">Owner</TableHead>
                <TableHead className="text-label font-semibold">Erstellt am</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, c) => <TableCell key={c}><div className="h-4 w-24 animate-pulse rounded bg-[hsl(228,33%,91%)]" /></TableCell>)}
                  </TableRow>
                ))
              ) : companies.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Keine Companies gefunden.</TableCell></TableRow>
              ) : (
                companies.map((company) => {
                  const owner = company.owner as { id: string; first_name: string; last_name: string } | null;
                  return (
                    <TableRow key={company.id} className="cursor-pointer h-[52px] hover:bg-muted/50 transition-colors" onClick={() => navigate(`/companies/${company.id}`)}>
                      <TableCell className="text-body font-medium text-foreground">{company.name}</TableCell>
                      <TableCell className="text-body text-muted-foreground">{company.industry ?? "–"}</TableCell>
                      <TableCell className="text-body text-muted-foreground">{company.city ?? "–"}</TableCell>
                      <TableCell><CompanyStatusBadge status={company.status} /></TableCell>
                      <TableCell className="text-body text-muted-foreground">{owner ? `${owner.first_name} ${owner.last_name}` : "–"}</TableCell>
                      <TableCell className="text-body text-muted-foreground">{formatDate(company.created_at)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-2">
          <p className="text-label text-muted-foreground">{totalCount} Ergebnis{totalCount !== 1 ? "se" : ""} · Seite {page} von {totalPages}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <CreateCompanySheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
