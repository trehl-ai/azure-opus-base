import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EINZELMAILS_OFFEN_KEY } from "@/hooks/queries/useEinzelmailsOffen";

/** Antwort von einzelmail_freigeben / einzelmail_zurueckstellen (jsonb). */
type RpcAntwort = { ok: boolean; status: string } | null;

/** Ruft eine der beiden Freigabe-RPCs. ok=false (z. B. nicht_im_entwurf_oder_unbekannt,
 *  nicht_offen_oder_unbekannt) ist ein FEHLER, kein stiller Erfolg. */
async function rufen(fn: string, args: Record<string, unknown>): Promise<string> {
  // (supabase as any): types.ts ist Lovable-generiert und kennt die Einzelmail-RPCs nicht.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  const antwort = data as RpcAntwort;
  if (!antwort?.ok) throw new Error(antwort?.status ?? "keine Antwort von der Datenbank");
  return antwort.status;
}

function useEinzelmailAktion<V>(
  aufruf: (v: V) => Promise<string>,
  titel: { ok: string; fehler: string },
) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: aufruf,
    onSuccess: () => toast({ title: titel.ok }),
    onError: (err: Error) => toast({ variant: "destructive", title: titel.fehler, description: err.message }),
    onSettled: () => qc.invalidateQueries({ queryKey: EINZELMAILS_OFFEN_KEY }),
  });
}

export function useEinzelmailFreigeben() {
  return useEinzelmailAktion(
    (id: string) => rufen("einzelmail_freigeben", { p_id: id }),
    { ok: "Einzelmail freigegeben", fehler: "Freigabe fehlgeschlagen" },
  );
}

export function useEinzelmailZurueckstellen() {
  return useEinzelmailAktion(
    ({ id, grund }: { id: string; grund: string }) => rufen("einzelmail_zurueckstellen", { p_id: id, p_grund: grund }),
    { ok: "Einzelmail zurückgestellt", fehler: "Zurückstellen fehlgeschlagen" },
  );
}
