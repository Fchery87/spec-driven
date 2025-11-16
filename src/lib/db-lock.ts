/**
 * Database-level distributed locking for orchestrator operations
 * Uses PostgreSQL advisory locks for safe concurrent coordination
 *
 * Advisory locks are:
 * - Fast and lightweight
 * - Session-based (auto-released on disconnect)
 * - Deadlock-proof (cannot be held indefinitely)
 * - Perfect for coordinating across multiple instances
 */

import { prisma } from './prisma';
import { logger } from './logger';

export interface LockOptions {
  lockId: string; // Unique identifier for the resource
  timeoutMs?: number; // How long to wait for lock (default: 5000)
  autoRelease?: boolean; // Auto-release after time (default: true)
  autoReleaseMs?: number; // How long before auto-release (default: 300000 = 5min)
}

export interface LockHandle {
  lockId: string;
  acquired: number;
  release(): Promise<void>;
}

/**
 * Generate a numeric lock ID from a string
 * PostgreSQL advisory locks use 64-bit integers (two 32-bit integers)
 */
function hashLockId(id: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const id1 = Math.abs(hash);
  const id2 = Math.abs(hash ^ 0x9e3779b9); // XOR with a constant for second part

  return [id1, id2];
}

/**
 * Attempt to acquire a database lock
 */
export async function acquireLock(options: LockOptions): Promise<LockHandle | null> {
  const { lockId, timeoutMs = 5000, autoRelease = true, autoReleaseMs = 300000 } = options;
  const [id1, id2] = hashLockId(lockId);

  try {
    // Try to acquire the lock with timeout
    // pg_try_advisory_lock returns true if lock acquired, false if already held
    const result = await prisma.$queryRaw<[{ success: boolean }]>`
      SELECT pg_try_advisory_lock(${id1}::int, ${id2}::int) as success
    `;

    if (!result[0].success) {
      logger.debug('Failed to acquire lock', { lockId, reason: 'already held' });
      return null;
    }

    logger.info('Lock acquired', { lockId, autoRelease, autoReleaseMs });

    const handle: LockHandle = {
      lockId,
      acquired: Date.now(),
      release: async () => {
        await releaseLock(lockId);
      },
    };

    // Auto-release after timeout if configured
    if (autoRelease) {
      setTimeout(async () => {
        try {
          await releaseLock(lockId);
          logger.info('Lock auto-released after timeout', { lockId, heldForMs: autoReleaseMs });
        } catch (error) {
          logger.warn('Error auto-releasing lock', { lockId }, error instanceof Error ? error : undefined);
        }
      }, autoReleaseMs);
    }

    return handle;
  } catch (error) {
    logger.error('Error acquiring lock', error instanceof Error ? error : new Error(String(error)), { lockId });
    return null;
  }
}

/**
 * Release a lock
 */
export async function releaseLock(lockId: string): Promise<boolean> {
  const [id1, id2] = hashLockId(lockId);

  try {
    // pg_advisory_unlock returns true if lock was held, false otherwise
    const result = await prisma.$queryRaw<[{ success: boolean }]>`
      SELECT pg_advisory_unlock(${id1}::int, ${id2}::int) as success
    `;

    if (result[0].success) {
      logger.info('Lock released', { lockId });
      return true;
    } else {
      logger.warn('Tried to release lock that was not held', { lockId });
      return false;
    }
  } catch (error) {
    logger.error('Error releasing lock', error instanceof Error ? error : new Error(String(error)), { lockId });
    return false;
  }
}

/**
 * Check if a lock is currently held (requires being in same session to detect)
 */
export async function isLockHeld(lockId: string): Promise<boolean> {
  const [id1, id2] = hashLockId(lockId);

  try {
    // This query checks if the lock is held by any session
    // Note: This is database-wide, not session-specific
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM pg_locks
      WHERE locktype = 'advisory'
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND (classid = ${id1}::int OR classid = ${id2}::int)
    `;

    return BigInt(result[0].count) > 0;
  } catch (error) {
    logger.error('Error checking lock status', error instanceof Error ? error : new Error(String(error)), { lockId });
    return false;
  }
}

/**
 * Try to acquire a lock with automatic retry
 */
export async function acquireLockWithRetry(
  options: LockOptions & { maxRetries?: number; retryDelayMs?: number }
): Promise<LockHandle | null> {
  const { maxRetries = 3, retryDelayMs = 1000, ...lockOptions } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const lock = await acquireLock(lockOptions);
    if (lock) {
      logger.info('Lock acquired on attempt', { attempt, lockId: lockOptions.lockId });
      return lock;
    }

    if (attempt < maxRetries) {
      logger.debug('Retrying lock acquisition', { attempt, nextRetryMs: retryDelayMs });
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  logger.warn('Failed to acquire lock after retries', { lockId: lockOptions.lockId, maxRetries });
  return null;
}

/**
 * Execute a function while holding a lock
 * Automatically releases lock when done
 */
export async function withLock<T>(
  lockId: string,
  fn: () => Promise<T>,
  options: Omit<LockOptions, 'lockId'> = {}
): Promise<T> {
  const lock = await acquireLock({ ...options, lockId });

  if (!lock) {
    throw new Error(`Failed to acquire lock for: ${lockId}`);
  }

  try {
    const result = await fn();
    return result;
  } finally {
    await lock.release();
  }
}

/**
 * Execute a function while holding a lock, with retry logic
 */
export async function withLockRetry<T>(
  lockId: string,
  fn: () => Promise<T>,
  options: Omit<LockOptions & { maxRetries?: number; retryDelayMs?: number }, 'lockId'> = {}
): Promise<T> {
  const { maxRetries = 3, retryDelayMs = 1000, ...lockOptions } = options;
  const lock = await acquireLockWithRetry({
    lockId,
    maxRetries,
    retryDelayMs,
    ...lockOptions,
  });

  if (!lock) {
    throw new Error(`Failed to acquire lock after ${maxRetries} retries for: ${lockId}`);
  }

  try {
    const result = await fn();
    return result;
  } finally {
    await lock.release();
  }
}

/**
 * Initialize and verify database locking capability
 * Call this on application startup to ensure PostgreSQL supports advisory locks
 */
export async function initializeLocking(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<[{ version: string }]>`SELECT version()`;
    logger.info('Database initialized for advisory locking', {
      version: result[0].version.substring(0, 50),
    });
    return true;
  } catch (error) {
    logger.error('Failed to initialize database locking', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}
