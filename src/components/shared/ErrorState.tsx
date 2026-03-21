import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

interface ErrorStateProps {
  error?: Error | null;
  message?: string;
  queryKey?: readonly unknown[];
}

export function ErrorState({ error, message, queryKey }: ErrorStateProps) {
  const qc = useQueryClient();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        {message ?? "Daten konnten nicht geladen werden"}
      </h2>
      {error?.message && (
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          {error.message}
        </p>
      )}
      <Button
        variant="outline"
        onClick={() => {
          if (queryKey) {
            qc.refetchQueries({ queryKey });
          } else {
            qc.refetchQueries();
          }
        }}
      >
        Erneut versuchen
      </Button>
    </div>
  );
}
