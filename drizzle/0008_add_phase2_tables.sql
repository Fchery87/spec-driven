-- Phase 2: Collaboration & Control Tables

-- Phase Snapshots for rollback capability
CREATE TABLE "PhaseSnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "phase_name" text NOT NULL,
  "snapshot_number" integer NOT NULL,
  "artifacts_json" text NOT NULL,
  "metadata" text NOT NULL,
  "user_inputs" text,
  "validation_results" text,
  "git_commit_hash" text,
  "git_branch" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "PhaseSnapshot_project_phase_idx" ON "PhaseSnapshot" ("project_id", "phase_name");
CREATE INDEX "PhaseSnapshot_created_at_idx" ON "PhaseSnapshot" ("created_at");

-- Approval Gates tracking
CREATE TABLE "ApprovalGate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "gate_name" text NOT NULL,
  "phase" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "blocking" boolean NOT NULL DEFAULT false,
  "approved_by" uuid REFERENCES "User"("id"),
  "approved_at" timestamp with time zone,
  "rejection_reason" text,
  "auto_approved" boolean DEFAULT false,
  "constitutional_score" integer,
  "stakeholder_role" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "ApprovalGate_project_gate_idx" ON "ApprovalGate" ("project_id", "gate_name");
CREATE INDEX "ApprovalGate_status_idx" ON "ApprovalGate" ("status");

-- Git Operations tracking
CREATE TABLE "GitOperation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "operation_type" text NOT NULL,
  "phase" text NOT NULL,
  "commit_hash" text,
  "commit_message" text,
  "branch" text,
  "tag" text,
  "success" boolean NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "GitOperation_project_idx" ON "GitOperation" ("project_id");
CREATE INDEX "GitOperation_type_idx" ON "GitOperation" ("operation_type");
CREATE INDEX "GitOperation_created_at_idx" ON "GitOperation" ("created_at");

-- Comments for documentation
COMMENT ON TABLE "PhaseSnapshot" IS 'Stores complete phase state for rollback capability (Phase 2)';
COMMENT ON TABLE "ApprovalGate" IS 'Tracks approval workflow for progressive approval system (Phase 2)';
COMMENT ON TABLE "GitOperation" IS 'Audit trail for Git workflow integration (Phase 2)';
