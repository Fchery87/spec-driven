import { DB_CONFIG } from '@/lib/config';
import * as schema from '@/backend/lib/schema';
import { ExtractTablesWithRelations } from 'drizzle-orm/relations';
import { PgDatabase } from 'drizzle-orm/pg-core';

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
function initializeDatabase(): typeof _db {
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

// Create a typed database interface that matches PgDatabase
// This is used for the proxy to provide proper TypeScript intellisense
type TypedDb = {
  insert: typeof _db.insert;
  select: typeof _db.select;
  update: typeof _db.update;
  delete: typeof _db.delete;
  query: typeof _db.query;
  with: typeof _db.with;
  $with: typeof _db.$with;
  $count: typeof _db.$count;
  $cache: typeof _db.$cache;
  execute: typeof _db.execute;
  transaction: typeof _db.transaction;
  refreshMaterializedView: typeof _db.refreshMaterializedView;
  selectDistinct: typeof _db.selectDistinct;
  selectDistinctOn: typeof _db.selectDistinctOn;
};

// Create a proxy that initializes on first access (for Better Auth compatibility)
const dbProxy = new Proxy<TypedDb>(
  {} as TypedDb,
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

      // Type-safe access to drizzle-orm methods
      const value = (instance as Record<string, unknown>)?.[prop as string];
      return value as TypedDb[Extract<keyof TypedDb, string>];
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

// Export the proxy and helper functions
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
