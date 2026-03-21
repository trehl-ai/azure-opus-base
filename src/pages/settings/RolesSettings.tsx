import { useAuth } from "@/contexts/AuthContext";
import { permissionMatrix } from "@/lib/permissions";
import { Check, Minus, ShieldAlert, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const roles = [
  { key: "admin", label: "Administrator", color: "bg-primary text-primary-foreground" },
  { key: "sales", label: "Sales", color: "bg-[#6366F1] text-white" },
  { key: "project_manager", label: "Projektmanager", color: "bg-[#F59E0B] text-white" },
  { key: "management", label: "Management", color: "bg-[#0EA5E9] text-white" },
  { key: "read_only", label: "Nur Lesen", color: "bg-[#8B93A7] text-white" },
] as const;

const moduleRows: { module: string; label: string; action: "read" | "write" }[] = [
  { module: "dashboard", label: "Dashboard", action: "read" },
  { module: "companies", label: "Companies – Lesen", action: "read" },
  { module: "companies", label: "Companies – Schreiben", action: "write" },
  { module: "contacts", label: "Contacts – Lesen", action: "read" },
  { module: "contacts", label: "Contacts – Schreiben", action: "write" },
  { module: "deals", label: "Deals – Lesen", action: "read" },
  { module: "deals", label: "Deals – Schreiben", action: "write" },
  { module: "projects", label: "Projects – Lesen", action: "read" },
  { module: "projects", label: "Projects – Schreiben", action: "write" },
  { module: "tasks", label: "Tasks – Lesen", action: "read" },
  { module: "tasks", label: "Tasks – Schreiben", action: "write" },
  { module: "csv_import", label: "CSV Import", action: "read" },
  { module: "email_intake", label: "E-Mail Intake", action: "read" },
  { module: "settings", label: "Einstellungen", action: "read" },
  { module: "user_management", label: "Benutzerverwaltung", action: "read" },
];

function has(module: string, action: "read" | "write", role: string): boolean {
  const mod = permissionMatrix[module];
  return mod?.[action]?.includes(role as any) ?? false;
}

export default function RolesSettings() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <Card className="rounded-2xl max-w-2xl">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">Kein Zugriff</h2>
          <p className="text-sm text-muted-foreground">
            Du benötigst Administrator-Rechte, um die Rollen-Übersicht einzusehen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Rollen & Rechte</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Übersicht über die verfügbaren Rollen und ihre Zugriffsrechte im CRM.
        </p>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Bereich</TableHead>
              {roles.map(r => (
                <TableHead key={r.key} className="text-center">
                  <Badge className={r.color}>{r.label}</Badge>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleRows.map((row, i) => (
              <TableRow key={row.label} className={i % 2 === 1 ? "bg-[#F9FAFB]" : ""}>
                <TableCell className="font-medium text-sm">{row.label}</TableCell>
                {roles.map(r => (
                  <TableCell key={r.key} className="text-center">
                    {has(row.module, row.action, r.key) ? (
                      <Check className="inline-block h-5 w-5 text-[#22C55E]" />
                    ) : (
                      <Minus className="inline-block h-5 w-5 text-[#E7EAF3]" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          Die Rechtevergabe erfolgt über die Rollenzuweisung in der Benutzerverwaltung. Individuelle Berechtigungen pro Benutzer sind im aktuellen MVP nicht vorgesehen.
        </p>
      </div>
    </div>
  );
}
