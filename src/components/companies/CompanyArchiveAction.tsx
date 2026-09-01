import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Undo2 } from "lucide-react";

const NO_PERMISSION =
  "Keine Berechtigung zum Archivieren. Bitte Tomi ansprechen.";

/**
 * Ein UPDATE, das die RLS-USING-Klausel nicht erfuellt, ist KEIN Fehler —
 * PostgREST meldet 204 und null betroffene Zeilen. Ohne .select() sieht eine
 * abgelehnte Archivierung deshalb aus wie ein Erfolg. Wir lesen die betroffene
 * Zeile zurueck und behandeln "0 Zeilen" wie 42501.
 */
async function updateDeletedAt(id: string, value: string | null) {
  const { data, error } = await supabase
    .from("companies")
    .update({ deleted_at: value })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "42501") throw new Error(NO_PERMISSION);
    throw error;
  }
  if (!data || data.length === 0) throw new Error(NO_PERMISSION);
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["companies"] });
  qc.invalidateQueries({ queryKey: ["companies-total"] });
  qc.invalidateQueries({ queryKey: ["company-filter-options"] });
  qc.invalidateQueries({ queryKey: ["company", id] });
}

interface ActiveDeal {
  id: string;
  title: string;
  status: string;
}

interface Props {
  companyId: string;
  companyName: string;
  /** true = Firma ist archiviert -> "Wiederherstellen", sonst "Archivieren" */
  archived: boolean;
  variant?: "icon" | "button";
  /** laeuft nach erfolgreichem Schreiben, z. B. Navigation auf der Detailseite */
  onDone?: () => void;
}

export function CompanyArchiveAction({
  companyId,
  companyName,
  archived,
  variant = "icon",
  onDone,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deals, setDeals] = useState<ActiveDeal[] | null>(null);
  const [checking, setChecking] = useState(false);

  // Archivieren = Soft-Delete (deleted_at setzen) -> RLS companies_update =
  // can_write_deals() (admin/management/projektmanager). Hartes DELETE bleibt
  // per companies_delete auf is_admin() beschraenkt und wird hier NICHT angefasst.
  const archiveMutation = useMutation({
    mutationFn: () => updateDeletedAt(companyId, new Date().toISOString()),
    onSuccess: () => {
      toast({ title: "Firma archiviert" });
      invalidate(qc, companyId);
      setOpen(false);
      onDone?.();
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Archivieren fehlgeschlagen", description: err.message }),
  });

  // Wiederherstellen ist nicht destruktiv -> ohne Bestaetigungsdialog.
  const restoreMutation = useMutation({
    mutationFn: () => updateDeletedAt(companyId, null),
    onSuccess: () => {
      toast({ title: "Firma wiederhergestellt" });
      invalidate(qc, companyId);
      onDone?.();
    },
    onError: (err: Error) =>
      toast({
        variant: "destructive",
        title: "Wiederherstellen fehlgeschlagen",
        description: err.message === NO_PERMISSION
          ? "Keine Berechtigung zum Wiederherstellen. Bitte Tomi ansprechen."
          : err.message,
      }),
  });

  const openDialog = async () => {
    setChecking(true);
    setDeals(null);
    setOpen(true);
    // Aktive Deals der Firma: sie bleiben bestehen und auf dem Board sichtbar —
    // der Dialog nennt sie nur, damit niemand ueberrascht wird.
    const { data, error } = await supabase
      .from("deals")
      .select("id, title, status")
      .eq("company_id", companyId)
      .is("deleted_at", null);
    setDeals(error ? [] : ((data ?? []) as ActiveDeal[]));
    setChecking(false);
  };

  if (archived) {
    return (
      <Button
        variant="outline"
        size={variant === "icon" ? "sm" : "default"}
        className="gap-1.5"
        disabled={restoreMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          restoreMutation.mutate();
        }}
      >
        <Undo2 className="h-4 w-4" />
        {restoreMutation.isPending ? "Stellt wieder her…" : "Wiederherstellen"}
      </Button>
    );
  }

  const dealList = deals ?? [];
  const shown = dealList.slice(0, 5);

  return (
    <>
      <Button
        variant="outline"
        size={variant === "icon" ? "sm" : "default"}
        className="gap-1.5"
        aria-label="Archivieren"
        title="Archivieren"
        onClick={(e) => {
          e.stopPropagation();
          void openDialog();
        }}
      >
        <Archive className="h-4 w-4" />
        {variant === "button" ? "Archivieren" : null}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Firma archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {checking ? (
                `Firma ${companyName} wird geprüft…`
              ) : dealList.length === 0 ? (
                `Firma ${companyName} archivieren? Sie verschwindet aus der Liste und kann jederzeit wiederhergestellt werden.`
              ) : (
                <>
                  {`Firma ${companyName} hat ${dealList.length} aktive Deal${dealList.length === 1 ? "" : "s"}: `}
                  {shown.map((d) => d.title).join(", ")}
                  {dealList.length > shown.length ? ` und ${dealList.length - shown.length} weitere` : ""}
                  {". Die Deals bleiben bestehen und weiterhin auf dem Board sichtbar. Trotzdem archivieren?"}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={checking || archiveMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                archiveMutation.mutate();
              }}
            >
              {archiveMutation.isPending ? "Archiviert…" : "Archivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
