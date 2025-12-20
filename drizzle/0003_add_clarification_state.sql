-- Add clarification tracking columns to Project table
ALTER TABLE "Project" ADD COLUMN "clarification_state" text;
ALTER TABLE "Project" ADD COLUMN "clarification_mode" text DEFAULT 'hybrid';
ALTER TABLE "Project" ADD COLUMN "clarification_completed" boolean NOT NULL DEFAULT false;
