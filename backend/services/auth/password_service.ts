/**
 * Password Hashing Service
 *
 * Handles bcrypt-based password hashing and verification
 * Uses cost factor 12 for security (industry standard)
 */

import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

export class PasswordService {
  private costFactor: number;

  constructor(costFactor: number = 12) {
    this.costFactor = costFactor;
  }

  /**
   * Hash a password using bcrypt
   * Returns the salted hash
   */
  async hashPassword(password: string): Promise<string> {
    try {
      // Validate password strength
      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const salt = await bcrypt.genSalt(this.costFactor);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      throw new Error(
        `Password hashing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verify a plain password against a bcrypt hash
   */
  async verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hash);
    } catch (error) {
      logger.error('Password verification error:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Generate a random password (useful for password resets)
   */
  generateRandomPassword(length: number = 16): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password: string): {
    strong: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    if (password.length >= 12) score += 1;
    else feedback.push('Consider using 12+ characters');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
    else feedback.push('Add special characters');

    return {
      strong: score >= 5,
      score,
      feedback
    };
  }
}

// Export singleton instance
export const passwordService = new PasswordService();
