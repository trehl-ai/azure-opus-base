import { useToast } from "@/hooks/use-toast";

// Roadshow-Details werden derzeit nicht persistiert — die zugehörige Tabelle
// existiert nicht im DB-Schema. Hook gibt einen No-Op zurück, sodass die
// RoadshowChecklist-Komponente weiter rendern kann (Form-State bleibt lokal),
// aber Save-Versuche zeigen einen klaren Hinweis.
export function useRoadshowDetails(_dealId: string | undefined) {
  const { toast } = useToast();
  return {
    data: null as null,
    isLoading: false,
    save: (_fields: Record<string, any>) => {
      toast({
        title: "Roadshow-Checkliste",
        description: "Persistenz ist derzeit nicht aktiv — die Eingaben sind nur lokal sichtbar.",
      });
    },
    isSaving: false,
  };
}
