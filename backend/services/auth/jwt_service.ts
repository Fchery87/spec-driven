/**
 * JWT Authentication Service
 *
 * Handles JWT token generation, verification, and decoding
 * Uses HS256 (HMAC SHA-256) symmetric signing
 */

import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private secret: string;
  private expiresIn: string;

  constructor(secret?: string, expiresIn: string = '24h') {
    this.expiresIn = expiresIn;

    // Get secret from parameter or environment variable
    const envSecret = process.env.JWT_SECRET;
    
    if (!secret && !envSecret) {
      // In production, require a valid secret
      if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET environment variable is required in production');
        process.exit(1);
      }
      // In development, use a default with warning
      this.secret = 'your-secret-key';
      logger.warn(
        'WARNING: Using default JWT secret. Set JWT_SECRET environment variable in production.'
      );
    } else {
      this.secret = secret || envSecret || 'your-secret-key';
    }
  }

  /**
   * Generate a JWT token for a user
   */
  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256']
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid token');
      }
      return null;
    }
  }

  /**
   * Decode a token without verification (use with caution)
   * Useful for debugging or getting expiry time before verification
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload | null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  }

  /**
   * Get time remaining for token (in seconds)
   */
  getTimeRemaining(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return 0;
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  }
}

// Export singleton instance
export const jwtService = new JWTService();
