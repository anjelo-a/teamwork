ALTER TABLE "workspace_share_links"
    RENAME COLUMN "token" TO "token_hash";

ALTER TABLE "workspace_share_links"
    ADD COLUMN "expires_at" TIMESTAMP(3),
    ADD COLUMN "revoked_at" TIMESTAMP(3),
    ADD COLUMN "last_used_at" TIMESTAMP(3);

UPDATE "workspace_share_links"
SET "expires_at" = "created_at" + INTERVAL '14 days';

ALTER TABLE "workspace_share_links"
    ALTER COLUMN "expires_at" SET NOT NULL;
