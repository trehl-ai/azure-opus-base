import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConflictWarningProps {
  onForceOverwrite: () => void;
  onReload: () => void;
}

export function ConflictWarning({ onForceOverwrite, onReload }: ConflictWarningProps) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Dieser Datensatz wurde zwischenzeitlich von einem anderen Benutzer geändert.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Deine Änderungen könnten bestehende Daten überschreiben.
          </p>
        </div>
      </div>
      <div className="flex gap-2 ml-8">
        <Button size="sm" variant="outline" onClick={onForceOverwrite}>
          Trotzdem speichern
        </Button>
        <Button size="sm" variant="default" onClick={onReload}>
          Aktuelle Version laden
        </Button>
      </div>
    </div>
  );
}
