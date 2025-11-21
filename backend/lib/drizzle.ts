import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { DB_CONFIG } from '@/lib/config';
import * as schema from '@/backend/lib/schema';

// Get database URL from config
const databaseUrl = DB_CONFIG.url || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

// Create the Neon SQL client
const sql = neon(databaseUrl);

// Create the Drizzle instance
export const db = drizzle(sql, { schema });

export default db;
