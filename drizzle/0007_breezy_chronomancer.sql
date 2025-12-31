CREATE TABLE "ArtifactVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"artifact_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"regeneration_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AutoRemedyRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"validation_run_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"successful" boolean DEFAULT false NOT NULL,
	"changes_applied" text
);
--> statement-breakpoint
CREATE TABLE "ValidationRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"failure_reasons" text,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "auto_remedy_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "last_remedy_phase" text;--> statement-breakpoint
ALTER TABLE "ArtifactVersion" ADD CONSTRAINT "ArtifactVersion_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AutoRemedyRun" ADD CONSTRAINT "AutoRemedyRun_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AutoRemedyRun" ADD CONSTRAINT "AutoRemedyRun_validation_run_id_ValidationRun_id_fk" FOREIGN KEY ("validation_run_id") REFERENCES "public"."ValidationRun"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ArtifactVersion_project_id_idx" ON "ArtifactVersion" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ArtifactVersion_artifact_id_idx" ON "ArtifactVersion" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "ArtifactVersion_created_at_idx" ON "ArtifactVersion" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "AutoRemedyRun_project_id_idx" ON "AutoRemedyRun" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "AutoRemedyRun_validation_run_id_idx" ON "AutoRemedyRun" USING btree ("validation_run_id");--> statement-breakpoint
CREATE INDEX "AutoRemedyRun_started_at_idx" ON "AutoRemedyRun" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ValidationRun_project_id_idx" ON "ValidationRun" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ValidationRun_phase_idx" ON "ValidationRun" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "ValidationRun_created_at_idx" ON "ValidationRun" USING btree ("created_at");