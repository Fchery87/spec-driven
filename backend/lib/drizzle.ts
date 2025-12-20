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

if (isLocalDev) {
  // Use SQLite for local development
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

  // Create the Neon SQL client
  const sql = neon(databaseUrl);

  // Create the Drizzle instance
  db = drizzle(sql, { schema });

  console.info('[Database] Using Neon/Postgres for production');
}

export { db };
export default db;
