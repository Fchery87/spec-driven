/**
 * Migration Helper
 *
 * Helps transition from file-based storage to database storage
 * This is useful during development when switching backends
 */

import { ProjectDBService } from '@/backend/services/database/project_db_service';
import { listArtifacts, getProjectMetadata } from '@/app/api/lib/project-utils';
import { readdirSync, existsSync } from 'fs';

const dbService = new ProjectDBService();

/**
 * Migrate a project from file-based storage to database
 */
export async function migrateProjectToDatabase(slug: string) {
  console.log(`Starting migration for project: ${slug}`);

  try {
    // Get project metadata from file system
    const metadata = getProjectMetadata(slug);
    if (!metadata) {
      throw new Error(`Project not found: ${slug}`);
    }

    // Create project in database
    const project = await dbService.createProject({
      name: metadata.name,
      description: metadata.description,
      slug
    });

    console.log(`Created database project: ${project.id}`);

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
      const artifacts = listArtifacts(slug, phase);
      for (const artifact of artifacts) {
        await dbService.saveArtifact(
          project.id,
          phase,
          artifact.name,
          artifact.content || ''
        );
        console.log(`  Migrated: ${phase}/${artifact.name}`);
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
        'Migrated from file-based storage'
      );
    }

    // Migrate dependencies approval if applicable
    if (metadata.dependencies_approved) {
      await dbService.approveDependencies(
        slug,
        'Migrated from file-based storage'
      );
    }

    console.log(`✅ Migration completed successfully for: ${slug}`);
    return project;
  } catch (error) {
    console.error(`❌ Migration failed for ${slug}:`, error);
    throw error;
  }
}

/**
 * Migrate all projects from file-based to database storage
 */
export async function migrateAllProjectsToDatabase() {
  const projectsDir = './projects';

  if (!existsSync(projectsDir)) {
    console.log('No projects directory found');
    return;
  }

  const projectDirs = readdirSync(projectsDir).filter(dir => {
    return existsSync(`${projectsDir}/${dir}/metadata.json`);
  });

  console.log(`Found ${projectDirs.length} projects to migrate`);

  for (const slug of projectDirs) {
    try {
      await migrateProjectToDatabase(slug);
    } catch (error) {
      console.error(`Failed to migrate project ${slug}:`, error);
    }
  }

  console.log('Migration completed');
}

/**
 * Verify database integrity after migration
 */
export async function verifyMigration(slug: string) {
  const project = await dbService.getProjectBySlug(slug);

  if (!project) {
    throw new Error(`Project not found in database: ${slug}`);
  }

  console.log(`\nVerification Report for: ${project.name}`);
  console.log(`Project ID: ${project.id}`);
  console.log(`Current Phase: ${project.current_phase}`);
  console.log(`Phases Completed: ${project.phases_completed || 'none'}`);
  console.log(`Total Artifacts: ${project.artifacts.length}`);
  console.log(`Stack Approved: ${project.stack_approved}`);
  console.log(`Dependencies Approved: ${project.dependencies_approved}`);
  console.log(`Handoff Generated: ${project.handoff_generated}`);

  // Count artifacts by phase
  const artifactsByPhase: Record<string, number> = {};
  for (const artifact of project.artifacts) {
    artifactsByPhase[artifact.phase] =
      (artifactsByPhase[artifact.phase] || 0) + 1;
  }

  console.log(`\nArtifacts by Phase:`);
  for (const [phase, count] of Object.entries(artifactsByPhase)) {
    console.log(`  ${phase}: ${count}`);
  }

  console.log(`\n✅ Verification complete`);
}
