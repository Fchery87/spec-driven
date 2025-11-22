/**
 * Authentication Types
 * Proper typing for Better Auth session and related types
 */

/**
 * User type from Better Auth session
 */
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session type from Better Auth useSession hook
 */
export interface Session {
  id: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete auth session response from useSession hook
 * This is what comes back from useSession().data
 */
export interface AuthSession {
  user: User;
  session: Session;
}

/**
 * Auth context type with proper typing
 * Note: signIn and signOut types are from Better Auth SDK which has
 * complex generic types. We use function signatures that match actual usage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AuthContextType {
  session: AuthSession | null;
  /** Better Auth signIn function - used as signIn.email() or signIn.social() */
  signIn: any; // Better Auth provides this - complex generic types make strict typing impractical
  /** Better Auth signOut function */
  signOut: any; // Better Auth provides this
  isLoading: boolean;
}
