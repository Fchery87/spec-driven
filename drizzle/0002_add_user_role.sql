-- Add role column to User table
ALTER TABLE "User" ADD COLUMN "role" text NOT NULL DEFAULT 'user';
