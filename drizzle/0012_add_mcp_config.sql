-- MCP Configuration table for storing MCP provider API keys
CREATE TABLE IF NOT EXISTS "MCPConfig" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL UNIQUE,
  "display_name" TEXT NOT NULL,
  "encrypted_api_key" TEXT,
  "config_json" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "connected" BOOLEAN,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "last_checked_at" TIMESTAMP WITH TIME ZONE
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS "MCPConfig_provider_idx" ON "MCPConfig"("provider");
CREATE INDEX IF NOT EXISTS "MCPConfig_enabled_idx" ON "MCPConfig"("enabled");
