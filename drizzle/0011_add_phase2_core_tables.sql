-- Phase 2: Core tables for validation, artifact versioning, auto-remedy, and regeneration

-- Validation runs table for tracking validation results
CREATE TABLE "ValidationRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "phase" TEXT NOT NULL,
  "validation_type" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "score" INTEGER,
  "findings_json" TEXT,
  "remediation_suggestions_json" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Artifact versions table for tracking artifact changes
CREATE TABLE "ArtifactVersion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "artifact_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "regeneration_run_id" UUID,
  "change_description" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Auto remedy runs table for tracking auto-remedy operations
CREATE TABLE "AutoRemedyRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "trigger_phase" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "original_issue" TEXT NOT NULL,
  "remedy_result" TEXT,
  "artifacts_modified" INTEGER DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP WITH TIME ZONE,
  "completed_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Regeneration runs table for tracking regeneration operations
CREATE TABLE "RegenerationRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "trigger_change_id" UUID,
  "trigger_type" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "started_at" TIMESTAMP WITH TIME ZONE,
  "completed_at" TIMESTAMP WITH TIME ZONE,
  "total_artifacts" INTEGER DEFAULT 0,
  "successful_artifacts" INTEGER DEFAULT 0,
  "failed_artifacts" INTEGER DEFAULT 0,
  "error_summary" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for faster queries
CREATE INDEX "ValidationRun_project_idx" ON "ValidationRun"("project_id");
CREATE INDEX "ValidationRun_phase_idx" ON "ValidationRun"("phase");
CREATE INDEX "ArtifactVersion_artifact_idx" ON "ArtifactVersion"("artifact_id");
CREATE INDEX "ArtifactVersion_regeneration_idx" ON "ArtifactVersion"("regeneration_run_id");
CREATE INDEX "AutoRemedyRun_project_idx" ON "AutoRemedyRun"("project_id");
CREATE INDEX "AutoRemedyRun_status_idx" ON "AutoRemedyRun"("status");
CREATE INDEX "RegenerationRun_project_idx" ON "RegenerationRun"("project_id");
CREATE INDEX "RegenerationRun_status_idx" ON "RegenerationRun"("status");

-- Foreign key constraints
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_project_id_Project_id_fk" 
  FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ArtifactVersion" ADD CONSTRAINT "ArtifactVersion_artifact_id_Artifact_id_fk" 
  FOREIGN KEY ("artifact_id") REFERENCES "public"."Artifact"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "AutoRemedyRun" ADD CONSTRAINT "AutoRemedyRun_project_id_Project_id_fk" 
  FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "RegenerationRun" ADD CONSTRAINT "RegenerationRun_project_id_Project_id_fk" 
  FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
