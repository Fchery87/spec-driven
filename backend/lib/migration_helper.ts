/**
 * Migration Helper
 *
 * Helps transition from file-based storage to database storage
 * This is useful during development when switching backends
 */

import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { listArtifacts, getProjectMetadata } from '@/app/api/lib/project-utils';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '@/lib/logger';

const dbService = new ProjectDBService();

/**
 * Migrate a project from file-based storage to database
 */
export async function migrateProjectToDatabase(slug: string) {
  logger.info(`Starting migration for project: ${slug}`);

  try {
    // Get project metadata from file system
    const metadata = await getProjectMetadata(slug);
    if (!metadata) {
      throw new Error(`Project not found: ${slug}`);
    }

    const ownerId = metadata.created_by_id;
    if (!ownerId) {
      throw new Error(`Project owner missing for ${slug}`);
    }

    // Create project in database
    const project = await dbService.createProject({
      name: metadata.name,
      description: metadata.description,
      slug,
      ownerId
    });

    logger.info(`Created database project: ${project.id}`);

    // Migrate all artifacts
    const allPhases = [
      'ANALYSIS',
      'STACK_SELECTION',
      'SPEC',
      'DEPENDENCIES',
      'SOLUTIONING',
      'DONE'
    ];

    for (const phase of allPhases) {
      const artifacts = await listArtifacts(slug, phase);
      for (const artifact of artifacts) {
        try {
          // Read file content from filesystem
          const artifactPath = resolve(process.cwd(), 'projects', slug, 'specs', phase, 'v1', artifact.name);
          const content = existsSync(artifactPath) ? readFileSync(artifactPath, 'utf-8') : '';

          await dbService.saveArtifact(
            project.id,
            phase,
            artifact.name,
            content
          );
          logger.info(`  Migrated: ${phase}/${artifact.name}`);
        } catch (err) {
          logger.warn(`  Failed to migrate: ${phase}/${artifact.name}`, { error: String(err) });
        }
      }
    }

    // Migrate phase information
    if (metadata.phases_completed) {
      for (const phase of metadata.phases_completed.split(',')) {
        if (phase) {
          await dbService.recordPhaseHistory(project.id, phase, 'completed');
        }
      }
    }

    // Migrate stack selection if applicable
    if (metadata.stack_approved && metadata.stack_choice) {
      await dbService.approveStackSelection(
        slug,
        metadata.stack_choice,
        'Migrated from file-based storage',
        ownerId
      );
    }

    logger.info(`✅ Migration completed successfully for: ${slug}`);
    return project;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`❌ Migration failed for ${slug}:`, err);
    throw error;
  }
}

/**
 * Migrate all projects from file-based to database storage
 */
export async function migrateAllProjectsToDatabase() {
  const projectsDir = './projects';

  if (!existsSync(projectsDir)) {
    logger.info('No projects directory found');
    return;
  }

  const projectDirs = readdirSync(projectsDir).filter(dir => {
    return existsSync(`${projectsDir}/${dir}/metadata.json`);
  });

  logger.info(`Found ${projectDirs.length} projects to migrate`);

  for (const slug of projectDirs) {
    try {
      await migrateProjectToDatabase(slug);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to migrate project ${slug}:`, err);
    }
  }

  logger.info('Migration completed');
}

/**
 * Verify database integrity after migration
 */
export async function verifyMigration(slug: string) {
  const project = await dbService.getProjectBySlug(slug);

  if (!project) {
    throw new Error(`Project not found in database: ${slug}`);
  }

  logger.info(`\nVerification Report for: ${project.name}`);
  logger.info(`Project ID: ${project.id}`);
  logger.info(`Current Phase: ${project.currentPhase}`);
  logger.info(`Phases Completed: ${project.phasesCompleted || 'none'}`);
  logger.info(`Total Artifacts: ${project.artifacts.length}`);
  logger.info(`Stack Approved: ${project.stackApproved}`);
  logger.info(`Handoff Generated: ${project.handoffGenerated}`);

  // Count artifacts by phase
  const artifactsByPhase: Record<string, number> = {};
  for (const artifact of project.artifacts) {
    artifactsByPhase[artifact.phase] =
      (artifactsByPhase[artifact.phase] || 0) + 1;
  }

  logger.info(`\nArtifacts by Phase:`);
  for (const [phase, count] of Object.entries(artifactsByPhase)) {
    logger.info(`  ${phase}: ${count}`);
  }

  logger.info(`\n✅ Verification complete`);
}
