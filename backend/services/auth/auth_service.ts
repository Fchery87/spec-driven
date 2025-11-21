/**
 * Authentication Service
 *
 * Re-exports from the Drizzle-based auth service for backward compatibility
 */

export {
  AuthService,
  authService,
  type RegisterInput,
  type LoginInput,
  type AuthResponse,
} from './drizzle_auth_service';
