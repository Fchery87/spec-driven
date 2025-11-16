import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Prisma Client Singleton with Connection Pooling
 *
 * For production with Neon:
 * - Uses the connection string with pooling enabled
 * - PgBouncer pooling mode (Neon default) for serverless functions
 * - SSL/TLS required for secure connections
 * - Automatic connection reuse across requests
 *
 * Configuration:
 * - Database URL format: postgresql://user:pass@host/db?sslmode=require&channel_binding=require
 * - Neon automatically pools connections at the database proxy level
 * - No additional pool config needed - Neon handles it transparently
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Logging configuration
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'], // Minimal logging in production

    // Error formatting for better debugging
    errorFormat: 'pretty',
  });

// Reuse Prisma Client instance in development to avoid exhausting connections
// In production, Neon handles connection pooling at the database level
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connection Health Check
 * Validates that database connection is working
 */
export async function validateDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection validation failed:', error);
    return false;
  }
}
