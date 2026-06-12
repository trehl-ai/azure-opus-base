-- Konsolidierung: Legacy-`tasks` als deal_activities (activity_type='task') spiegeln,
-- damit /tasks (die einzige verbleibende Aktivitäten-View) nichts verliert, nachdem
-- /activities entfernt wurde. Die `tasks`-Tabelle bleibt erhalten (KEIN DROP).
-- KEIN NOTIFY pgrst in dieser Migration.

INSERT INTO deal_activities (
  deal_id, activity_type, title, description,
  due_date, completed_at, owner_user_id, created_by_user_id,
  created_at, updated_at, status, metadata
)
SELECT
  deal_id, 'task', title, description,
  due_date::timestamptz, completed_at, assigned_user_id, created_by_user_id,
  created_at, updated_at,
  CASE WHEN status = 'erledigt' THEN 'completed' ELSE 'open' END,
  jsonb_build_object(
    'migrated_from_tasks', true,
    'original_task_id', id::text,
    'priority', priority,
    'task_type', task_type,
    'original_status', status
  )
FROM tasks;
