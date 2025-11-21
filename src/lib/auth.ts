import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomUUID } from "crypto";

import { db } from "@/backend/lib/drizzle";
import { logger } from "@/lib/logger";
import * as schema from "@/backend/lib/schema";

const baseURL = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_BASE_URL;

// Validate required environment variables
if (!baseURL && process.env.NODE_ENV === "production") {
  logger.warn(
    "[AUTH] Warning: NEXT_PUBLIC_APP_URL or AUTH_BASE_URL not set. This is required in production."
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "fallback-dev-secret-change-in-production",
  baseURL,
  // Configure ID generation to use proper UUID format for PostgreSQL
  advanced: {
    generateId: () => randomUUID(),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production for security
    autoSignIn: true,
    async sendResetPassword(data) {
      logger.info("Password reset requested", { data });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Update every 24 hours
  },
});
