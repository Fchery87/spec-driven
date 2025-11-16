/**
 * Concurrent execution safeguards
 * Prevents race conditions, duplicate work, and ensures idempotency
 */

import { logger } from './logger';

/**
 * Deduplication cache for in-flight operations
 * Prevents duplicate processing if multiple requests are made simultaneously
 */
class RequestDeduplicator {
  private inFlight: Map<string, Promise<any>> = new Map();

  /**
   * Execute a function only once per deduplication key
   * Multiple calls with same key will await the same promise
   */
  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // If already in flight, return existing promise
    if (this.inFlight.has(key)) {
      logger.debug('Request deduplicated', { key, action: 'reusing_in_flight' });
      return this.inFlight.get(key)!;
    }

    // Execute and cache the promise
    const promise = fn().finally(() => {
      // Clean up after 30 seconds to allow new executions
      setTimeout(() => this.inFlight.delete(key), 30000);
    });

    this.inFlight.set(key, promise);
    logger.debug('Request execution started', { key });

    return promise;
  }

  /**
   * Check if an operation is currently in flight
   */
  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  /**
   * Get the in-flight promise for a key
   */
  getInFlight<T>(key: string): Promise<T> | undefined {
    return this.inFlight.get(key);
  }

  /**
   * Clear all in-flight operations (use with caution)
   */
  clear(): void {
    this.inFlight.clear();
  }
}

/**
 * Idempotency key tracker
 * Ensures the same request is only processed once, even with retries
 */
class IdempotencyTracker {
  private results: Map<string, { result: any; timestamp: number }> = new Map();
  private ttl: number; // milliseconds

  constructor(ttlSeconds: number = 3600) {
    this.ttl = ttlSeconds * 1000;

    // Cleanup expired entries every 5 minutes
    if (typeof window === 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Check if an idempotency key has been processed
   */
  has(key: string): boolean {
    const entry = this.results.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.results.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get the cached result for an idempotency key
   */
  get<T>(key: string): T | undefined {
    const entry = this.results.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.results.delete(key);
      return undefined;
    }

    return entry.result as T;
  }

  /**
   * Store a result for an idempotency key
   */
  set(key: string, result: any): void {
    this.results.set(key, { result, timestamp: Date.now() });
    logger.debug('Idempotency result cached', { key });
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.results.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.results.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Idempotency cleanup', { cleaned, remaining: this.results.size });
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.results.clear();
  }
}

/**
 * Distributed lock manager
 * For coordinating work across multiple processes/instances
 * This is a simple in-memory version; for production use external locking (Redis, DB)
 */
class LockManager {
  private locks: Map<string, { owner: string; expiresAt: number }> = new Map();
  private lockTimeout: number; // milliseconds

  constructor(lockTimeoutSeconds: number = 30) {
    this.lockTimeout = lockTimeoutSeconds * 1000;

    // Cleanup expired locks every minute
    if (typeof window === 'undefined') {
      setInterval(() => this.cleanupExpiredLocks(), 60 * 1000);
    }
  }

  /**
   * Try to acquire a lock
   * @returns lock token if successful, undefined if lock is held
   */
  tryAcquire(resourceId: string, ownerId: string): string | undefined {
    const existing = this.locks.get(resourceId);

    // If no lock or expired, acquire new lock
    if (!existing || Date.now() >= existing.expiresAt) {
      const token = `${ownerId}:${Date.now()}:${Math.random()}`;
      this.locks.set(resourceId, {
        owner: ownerId,
        expiresAt: Date.now() + this.lockTimeout,
      });
      logger.debug('Lock acquired', { resourceId, ownerId });
      return token;
    }

    // Lock is held by someone else
    logger.debug('Lock denied', { resourceId, holder: existing.owner });
    return undefined;
  }

  /**
   * Release a lock
   */
  release(resourceId: string, ownerId: string): boolean {
    const existing = this.locks.get(resourceId);
    if (existing && existing.owner === ownerId) {
      this.locks.delete(resourceId);
      logger.debug('Lock released', { resourceId, ownerId });
      return true;
    }
    return false;
  }

  /**
   * Check if a resource is locked
   */
  isLocked(resourceId: string): boolean {
    const existing = this.locks.get(resourceId);
    if (!existing) return false;

    // Check if expired
    if (Date.now() >= existing.expiresAt) {
      this.locks.delete(resourceId);
      return false;
    }

    return true;
  }

  /**
   * Get lock holder
   */
  getLockHolder(resourceId: string): string | undefined {
    const existing = this.locks.get(resourceId);
    if (!existing || Date.now() >= existing.expiresAt) return undefined;
    return existing.owner;
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [resourceId, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt) {
        this.locks.delete(resourceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Locks cleanup', { cleaned, remaining: this.locks.size });
    }
  }

  /**
   * Force release a lock (use with caution)
   */
  forceRelease(resourceId: string): void {
    this.locks.delete(resourceId);
    logger.warn('Lock force released', { resourceId });
  }

  /**
   * Clear all locks
   */
  clear(): void {
    this.locks.clear();
  }
}

// Global instances
export const deduplicator = new RequestDeduplicator();
export const idempotencyTracker = new IdempotencyTracker(3600); // 1 hour TTL
export const lockManager = new LockManager(30); // 30 second lock timeout

/**
 * Higher-order function to make an async operation safe from concurrent execution
 */
export function withConcurrencyGuard<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    deduplicationKey?: (...args: T) => string;
    idempotencyKey?: (...args: T) => string;
    lockKey?: (...args: T) => string;
    ownerId?: string;
  } = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const { deduplicationKey, idempotencyKey, lockKey } = options;
    const ownerId = options.ownerId || 'system';

    // Check idempotency first
    if (idempotencyKey) {
      const key = idempotencyKey(...args);
      if (idempotencyTracker.has(key)) {
        logger.info('Idempotent request detected, returning cached result', { key });
        return idempotencyTracker.get<R>(key)!;
      }
    }

    // Try to acquire lock
    if (lockKey) {
      const key = lockKey(...args);
      const token = lockManager.tryAcquire(key, ownerId);
      if (!token) {
        throw new Error(`Resource locked: ${key}`);
      }

      try {
        // Execute with deduplication if configured
        if (deduplicationKey) {
          const dedupKey = deduplicationKey(...args);
          const result = await deduplicator.deduplicate(dedupKey, () => fn(...args));

          // Cache idempotency result
          if (idempotencyKey) {
            idempotencyTracker.set(idempotencyKey(...args), result);
          }

          return result;
        } else {
          const result = await fn(...args);

          // Cache idempotency result
          if (idempotencyKey) {
            idempotencyTracker.set(idempotencyKey(...args), result);
          }

          return result;
        }
      } finally {
        lockManager.release(key, ownerId);
      }
    }

    // Execute with deduplication only
    if (deduplicationKey) {
      const key = deduplicationKey(...args);
      const result = await deduplicator.deduplicate(key, () => fn(...args));

      // Cache idempotency result
      if (idempotencyKey) {
        idempotencyTracker.set(idempotencyKey(...args), result);
      }

      return result;
    }

    // No guards configured, execute normally
    const result = await fn(...args);

    // Cache idempotency result
    if (idempotencyKey) {
      idempotencyTracker.set(idempotencyKey(...args), result);
    }

    return result;
  };
}
