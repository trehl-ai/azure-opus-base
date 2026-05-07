import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

// Workspace-Settings-Tabelle existiert (noch) nicht im DB-Schema.
// Hook gibt einen leeren Map zurück, damit Consumer mit `?? defaultValue`
// arbeiten können statt 404-Fehler zu produzieren.
export function useWorkspaceSettings() {
  return useQuery({
    queryKey: queryKeys.workspaceSettings.all,
    queryFn: async (): Promise<Record<string, string>> => ({}),
    staleTime: Infinity,
  });
}
