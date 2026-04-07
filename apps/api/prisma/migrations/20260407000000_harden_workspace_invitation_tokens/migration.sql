CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "workspace_invitations"
SET "revoked_at" = NOW()
WHERE "accepted_at" IS NULL
  AND "revoked_at" IS NULL
  AND "expires_at" <= NOW();

UPDATE "workspace_invitations"
SET "token_hash" = encode(gen_random_bytes(32), 'hex')
WHERE char_length("token_hash") <> 64;
