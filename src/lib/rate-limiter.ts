/**
 * Rate limiting middleware for API routes
 * Prevents abuse of expensive operations (LLM calls, etc.)
 * 
 * Supports both in-memory (development) and Redis (production) backends
 */

import { logger } from './logger';

export interface RateLimitConfig {
  points: number; // Number of requests allowed
  duration: number; // Time window in seconds
  blockDuration?: number; // How long to block after limit exceeded (seconds)
}

interface RateLimitEntry {
  points: number;
  resetTime: number;
  blockedUntil?: number;
}

// ============================================================================
// RATE LIMITER BACKEND INTERFACE
// ============================================================================

interface RateLimiterBackend {
  isAllowed(key: string): Promise<boolean>;
  getRemainingPoints(key: string): Promise<number>;
  reset(key: string): Promise<void>;
  resetAll(): Promise<void>;
}

// ============================================================================
// IN-MEMORY BACKEND (Development)
// ============================================================================

class InMemoryRateLimiterBackend implements RateLimiterBackend {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      blockDuration: 60,
      ...config,
    };

    // Cleanup expired entries every 5 minutes
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async isAllowed(key: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (entry?.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    if (!entry) {
      this.store.set(key, {
        points: 1,
        resetTime: now + this.config.duration * 1000,
      });
      return true;
    }

    if (now >= entry.resetTime) {
      this.store.set(key, {
        points: 1,
        resetTime: now + this.config.duration * 1000,
      });
      return true;
    }

    entry.points++;

    if (entry.points > this.config.points) {
      entry.blockedUntil = now + (this.config.blockDuration || 60) * 1000;
      return false;
    }

    return true;
  }

  async getRemainingPoints(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return this.config.points;
    return Math.max(0, this.config.points - entry.points);
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async resetAll(): Promise<void> {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime && (!entry.blockedUntil || now >= entry.blockedUntil)) {
        this.store.delete(key);
      }
    }
  }
}

// ============================================================================
// REDIS BACKEND (Production - Upstash Redis)
// ============================================================================

class RedisRateLimiterBackend implements RateLimiterBackend {
  private baseUrl: string;
  private token: string;
  private config: RateLimitConfig;
  private prefix: string;

  constructor(config: RateLimitConfig, prefix: string = 'ratelimit') {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL || '';
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
    this.config = config;
    this.prefix = prefix;
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

  async isAllowed(key: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = this.config.duration * 1000;
    const blockMs = (this.config.blockDuration || 60) * 1000;
    
    // Check if blocked
    const blockedKey = `${this.prefix}:blocked:${key}`;
    const blockedResult = await this.request('GET', `/get/${blockedKey}`);
    
    if (blockedResult.result) {
      return false;
    }

    // Get current count
    const countKey = `${this.prefix}:count:${key}`;
    const countResult = await this.request('GET', `/get/${countKey}`);
    
    let currentCount = 0;
    let resetTime = now + windowMs;
    
    if (countResult.result) {
      const data = JSON.parse(countResult.result);
      currentCount = data.count;
      resetTime = data.resetTime;
      
      // Check if window has passed
      if (now >= resetTime) {
        currentCount = 0;
        resetTime = now + windowMs;
      }
    }

    // Increment count
    const newCount = currentCount + 1;
    const ttl = Math.ceil(windowMs / 1000);
    
    await this.request('POST', '/setex', {
      key: countKey,
      value: JSON.stringify({ count: newCount, resetTime }),
      ex: ttl,
    });

    if (newCount > this.config.points) {
      // Block the key
      const blockTtl = Math.ceil(blockMs / 1000);
      await this.request('POST', '/setex', {
        key: blockedKey,
        value: '1',
        ex: blockTtl,
      });
      return false;
    }

    return true;
  }

  async getRemainingPoints(key: string): Promise<number> {
    const countKey = `${this.prefix}:count:${key}`;
    const result = await this.request('GET', `/get/${countKey}`);
    
    if (!result.result) {
      return this.config.points;
    }
    
    const data = JSON.parse(result.result);
    return Math.max(0, this.config.points - data.count);
  }

  async reset(key: string): Promise<void> {
    await this.request('POST', '/del', { key: `${this.prefix}:count:${key}` });
    await this.request('POST', '/del', { key: `${this.prefix}:blocked:${key}` });
  }

  async resetAll(): Promise<void> {
    // In production, we'd need to scan and delete matching keys
    // For now, just log that full reset isn't supported with Redis
    logger.warn('Redis rate limiter does not support resetAll()');
  }
}

// ============================================================================
// RATE LIMITER FACTORY
// ============================================================================

function createRateLimiterBackend(config: RateLimitConfig, prefix: string): RateLimiterBackend {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    logger.info(`Using Redis rate limiter (prefix: ${prefix})`);
    return new RedisRateLimiterBackend(config, prefix);
  }
  
  logger.info(`Using in-memory rate limiter (prefix: ${prefix}) - not recommended for production`);
  return new InMemoryRateLimiterBackend(config);
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

class RateLimiter {
  private backend: RateLimiterBackend;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig, prefix: string = 'ratelimit') {
    this.config = {
      blockDuration: 60,
      ...config,
    };
    this.backend = createRateLimiterBackend(this.config, prefix);
  }

  async isAllowed(key: string): Promise<boolean> {
    return this.backend.isAllowed(key);
  }

  async getRemainingPoints(key: string): Promise<number> {
    return this.backend.getRemainingPoints(key);
  }

  async reset(key: string): Promise<void> {
    return this.backend.reset(key);
  }

  async resetAll(): Promise<void> {
    return this.backend.resetAll();
  }

  destroy(): void {
    if (this.backend instanceof InMemoryRateLimiterBackend) {
      (this.backend as InMemoryRateLimiterBackend).destroy();
    }
  }
}

// Global instances for different endpoints
const generalLimiter = new RateLimiter({
  points: 100,
  duration: 60, // 100 requests per minute
}, 'ratelimit:general');

const llmLimiter = new RateLimiter({
  points: 10,
  duration: 60, // 10 LLM calls per minute per user
  blockDuration: 300, // 5 minute block
}, 'ratelimit:llm');

const authLimiter = new RateLimiter({
  points: 5,
  duration: 60, // 5 login attempts per minute
  blockDuration: 900, // 15 minute block
}, 'ratelimit:auth');

export { RateLimiter, generalLimiter, llmLimiter, authLimiter };

/**
 * Helper to extract rate limit key from request
 * Uses user ID if available, otherwise IP address
 */
export function getRateLimitKey(req: Request, userId?: string): string {
  if (userId) return `user:${userId}`;

  // Try to get IP from headers (works with Vercel)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  remaining: number,
  resetTime: number,
  retryAfter: number
): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
