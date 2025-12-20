-- Add Phase 1 project metadata columns
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "project_type" text;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "scale_tier" text;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "recommended_stack" text;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "workflow_version" integer DEFAULT 2 NOT NULL;

-- Add missing timestamps to Verification table
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
