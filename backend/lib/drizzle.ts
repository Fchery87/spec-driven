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
let _db: any;
let _initialized = false;

/**
 * Initialize the database connection
 */
function initializeDatabase(): any {
  if (_initialized && _db) return _db;
  
  if (isLocalDev) {
    // Use SQLite for local development
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3');
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { drizzle: drizzleSqlite } = require('drizzle-orm/better-sqlite3');

      const sqlite = new Database(':memory:');
      sqlite.pragma('foreign_keys = ON');

      _db = drizzleSqlite(sqlite, { schema });
      _initialized = true;

      console.warn(
        '[Database] Using in-memory SQLite for local development. DATABASE_URL not set.'
      );
    } catch (error) {
      if (isTest) {
        // In test mode, don't initialize - let tests provide mock
        _db = undefined;
        _initialized = false;
      } else {
        throw new Error(
          'Failed to initialize SQLite. Install better-sqlite3: npm install better-sqlite3'
        );
      }
    }
  } else {
    // Use Neon/Postgres for production
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required for production. Set DATABASE_URL environment variable.'
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/neon-http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless');

    const sql = neon(databaseUrl, {
      pool: {
        min: 2,
        max: 10,
      },
    });

    _db = drizzle(sql, {
      schema,
      connection: {
        ssl: 'require',
      },
    });
    _initialized = true;

    console.info('[Database] Using Neon/Postgres for production');
  }
  
  return _db;
}

// Create a proxy that initializes on first access (for Better Auth compatibility)
const dbProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === 'then') return undefined; // Not a thenable
      
      // In test mode, don't try to initialize - just return undefined
      // Tests must call setDbForTesting first
      if (isTest && !_initialized) {
        return undefined;
      }
      
      const instance = initializeDatabase();
      if (!instance) return undefined;
      return (instance as any)?.[prop];
    },
    has(target, prop) {
      if (prop === 'then') return false;
      
      // In test mode, don't try to initialize
      if (isTest && !_initialized) {
        return false;
      }
      
      const instance = initializeDatabase();
      return instance ? prop in instance : false;
    },
  }
);

// Export both the proxy and a getter function
// The proxy is for Better Auth which imports db directly
// The getter is for tests to get the mock after setDbForTesting
export const db = dbProxy;

/**
 * Get the database instance (for internal use and testing)
 */
export function getDb(): any {
  return initializeDatabase();
}

/**
 * Set the database instance directly (for testing purposes)
 * @param mockDb - The mock database instance to use
 */
export function setDbForTesting(mockDb: any): void {
  _db = mockDb;
  _initialized = true;
}

/**
 * Clear the database instance (for testing purposes)
 */
export function clearDbForTesting(): void {
  _db = undefined;
  _initialized = false;
}
