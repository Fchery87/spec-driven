CREATE TABLE "ApprovalGate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"gate_name" text NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"auto_approved" boolean DEFAULT false,
	"constitutional_score" integer,
	"stakeholder_role" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "GitOperation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "PhaseSnapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "ApprovalGate" ADD CONSTRAINT "ApprovalGate_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ApprovalGate" ADD CONSTRAINT "ApprovalGate_approved_by_User_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GitOperation" ADD CONSTRAINT "GitOperation_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PhaseSnapshot" ADD CONSTRAINT "PhaseSnapshot_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ApprovalGate_project_gate_idx" ON "ApprovalGate" USING btree ("project_id","gate_name");--> statement-breakpoint
CREATE INDEX "ApprovalGate_status_idx" ON "ApprovalGate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "GitOperation_project_idx" ON "GitOperation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "GitOperation_type_idx" ON "GitOperation" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "GitOperation_created_at_idx" ON "GitOperation" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "PhaseSnapshot_project_phase_idx" ON "PhaseSnapshot" USING btree ("project_id","phase_name");--> statement-breakpoint
CREATE INDEX "PhaseSnapshot_created_at_idx" ON "PhaseSnapshot" USING btree ("created_at");