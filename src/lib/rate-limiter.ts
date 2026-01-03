/**
 * Rate limiting middleware for API routes
 * Prevents abuse of expensive operations (LLM calls, etc.)
 */

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

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      blockDuration: 60, // Default: 1 minute block
      ...config,
    };

    // Cleanup expired entries every 5 minutes
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Clean up the interval on destruction
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check if a key has exceeded rate limit
   * @returns true if allowed, false if rate limited
   */
  async isAllowed(key: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(key);

    // Check if currently blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    // Create new entry if doesn't exist
    if (!entry) {
      this.store.set(key, {
        points: 1,
        resetTime: now + this.config.duration * 1000,
      });
      return true;
    }

    // Reset if window has passed
    if (now >= entry.resetTime) {
      this.store.set(key, {
        points: 1,
        resetTime: now + this.config.duration * 1000,
      });
      return true;
    }

    // Increment points
    entry.points++;

    // Check if exceeded limit
    if (entry.points > this.config.points) {
      entry.blockedUntil = now + (this.config.blockDuration || 60) * 1000;
      return false;
    }

    return true;
  }

  /**
   * Get remaining points for a key
   */
  getRemainingPoints(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.config.points;
    return Math.max(0, this.config.points - entry.points);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      // Remove if reset time has passed and not blocked
      if (now >= entry.resetTime && (!entry.blockedUntil || now >= entry.blockedUntil)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset a specific key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset all entries
   */
  resetAll(): void {
    this.store.clear();
  }
}

// Global instances for different endpoints
const generalLimiter = new RateLimiter({
  points: 100,
  duration: 60, // 100 requests per minute
});

const llmLimiter = new RateLimiter({
  points: 10,
  duration: 60, // 10 LLM calls per minute per user
  blockDuration: 300, // 5 minute block
});

const authLimiter = new RateLimiter({
  points: 5,
  duration: 60, // 5 login attempts per minute
  blockDuration: 900, // 15 minute block
});

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
