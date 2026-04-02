ALTER TABLE "workspace_invitations"
    ADD COLUMN "token_hash" TEXT,
    ADD COLUMN "expires_at" TIMESTAMP(3);

UPDATE "workspace_invitations"
SET
    "token_hash" = md5("id"::text || ':' || "email" || ':' || "created_at"::text),
    "expires_at" = "created_at" + INTERVAL '7 days'
WHERE "token_hash" IS NULL OR "expires_at" IS NULL;

ALTER TABLE "workspace_invitations"
    ALTER COLUMN "token_hash" SET NOT NULL,
    ALTER COLUMN "expires_at" SET NOT NULL;

CREATE UNIQUE INDEX "workspace_invitations_token_hash_key"
ON "workspace_invitations" ("token_hash");
