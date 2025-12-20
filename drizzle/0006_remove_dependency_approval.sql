-- Remove dependency approval gate
ALTER TABLE "Project" DROP COLUMN IF EXISTS "dependencies_approved";
--> statement-breakpoint
DROP TABLE IF EXISTS "DependencyApproval";
