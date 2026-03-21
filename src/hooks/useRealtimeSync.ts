import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("crm-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, (payload: Payload) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all });
        const id = (payload.new as any)?.id;
        if (id) qc.invalidateQueries({ queryKey: queryKeys.deals.detail(id) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, (payload: Payload) => {
        qc.invalidateQueries({ queryKey: queryKeys.projects.all });
        const id = (payload.new as any)?.id;
        if (id) qc.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload: Payload) => {
        qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
        const projectId = (payload.new as any)?.project_id;
        if (projectId) {
          qc.invalidateQueries({ queryKey: queryKeys.projects.tasks(projectId) });
          qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_activities" }, (payload: Payload) => {
        const dealId = (payload.new as any)?.deal_id;
        if (dealId) {
          qc.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
          qc.invalidateQueries({ queryKey: queryKeys.deals.activities(dealId) });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, (payload: Payload) => {
        const taskId = (payload.new as any)?.task_id;
        if (taskId) qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "intake_messages" }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.intake.all });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
