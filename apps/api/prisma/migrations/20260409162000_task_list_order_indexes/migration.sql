-- Optimize workspace task list sorting and assignment-filtered board queries.
CREATE INDEX "tasks_workspace_id_created_at_id_idx"
ON "tasks" ("workspace_id", "created_at" DESC, "id" DESC);

CREATE INDEX "tasks_workspace_id_assignee_user_id_created_at_id_idx"
ON "tasks" ("workspace_id", "assignee_user_id", "created_at" DESC, "id" DESC);
