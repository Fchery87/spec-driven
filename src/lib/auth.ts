import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomUUID } from "crypto";

import { db } from "@/backend/lib/drizzle";
import { logger } from "@/lib/logger";
import { env, getJWTSecret } from "@/lib/env";
import * as schema from "@/backend/lib/schema";

const baseURL = env.NEXT_PUBLIC_APP_URL || env.AUTH_BASE_URL;

// Validate required environment variables
if (!baseURL && env.NODE_ENV === "production") {
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
  secret: getJWTSecret(),
  baseURL,
  // Configure ID generation and security settings
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    // CSRF protection via cookies (enabled by default)
    // Better Auth automatically validates CSRF tokens on state-changing requests
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: "auth",
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Email verification required for production
    autoSignIn: true,
    async sendResetPassword(data) {
      logger.info("Password reset requested", { data });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Update every 24 hours
  },
});
