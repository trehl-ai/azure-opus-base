import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Search, Plus, MoreHorizontal, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileImages } from "@/hooks/useProfileImage";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ROLES = ["admin", "sales", "project_manager", "management", "read_only"] as const;
type Role = typeof ROLES[number];

const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  sales: "Sales",
  project_manager: "Projektmanager",
  management: "Management",
  read_only: "Nur Lesen",
};

const roleDescriptions: Record<Role, string> = {
  admin: "Vollzugriff auf alle Bereiche und Einstellungen",
  sales: "Zugriff auf Contacts, Companies und Deals",
  project_manager: "Zugriff auf Projects und Tasks",
  management: "Lesezugriff auf Dashboard, Deals und Projekte",
  read_only: "Nur lesender Zugriff auf definierte Bereiche",
};

const roleBadgeColors: Record<Role, string> = {
  admin: "bg-primary text-primary-foreground",
  sales: "bg-[#6366F1] text-white",
  project_manager: "bg-[#F59E0B] text-white",
  management: "bg-[#0EA5E9] text-white",
  read_only: "bg-[#8B93A7] text-white",
};

export default function UsersSettings() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState<any>(null);
  const [removeUser, setRemoveUser] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", first_name: "", last_name: "", role: "sales" as Role });
  const [newRole, setNewRole] = useState<Role>("sales");

  const isAdmin = currentUser?.role === "admin";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const adminCount = users.filter(u => u.role === "admin" && u.is_active).length;
  const userIds = users.map(u => u.id);
  const { data: profileImages = {} } = useProfileImages(userIds);

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const callAdminFn = async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-users", {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (res.error) {
      const response = (res.error as { context?: Response }).context;
      let detailedMessage: string | undefined;

      if (response) {
        try {
          const payload = await response.clone().json();
          if (typeof payload?.error === "string" && payload.error.trim()) {
            detailedMessage = payload.error;
          }
        } catch {
          // ignore json parse errors
        }

        if (!detailedMessage) {
          try {
            const text = await response.clone().text();
            if (text.trim()) {
              detailedMessage = text;
            }
          } catch {
            // ignore text parse errors
          }
        }
      }

      throw new Error(detailedMessage || res.error.message || "Fehler");
    }

    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const inviteMutation = useMutation({
    mutationFn: () => callAdminFn({ action: "invite", ...inviteForm }),
    onSuccess: () => {
      toast.success(`Einladung wurde an ${inviteForm.email} gesendet`);
      setInviteOpen(false);
      setInviteForm({ email: "", first_name: "", last_name: "", role: "sales" });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleChangeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", roleChangeUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rolle erfolgreich geändert");
      setRoleChangeUser(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userToRemove: { id: string; email: string }) =>
      callAdminFn({ action: "delete", user_id: userToRemove.id, auth_user_email: userToRemove.email }),
    onSuccess: () => {
      toast.success("Benutzer wurde entfernt");
      setRemoveUser(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = async (u: any) => {
    if (u.is_active && u.role === "admin" && adminCount <= 1) {
      toast.error("Es muss mindestens ein Administrator verbleiben.");
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({ is_active: !u.is_active })
      .eq("id", u.id);
    if (error) toast.error(error.message);
    else {
      toast.success(u.is_active ? "Benutzer deaktiviert" : "Benutzer reaktiviert");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    }
  };

  if (!isAdmin) {
    return (
      <Card className="rounded-2xl max-w-2xl">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">Kein Zugriff</h2>
          <p className="text-sm text-muted-foreground">
            Du benötigst Administrator-Rechte, um die Benutzerverwaltung zu nutzen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Benutzerverwaltung</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verwalte alle Benutzer dieses Workspaces, lade neue Mitglieder ein und passe Rollen an.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nach Name oder E-Mail suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Benutzer einladen
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Benutzer</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mitglied seit</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Keine Benutzer gefunden</TableCell></TableRow>
            ) : filteredUsers.map(u => {
              const initials = (u.first_name?.[0] ?? "") + (u.last_name?.[0] ?? "");
              const isSelf = u.id === currentUser?.id;
              const isLastAdmin = u.role === "admin" && adminCount <= 1;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {profileImages[u.id] ? (
                          <AvatarImage src={profileImages[u.id]} alt="Profil" className="object-cover" />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            {initials.toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleBadgeColors[u.role as Role] ?? "bg-muted text-muted-foreground"}>
                      {roleLabels[u.role as Role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "secondary"}
                      className={u.is_active ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}>
                      {u.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(u.created_at), "dd.MM.yyyy")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isSelf}
                          onClick={() => { setRoleChangeUser(u); setNewRole(u.role as Role); }}
                        >
                          Rolle ändern
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isSelf || isLastAdmin}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? "Deaktivieren" : "Reaktivieren"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isSelf || isLastAdmin}
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoveUser(u)}
                        >
                          Aus Workspace entfernen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Benutzer einladen</DialogTitle>
            <DialogDescription>
              Der Benutzer erhält eine E-Mail mit einem Einladungslink. Nach dem ersten Login ist sein Profil aktiv.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>E-Mail-Adresse *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname *</Label>
                <Input value={inviteForm.first_name} onChange={e => setInviteForm(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nachname *</Label>
                <Input value={inviteForm.last_name} onChange={e => setInviteForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={inviteForm.role} onValueChange={(v: Role) => setInviteForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{roleDescriptions[inviteForm.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteForm.email || !inviteForm.first_name || !inviteForm.last_name}
            >
              {inviteMutation.isPending ? "Senden…" : "Einladung senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeUser} onOpenChange={open => !open && setRoleChangeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle von {roleChangeUser?.first_name} {roleChangeUser?.last_name} ändern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Aktuelle Rolle</Label>
              <p className="text-sm"><Badge className={roleBadgeColors[roleChangeUser?.role as Role] ?? ""}>{roleLabels[roleChangeUser?.role as Role] ?? roleChangeUser?.role}</Badge></p>
            </div>
            <div className="space-y-2">
              <Label>Neue Rolle</Label>
              <Select value={newRole} onValueChange={(v: Role) => setNewRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{roleDescriptions[newRole]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeUser(null)}>Abbrechen</Button>
            <Button onClick={() => roleChangeMutation.mutate()} disabled={roleChangeMutation.isPending}>
              {roleChangeMutation.isPending ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeUser} onOpenChange={open => !open && setRemoveUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer entfernen</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du {removeUser?.first_name} {removeUser?.last_name} aus dem Workspace entfernen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
            Alle von diesem Benutzer erstellten Datensätze (Companies, Contacts, Deals, Projekte) bleiben erhalten. Owner-Zuweisungen werden auf „Kein Owner" gesetzt.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeUser && removeMutation.mutate({ id: removeUser.id, email: removeUser.email })}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Entfernen…" : "Endgültig entfernen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
