-- Add user_id to secrets table for user-specific LLM credentials
ALTER TABLE "Secret" ADD COLUMN "user_id" UUID REFERENCES "User"(id) ON DELETE CASCADE;

-- Drop old unique constraint on provider
ALTER TABLE "MCPConfig" DROP CONSTRAINT IF EXISTS "MCPConfig_provider_key";

-- Add user_id to MCPConfig (required for exclusive per-user credentials)
ALTER TABLE "MCPConfig" ADD COLUMN "user_id" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE;

-- Update existing MCPConfig rows with a default user (admin user)
-- This will fail if there's no admin user, which is expected in fresh installs
-- The UI will handle creating new user-specific records

-- Add index for user-specific lookups
CREATE INDEX IF NOT EXISTS "Secret_user_id_key_idx" ON "Secret"("user_id", "key");
CREATE INDEX IF NOT EXISTS "MCPConfig_user_provider_idx" ON "MCPConfig"("user_id", "provider");
