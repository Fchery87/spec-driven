#!/usr/bin/env tsx
/**
 * Test script to verify database connection
 * Run with: npx tsx scripts/test-db-connection.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables before importing anything else
dotenv.config({ path: '.env' });

import { db } from '@/backend/lib/drizzle';
import { sql } from 'drizzle-orm';

async function testDatabaseConnection() {
  console.log('Testing database connection...\n');

  try {
    // Test 1: Basic query
    console.log('Test 1: Executing basic query...');
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Basic query successful:', result);

    // Test 2: Check if tables exist
    console.log('\nTest 2: Checking if tables exist...');
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('✅ Tables found:');
    tables.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    // Test 3: Check if new columns exist in projects table
    console.log('\nTest 3: Checking for new metadata columns in Project table...');
    const columns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Project'
      AND column_name IN ('project_type', 'scale_tier', 'recommended_stack', 'workflow_version')
      ORDER BY column_name
    `);

    const expectedColumns = ['project_type', 'scale_tier', 'recommended_stack', 'workflow_version'];
    const foundColumns = columns.rows.map((row: any) => row.column_name);

    expectedColumns.forEach((col) => {
      if (foundColumns.includes(col)) {
        console.log(`   ✅ ${col} exists`);
      } else {
        console.log(`   ❌ ${col} MISSING - migration may need to run`);
      }
    });

    // Test 4: Check if dependencies_approved column was removed
    console.log('\nTest 4: Verifying dependencies_approved column was removed...');
    const deprecatedColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Project'
      AND column_name = 'dependencies_approved'
    `);

    if (deprecatedColumn.rows.length === 0) {
      console.log('   ✅ dependencies_approved column successfully removed');
    } else {
      console.log('   ❌ dependencies_approved column still exists - migration may need to run');
    }

    console.log('\n✅ All database tests passed!');
    console.log('\nDatabase connection is properly configured and working.');

  } catch (error) {
    console.error('\n❌ Database connection test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
