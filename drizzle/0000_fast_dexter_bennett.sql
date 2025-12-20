CREATE TABLE "Account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"filename" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"file_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DependencyApproval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" text,
	"notes" text,
	CONSTRAINT "DependencyApproval_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "PhaseHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"current_phase" text DEFAULT 'ANALYSIS' NOT NULL,
	"phases_completed" text DEFAULT '' NOT NULL,
	"stack_choice" text,
	"stack_approved" boolean DEFAULT false NOT NULL,
	"dependencies_approved" boolean DEFAULT false NOT NULL,
	"handoff_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handoff_generated_at" timestamp with time zone,
	CONSTRAINT "Project_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "Setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StackChoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"reasoning" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "StackChoice_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DependencyApproval" ADD CONSTRAINT "DependencyApproval_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PhaseHistory" ADD CONSTRAINT "PhaseHistory_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StackChoice" ADD CONSTRAINT "StackChoice_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Account_account_id_provider_id_idx" ON "Account" USING btree ("account_id","provider_id");--> statement-breakpoint
CREATE INDEX "Account_user_id_idx" ON "Account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "Artifact_project_id_idx" ON "Artifact" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "Artifact_phase_idx" ON "Artifact" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "Artifact_created_at_idx" ON "Artifact" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "DependencyApproval_project_id_idx" ON "DependencyApproval" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "PhaseHistory_project_id_idx" ON "PhaseHistory" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "PhaseHistory_phase_idx" ON "PhaseHistory" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "Project_slug_idx" ON "Project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "Project_created_at_idx" ON "Project" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "Session_user_id_idx" ON "Session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "StackChoice_project_id_idx" ON "StackChoice" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "Verification_user_id_idx" ON "Verification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "Verification_identifier_value_idx" ON "Verification" USING btree ("identifier","value");