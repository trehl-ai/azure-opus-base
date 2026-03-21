/**
 * Centralized, hierarchical query keys for TanStack Query.
 * Enables targeted invalidation patterns.
 */
export const queryKeys = {
  companies: {
    all: ["companies"] as const,
    list: (filters: Record<string, unknown>) => ["companies", filters] as const,
    detail: (id: string) => ["company", id] as const,
    contacts: (id: string) => ["company-contacts", id] as const,
    deals: (id: string) => ["company-deals", id] as const,
    projects: (id: string) => ["company-projects", id] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: (filters: Record<string, unknown>) => ["contacts-list", filters] as const,
    detail: (id: string) => ["contact", id] as const,
    companies: (id: string) => ["contact-companies", id] as const,
    deals: (id: string) => ["contact-deals", id] as const,
  },
  deals: {
    all: ["deals"] as const,
    board: (pipelineId: string, filters: Record<string, unknown>) => ["deals-board", pipelineId, filters] as const,
    detail: (id: string) => ["deal", id] as const,
    activities: (id: string) => ["deal-activities", id] as const,
    project: (id: string) => ["deal-project", id] as const,
  },
  pipelines: {
    all: ["pipelines"] as const,
    stages: (pipelineId: string) => ["pipeline-stages", pipelineId] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (filters: Record<string, unknown>) => ["projects", filters] as const,
    detail: (id: string) => ["project", id] as const,
    tasks: (id: string) => ["project-tasks", id] as const,
    taskCounts: (ids: string) => ["project-task-counts", ids] as const,
  },
  tasks: {
    all: ["all-tasks"] as const,
    detail: (id: string) => ["task", id] as const,
  },
  users: {
    all: ["users"] as const,
    allUsers: ["all-users"] as const,
  },
  tags: {
    all: ["tags"] as const,
  },
  workspaceSettings: {
    all: ["workspace-settings"] as const,
  },
  dashboard: {
    deals: ["dash-deals"] as const,
    projects: ["dash-projects"] as const,
    overdueTasks: ["dash-overdue-tasks"] as const,
    myTasks: (userId: string) => ["dash-my-tasks", userId] as const,
    openActivities: ["dash-open-activities"] as const,
    defaultStages: ["dash-default-stages"] as const,
  },
  intake: {
    all: ["intake-messages"] as const,
    detail: (id: string) => ["intake-message", id] as const,
  },
  imports: {
    all: ["import-jobs"] as const,
  },
} as const;
