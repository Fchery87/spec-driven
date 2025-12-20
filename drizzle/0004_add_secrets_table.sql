-- Add secrets table for encrypted API key storage
CREATE TABLE IF NOT EXISTS "Secret" (
  "key" TEXT PRIMARY KEY NOT NULL,
  "encrypted_value" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
