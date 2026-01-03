CREATE TABLE "MCPConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"encrypted_api_key" text,
	"config_json" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"connected" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "Secret" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "MCPConfig" ADD CONSTRAINT "MCPConfig_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "MCPConfig_user_provider_idx" ON "MCPConfig" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "MCPConfig_enabled_idx" ON "MCPConfig" USING btree ("enabled");--> statement-breakpoint
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Secret_user_id_key_idx" ON "Secret" USING btree ("user_id","key");