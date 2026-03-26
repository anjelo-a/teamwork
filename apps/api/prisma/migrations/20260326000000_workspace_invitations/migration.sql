CREATE TABLE "workspace_invitations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_invitations_workspace_id_idx" ON "workspace_invitations"("workspace_id");
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations"("email");
CREATE UNIQUE INDEX "workspace_invitations_active_workspace_id_email_key"
    ON "workspace_invitations"("workspace_id", "email")
    WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;

ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_invited_by_user_id_fkey"
    FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
