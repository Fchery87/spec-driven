/**
 * Authentication Service using Drizzle ORM
 *
 * High-level authentication operations:
 * - User registration
 * - User login
 * - Token generation and validation
 * - Session management
 */

import { db } from '@/backend/lib/drizzle';
import { users } from '@/backend/lib/schema';
import { JWTService, JWTPayload } from './jwt_service';
import { PasswordService } from './password_service';
import { z } from 'zod';
 
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
  token?: string;
}

export class AuthService {
  private jwtService: JWTService;
  private passwordService: PasswordService;

  constructor() {
    this.jwtService = new JWTService();
    this.passwordService = new PasswordService();
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      // Validate input
      const validated = RegisterSchema.parse(input);

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, validated.email)
      });

      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Check password strength
      const strengthCheck = this.passwordService.checkPasswordStrength(
        validated.password
      );
      if (!strengthCheck.strong) {
        return {
          success: false,
          message: `Weak password. ${strengthCheck.feedback.join('. ')}`
        };
      }

      // Hash password
      const passwordHash = await this.passwordService.hashPassword(
        validated.password
      );

      // Create user
      const [user] = await db.insert(users).values({
        email: validated.email,
        name: validated.name,
        passwordHash
      }).returning();

      // Generate token
      const token = this.jwtService.generateToken({
        userId: user.id,
        email: user.email,
        name: user.name || undefined
      });

      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
        };
      }
      return {
        success: false,
        message: `Registration failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Login a user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    try {
      // Validate input
      const validated = LoginSchema.parse(input);

      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.email, validated.email)
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      if (!user.passwordHash) {
        return {
          success: false,
          message: 'Password login is not available for this account'
        };
      }

      // Verify password
      const passwordValid = await this.passwordService.verifyPassword(
        validated.password,
        user.passwordHash
      );

      if (!passwordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Generate token
      const token = this.jwtService.generateToken({
        userId: user.id,
        email: user.email,
        name: user.name || undefined
      });

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
        };
      }
      return {
        success: false,
        message: `Login failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Verify a token and get user payload
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    return this.jwtService.verifyToken(token);
  }

  /**
   * Get current user from token
   */
  async getCurrentUser(token: string) {
    const payload = await this.jwtService.verifyToken(token);
    if (!payload) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId)
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<AuthResponse> {
    try {
      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (!user.passwordHash) {
        return {
          success: false,
          message: 'Password reset is not available for this account'
        };
      }

      // Verify old password
      const oldPasswordValid = await this.passwordService.verifyPassword(
        oldPassword,
        user.passwordHash
      );

      if (!oldPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      // Check new password strength
      const strengthCheck =
        this.passwordService.checkPasswordStrength(newPassword);
      if (!strengthCheck.strong) {
        return {
          success: false,
          message: `Weak password. ${strengthCheck.feedback.join('. ')}`
        };
      }

      // Hash new password
      const newPasswordHash = await this.passwordService.hashPassword(
        newPassword
      );

      // Update password
      await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to change password: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();