CREATE TABLE "RegenerationRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"trigger_artifact_id" text NOT NULL,
	"trigger_change_id" uuid,
	"impact_analysis" text,
	"selected_strategy" text,
	"artifacts_to_regenerate" text,
	"artifacts_regenerated" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"success" boolean,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "RegenerationRun" ADD CONSTRAINT "RegenerationRun_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "RegenerationRun_project_id_idx" ON "RegenerationRun" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "RegenerationRun_trigger_artifact_id_idx" ON "RegenerationRun" USING btree ("trigger_artifact_id");--> statement-breakpoint
CREATE INDEX "RegenerationRun_started_at_idx" ON "RegenerationRun" USING btree ("started_at");