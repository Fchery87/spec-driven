import { DB_CONFIG } from '@/lib/config';
import * as schema from '@/backend/lib/schema';

// Get database URL from config
const databaseUrl = DB_CONFIG.url || process.env.DATABASE_URL;

// Determine which database to use
const isProduction = process.env.NODE_ENV === 'production';
const isTest =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  Boolean(process.env.VITEST);
const isLocalDev = !databaseUrl && !isProduction;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
let dbPromise: Promise<any> | null = null;

/**
 * Get or create the database connection lazily
 */
function getDb(): any {
  if (db) return db;
  
  // If already initializing, wait for the promise
  if (dbPromise) return dbPromise;
  
  // Start initialization
  dbPromise = initializeDb();
  return dbPromise;
}

/**
 * Set the database instance directly (for testing purposes)
 * @param mockDb - The mock database instance to use
 */
export function setDbForTesting(mockDb: any): void {
  db = mockDb;
  dbPromise = null;
}

/**
 * Clear the database instance (for testing purposes)
 */
export function clearDbForTesting(): void {
  db = undefined;
  dbPromise = null;
}

/**
 * Initialize the database connection
 */
async function initializeDb(): Promise<any> {
  if (isLocalDev) {
    // Use SQLite for local development - lazy initialization
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3');
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { drizzle: drizzleSqlite } = require('drizzle-orm/better-sqlite3');

      const sqlite = new Database(':memory:');

      // Enable foreign keys
      sqlite.pragma('foreign_keys = ON');

      db = drizzleSqlite(sqlite, { schema });

      console.warn(
        '[Database] Using in-memory SQLite for local development. DATABASE_URL not set.'
      );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      if (isTest) {
        db = new Proxy(
          {},
          {
            get() {
              throw new Error(
                'Database is not initialized in test mode. Install better-sqlite3 or set DATABASE_URL.'
              );
            },
          }
        );
        if (!isTest) {
          console.warn(
            '[Database] Using stubbed DB. Install better-sqlite3 for SQLite support.'
          );
        }
      } else {
        throw new Error(
          'Failed to initialize SQLite. Install better-sqlite3: npm install better-sqlite3'
        );
      }
    }
  } else {
    // Use Neon/Postgres for production or when DATABASE_URL is set
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required for production. Set DATABASE_URL environment variable.'
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/neon-http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless');

    // Create the Neon SQL client with connection pooling options
    const sql = neon(databaseUrl, {
      pool: {
        min: 2,
        max: 10,
      },
    });

    // Create the Drizzle instance with explicit connection pool configuration
    db = drizzle(sql, {
      schema,
      connection: {
        ssl: 'require',
      },
    });

    console.info('[Database] Using Neon/Postgres for production');
  }
  
  dbPromise = null; // Reset for future lazy re-initialization if needed
  return db;
}

// For synchronous access (legacy support), initialize lazily on first access
// The actual initialization happens when getDb() is called

export { db, getDb };
export default db;
