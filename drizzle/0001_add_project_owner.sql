ALTER TABLE "Project" ADD COLUMN "owner_id" uuid NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_owner_id_User_id_fk" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "Project_owner_id_idx" ON "Project" ("owner_id");
