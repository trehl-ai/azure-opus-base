import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConflictState {
  hasConflict: boolean;
  checking: boolean;
}

/**
 * Hook for optimistic conflict detection on edit forms.
 * Call captureTimestamp() when opening an edit form.
 * Call checkConflict() before saving — returns true if conflict detected.
 */
export function useConflictCheck(table: string, id: string) {
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState>({ hasConflict: false, checking: false });

  const captureTimestamp = useCallback(async () => {
    setConflict({ hasConflict: false, checking: false });
    const { data } = await supabase
      .from(table as any)
      .select("updated_at")
      .eq("id", id)
      .single();
    if (data) setOpenedAt((data as any).updated_at);
  }, [table, id]);

  const checkConflict = useCallback(async (): Promise<boolean> => {
    if (!openedAt) return false;
    setConflict({ hasConflict: false, checking: true });

    const { data } = await supabase
      .from(table as any)
      .select("updated_at")
      .eq("id", id)
      .single();

    const dbUpdatedAt = (data as any)?.updated_at;
    if (dbUpdatedAt && dbUpdatedAt !== openedAt) {
      setConflict({ hasConflict: true, checking: false });
      return true;
    }

    setConflict({ hasConflict: false, checking: false });
    return false;
  }, [table, id, openedAt]);

  const dismissConflict = useCallback(() => {
    setConflict({ hasConflict: false, checking: false });
  }, []);

  return {
    captureTimestamp,
    checkConflict,
    dismissConflict,
    hasConflict: conflict.hasConflict,
    checking: conflict.checking,
  };
}
