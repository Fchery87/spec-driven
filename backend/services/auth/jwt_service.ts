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

// ============================================================================
// TOKEN BLACKLIST
// Implements a mechanism to revoke tokens (logout, password change, etc.)
// Uses in-memory Set for development, Redis for production
// ============================================================================

interface TokenBlacklist {
  add(token: string, expiresAt: number): void | Promise<void>;
  has(token: string): boolean | Promise<boolean>;
  remove(token: string): void | Promise<void>;
}

/**
 * In-memory token blacklist for development
 */
class InMemoryTokenBlacklist implements TokenBlacklist {
  private blacklist = new Set<string>();
  private expiryMap = new Map<string, number>();

  add(token: string, expiresAt: number): void {
    this.blacklist.add(token);
    this.expiryMap.set(token, expiresAt);
  }

  has(token: string): boolean {
    return this.blacklist.has(token);
  }

  remove(token: string): void {
    this.blacklist.delete(token);
    this.expiryMap.delete(token);
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [token, expiresAt] of this.expiryMap.entries()) {
      if (now >= expiresAt) {
        this.blacklist.delete(token);
        this.expiryMap.delete(token);
      }
    }
  }
}

/**
 * Redis-based token blacklist for production
 * Uses Upstash Redis REST API if available
 */
class RedisTokenBlacklist implements TokenBlacklist {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL || '';
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  }

  private async request(method: string, path: string, body?: object) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async add(token: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
    await this.request('POST', '/sadd', { key: 'token_blacklist', member: token });
    await this.request('POST', '/setex', { key: `token:${token}`, value: 'revoked', ex: ttl });
  }

  async has(token: string): Promise<boolean> {
    const result = await this.request('GET', `/get/token:${token}`);
    return result.result !== null;
  }

  async remove(token: string): Promise<void> {
    await this.request('POST', '/srem', { key: 'token_blacklist', member: token });
    await this.request('POST', '/del', { key: `token:${token}` });
  }
}

// Select blacklist implementation based on environment
function createTokenBlacklist(): TokenBlacklist {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    logger.info('Using Redis-based token blacklist');
    return new RedisTokenBlacklist();
  }
  logger.info('Using in-memory token blacklist (not recommended for production)');
  return new InMemoryTokenBlacklist();
}

// Singleton blacklist instance
const tokenBlacklist = createTokenBlacklist();

// Cleanup in-memory blacklist every 10 minutes (development only)
if (tokenBlacklist instanceof InMemoryTokenBlacklist) {
  setInterval(() => {
    (tokenBlacklist as InMemoryTokenBlacklist).cleanup();
  }, 10 * 60 * 1000);
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
       
    } as any);
  }

  /**
   * Verify and decode a JWT token
   * Also checks if token is blacklisted
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      // Check token blacklist first
      const isBlacklisted = await tokenBlacklist.has(token);
      if (isBlacklisted) {
        logger.warn('Attempted to use blacklisted token');
        return null;
      }

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
   * Add a token to the blacklist (for logout, password change, etc.)
   */
  async blacklistToken(token: string): Promise<void> {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      // If we can't decode, assume max TTL of 24 hours
      await tokenBlacklist.add(token, Date.now() + 24 * 60 * 60 * 1000);
    } else {
      await tokenBlacklist.add(token, decoded.exp * 1000);
    }
    logger.info('Token added to blacklist');
  }

  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    return tokenBlacklist.has(token);
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
