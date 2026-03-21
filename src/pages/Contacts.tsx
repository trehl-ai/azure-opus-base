import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts } from "@/hooks/useContacts";
import { useUsers } from "@/hooks/useUsers";
import { usePermission } from "@/hooks/usePermission";
import { ContactStatusBadge } from "@/components/contacts/ContactStatusBadge";
import { CreateContactSheet } from "@/components/contacts/CreateContactSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

const statusFilterOptions = [
  { value: "all", label: "Alle Status" },
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function Contacts() {
  const navigate = useNavigate();
  const { canWrite } = usePermission();
  const canWriteContacts = canWrite("contacts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: users } = useUsers();
  const { data, isLoading } = useContacts({
    search,
    status: statusFilter,
    ownerUserId: ownerFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const contacts = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getPrimaryCompany = (contact: (typeof contacts)[0]) => {
    const links = contact.company_contacts as Array<{
      is_primary: boolean | null;
      company: { id: string; name: string } | null;
    }> | null;
    if (!links || links.length === 0) return null;
    const primary = links.find((l) => l.is_primary);
    return (primary ?? links[0])?.company ?? null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-section-title text-foreground">Contacts</h1>
        {canWriteContacts && (
          <Button onClick={() => setSheetOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Contact
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Suche nach Name oder E-Mail..."
            className="pl-10 rounded-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Owner</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-label font-semibold">Name</TableHead>
              <TableHead className="text-label font-semibold">E-Mail</TableHead>
              <TableHead className="text-label font-semibold">Telefon</TableHead>
              <TableHead className="text-label font-semibold">Unternehmen</TableHead>
              <TableHead className="text-label font-semibold">Position</TableHead>
              <TableHead className="text-label font-semibold">Status</TableHead>
              <TableHead className="text-label font-semibold">Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, c) => (
                    <TableCell key={c}><div className="h-4 w-24 animate-pulse rounded bg-[hsl(228,33%,91%)]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : contacts.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Keine Contacts gefunden.</TableCell></TableRow>
            ) : (
              contacts.map((contact) => {
                const owner = contact.owner as { id: string; first_name: string; last_name: string } | null;
                const company = getPrimaryCompany(contact);
                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer h-[52px] hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <TableCell className="text-body font-medium text-foreground">
                      {contact.first_name} {contact.last_name}
                    </TableCell>
                    <TableCell className="text-body text-muted-foreground">{contact.email ?? "–"}</TableCell>
                    <TableCell className="text-body text-muted-foreground">{contact.phone ?? contact.mobile ?? "–"}</TableCell>
                    <TableCell className="text-body text-muted-foreground">{company?.name ?? "–"}</TableCell>
                    <TableCell className="text-body text-muted-foreground">{contact.job_title ?? "–"}</TableCell>
                    <TableCell><ContactStatusBadge status={contact.status} /></TableCell>
                    <TableCell className="text-body text-muted-foreground">
                      {owner ? `${owner.first_name} ${owner.last_name}` : "–"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-label text-muted-foreground">
              {totalCount} Ergebnis{totalCount !== 1 ? "se" : ""} · Seite {page} von {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateContactSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
