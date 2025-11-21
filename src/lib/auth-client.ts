import { createAuthClient } from "better-auth/react";
import { logger } from "./logger";

// Initialize the auth client
const authClient = createAuthClient({
  fetchOptions: {
    onError: (ctx) => {
      logger.error("Auth client error:", ctx.error);
    },
  },
});

// Destructure and export individual methods
// Note: useAuth was removed in newer Better-Auth versions
export const { signIn, signOut, signUp, useSession } = authClient;