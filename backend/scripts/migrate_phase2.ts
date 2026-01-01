#!/usr/bin/env tsx
/**
 * Phase 2 Migration: Initialize approval gates for existing projects
 * Run with: npx tsx backend/scripts/migrate_phase2.ts [--dry-run]
 */

import * as dotenv from 'dotenv';

// Load environment variables before importing anything else
dotenv.config({ path: '.env' });

export interface MigrationResult {
  projectsProcessed: number;
  gatesInitialized: number;
  errors: string[];
}

export interface MigrationOptions {
  dryRun?: boolean;
  projectIds?: string[];
}

/**
 * Phase 2 Migration: Initialize approval gates for existing projects
 */
export async function runPhase2Migration(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, projectIds } = options;

  // Dynamic imports to ensure dotenv runs first
  const { db } = await import('@/backend/lib/drizzle');
  const { ApprovalGateService } = await import('@/backend/services/approval/approval_gate_service');
  const { logger } = await import('@/lib/logger');

  logger.info('[Migration] Starting Phase 2 migration', { dryRun, projectIds });

  const result: MigrationResult = {
    projectsProcessed: 0,
    gatesInitialized: 0,
    errors: [],
  };

  try {
    // Get all projects or specific projects
    const allProjects = projectIds
      ? await db.query.projects.findMany({
          where: (p, { inArray }) => inArray(p.id, projectIds),
        })
      : await db.query.projects.findMany();

    logger.info('[Migration] Found projects', { count: allProjects.length });

    const approvalService = new ApprovalGateService();

    for (const project of allProjects) {
      try {
        if (!dryRun) {
          // Check if gates already initialized
          const existingGates = await approvalService.getProjectGates(project.id);

          if (existingGates.length > 0) {
            logger.info('[Migration] Gates already exist, skipping', {
              projectId: project.id,
              slug: project.slug,
            });
            continue;
          }

          // Initialize gates
          await approvalService.initializeGatesForProject(project.id);
          result.gatesInitialized += 4; // 4 gates per project
        } else {
          logger.info('[Migration] DRY RUN - would initialize gates', {
            projectId: project.id,
            slug: project.slug,
          });
          result.gatesInitialized += 4;
        }

        result.projectsProcessed++;
      } catch (error) {
        const errorMsg = `Failed to migrate project ${project.slug}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.error('[Migration] Project migration failed', { error: errorMsg });
        result.errors.push(errorMsg);
      }
    }

    logger.info('[Migration] Phase 2 migration complete', result);
    return result;
  } catch (error) {
    logger.error('[Migration] Migration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');

  runPhase2Migration({ dryRun })
    .then(result => {
      console.log('\n✅ Phase 2 Migration Complete');
      console.log(`   Projects processed: ${result.projectsProcessed}`);
      console.log(`   Gates initialized: ${result.gatesInitialized}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.log(`     - ${err}`));
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    });
}
