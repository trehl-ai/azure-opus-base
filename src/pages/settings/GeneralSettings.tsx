import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const currencies = ["EUR", "USD", "CHF", "GBP"];
const dateFormats = ["DD.MM.YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
const timezones = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "UTC"];

export default function GeneralSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Workspace settings
  const [workspaceName, setWorkspaceName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  // Sales settings
  const [defaultPipeline, setDefaultPipeline] = useState("");
  const [defaultOwner, setDefaultOwner] = useState("");
  const [savingSales, setSavingSales] = useState(false);

  // Danger zone
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [resetInput, setResetInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workspace_settings").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Deleted items (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const { data: deletedCompanies = [] } = useQuery({
    queryKey: ["deleted-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, deleted_at").not("deleted_at", "is", null).gte("deleted_at", thirtyDaysAgoISO).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: deletedContacts = [] } = useQuery({
    queryKey: ["deleted-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, first_name, last_name, deleted_at").not("deleted_at", "is", null).gte("deleted_at", thirtyDaysAgoISO).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: deletedDeals = [] } = useQuery({
    queryKey: ["deleted-deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("id, title, deleted_at").not("deleted_at", "is", null).gte("deleted_at", thirtyDaysAgoISO).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: deletedProjects = [] } = useQuery({
    queryKey: ["deleted-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, deleted_at").not("deleted_at", "is", null).gte("deleted_at", thirtyDaysAgoISO).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings.length > 0) {
      const get = (key: string) => settings.find(s => s.key === key)?.value ?? "";
      setWorkspaceName(get("workspace_name") || "Mein CRM");
      setCurrency(get("default_currency") || "EUR");
      setDateFormat(get("date_format") || "DD.MM.YYYY");
      setTimezone(get("timezone") || "Europe/Berlin");
      setDefaultPipeline(get("default_deal_pipeline_id"));
      setDefaultOwner(get("default_deal_owner_id"));
    }
  }, [settings]);

  const upsertSettings = async (entries: { key: string; value: string }[]) => {
    for (const entry of entries) {
      const { error } = await supabase
        .from("workspace_settings")
        .upsert(
          { key: entry.key, value: entry.value, updated_by_user_id: user?.id, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) throw error;
    }
    queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
  };

  const saveWorkspace = async () => {
    setSavingWorkspace(true);
    try {
      await upsertSettings([
        { key: "workspace_name", value: workspaceName },
        { key: "default_currency", value: currency },
        { key: "date_format", value: dateFormat },
        { key: "timezone", value: timezone },
      ]);
      toast.success("Workspace-Einstellungen gespeichert");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingWorkspace(false);
    }
  };

  const saveSales = async () => {
    setSavingSales(true);
    try {
      await upsertSettings([
        { key: "default_deal_pipeline_id", value: defaultPipeline },
        { key: "default_deal_owner_id", value: defaultOwner },
      ]);
      toast.success("Vertriebs-Einstellungen gespeichert");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSales(false);
    }
  };

  const callDangerZone = async (action: string) => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("danger-zone", {
        body: { action },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(action === "delete_test_data" ? "Testdaten gelöscht" : "Datenbank zurückgesetzt");
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setResetConfirmOpen(false);
      setDeleteInput("");
      setResetInput("");
    }
  };

  const restoreMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table as any).update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Eintrag wiederhergestellt");
      queryClient.invalidateQueries({ queryKey: [`deleted-${vars.table}`] });
      queryClient.invalidateQueries({ queryKey: [vars.table] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Endgültig gelöscht");
      queryClient.invalidateQueries({ queryKey: [`deleted-${vars.table}`] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (user?.role !== "admin") {
    return (
      <Card className="rounded-2xl max-w-2xl">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">Kein Zugriff</h2>
          <p className="text-sm text-muted-foreground">Du benötigst Administrator-Rechte.</p>
        </CardContent>
      </Card>
    );
  }

  const totalDeleted = deletedCompanies.length + deletedContacts.length + deletedDeals.length + deletedProjects.length;

  const renderDeletedTable = (items: { id: string; name?: string; title?: string; first_name?: string; last_name?: string; deleted_at: string | null }[], table: string) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Keine gelöschten Einträge.</p>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Gelöscht am</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.name ?? item.title ?? `${item.first_name} ${item.last_name}`}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {item.deleted_at ? format(new Date(item.deleted_at), "dd.MM.yyyy HH:mm") : "–"}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreMutation.mutate({ table, id: item.id })}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Wiederherstellen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => permanentDeleteMutation.mutate({ table, id: item.id })}
                  disabled={permanentDeleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Endgültig löschen
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Allgemein</h2>
        <p className="text-sm text-muted-foreground mt-1">Grundlegende Workspace- und CRM-Einstellungen.</p>
      </div>

      {/* Card 1 – Workspace */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Workspace-Name *</Label>
            <Input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Standard-Währung</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datumsformat</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dateFormats.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zeitzone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timezones.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={saveWorkspace} disabled={savingWorkspace || !workspaceName.trim()}>
              {savingWorkspace ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 – Vertrieb */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Vertrieb</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Standard-Pipeline</Label>
            <Select value={defaultPipeline} onValueChange={setDefaultPipeline}>
              <SelectTrigger><SelectValue placeholder="Pipeline wählen…" /></SelectTrigger>
              <SelectContent>
                {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Standard-Owner bei neuen Deals</Label>
            <Select value={defaultOwner} onValueChange={setDefaultOwner}>
              <SelectTrigger><SelectValue placeholder="Owner wählen…" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2">
            <Button onClick={saveSales} disabled={savingSales}>
              {savingSales ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 – Gelöschte Einträge */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> Gelöschte Einträge
            {totalDeleted > 0 && (
              <Badge variant="secondary" className="ml-2">{totalDeleted}</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Einträge der letzten 30 Tage. Wiederherstellen oder endgültig löschen.</p>
        </CardHeader>
        <CardContent>
          {totalDeleted === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine gelöschten Einträge in den letzten 30 Tagen.</p>
          ) : (
            <Tabs defaultValue="companies">
              <TabsList className="mb-4">
                <TabsTrigger value="companies">Companies ({deletedCompanies.length})</TabsTrigger>
                <TabsTrigger value="contacts">Contacts ({deletedContacts.length})</TabsTrigger>
                <TabsTrigger value="deals">Deals ({deletedDeals.length})</TabsTrigger>
                <TabsTrigger value="projects">Projects ({deletedProjects.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="companies">{renderDeletedTable(deletedCompanies, "companies")}</TabsContent>
              <TabsContent value="contacts">{renderDeletedTable(deletedContacts, "contacts")}</TabsContent>
              <TabsContent value="deals">{renderDeletedTable(deletedDeals, "deals")}</TabsContent>
              <TabsContent value="projects">{renderDeletedTable(deletedProjects, "projects")}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Card 4 – Danger Zone */}
      <Card className="rounded-2xl border-destructive">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Gefährlicher Bereich
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Alle Testdaten löschen</p>
            <p className="text-sm text-muted-foreground">
              Löscht alle manuell angelegten Datensätze (Companies, Contacts, Deals, Projekte, Tasks). Nicht wiederherstellbar.
            </p>
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteConfirmOpen(true)}>
              Testdaten löschen
            </Button>
          </div>
          <div className="border-t pt-6 space-y-2">
            <p className="text-sm font-medium">Datenbank zurücksetzen</p>
            <p className="text-sm text-muted-foreground">
              Löscht ALLE Daten inklusive Benutzer, Einstellungen und importierten Daten. Nicht wiederherstellbar.
            </p>
            <Button variant="destructive" onClick={() => setResetConfirmOpen(true)}>
              Alles zurücksetzen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete test data confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={o => { if (!o) { setDeleteConfirmOpen(false); setDeleteInput(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Testdaten löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion löscht alle Companies, Contacts, Deals, Projekte und Tasks. Tippe <strong>LÖSCHEN</strong> ein, um zu bestätigen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="LÖSCHEN" />
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteInput !== "LÖSCHEN" || deleting}
              onClick={() => callDangerZone("delete_test_data")}
            >
              {deleting ? "Lösche…" : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset all confirmation */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={o => { if (!o) { setResetConfirmOpen(false); setResetInput(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Datenbank zurücksetzen</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion löscht ALLE Daten. Tippe den Workspace-Namen <strong>{workspaceName}</strong> ein, um zu bestätigen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={resetInput} onChange={e => setResetInput(e.target.value)} placeholder={workspaceName} />
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetInput !== workspaceName || deleting}
              onClick={() => callDangerZone("reset_all")}
            >
              {deleting ? "Setze zurück…" : "Alles zurücksetzen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
