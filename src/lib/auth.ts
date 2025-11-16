import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

const baseURL = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_BASE_URL

// Validate required environment variables
if (!baseURL && process.env.NODE_ENV === "production") {
  logger.warn(
    "[AUTH] Warning: NEXT_PUBLIC_APP_URL or AUTH_BASE_URL not set. This is required in production."
  )
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    async sendResetPassword(data) {
      logger.info("Password reset requested", { email: data.email })
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }),
  },
  sessionMaxAge: 60 * 60 * 24 * 7, // 7 days
  session: {
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },
})
