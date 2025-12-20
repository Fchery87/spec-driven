import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { resolve } from 'path';
import { logger } from '@/lib/logger';
import {
  uploadToR2,
  downloadFromR2,
  listR2Artifacts,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteFromR2,
  uploadProjectMetadata as uploadMetadataToR2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uploadProjectIdea as uploadIdeaToR2,
} from '@/lib/r2-storage';

import type { ClarificationState } from '@/types/orchestrator';

export interface ProjectMetadata {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  current_phase: string;
  phases_completed: string | string[];
  stack_choice?: string | null;
  stack_approved: boolean;
  dependencies_approved: boolean;
  project_type?: string | null;
  scale_tier?: string | null;
  recommended_stack?: string | null;
  workflow_version?: number;
  created_by_id?: string;
  handoff_generated?: boolean;
  handoff_generated_at?: string;
  orchestration_state?: Record<string, unknown>;
  clarification_state?: ClarificationState;
  created_at?: string;
  updated_at?: string;
}

export const getProjectsPath = () => resolve(process.cwd(), 'projects');

// Helper to check if R2 is configured (supports both naming conventions)
const isR2Configured = () => 
  (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID) && 
  (process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID);

/**
 * Get project metadata from R2 or local file system
 * Tries R2 first if configured, falls back to local file system
 */
export const getProjectMetadata = async (slug: string, ownerId?: string) => {
  // Try R2 first if configured
  if (isR2Configured()) {
    try {
      const buffer = await downloadFromR2(slug, 'metadata', 'metadata.json');
      const metadata = JSON.parse(buffer.toString('utf-8'));
      if (ownerId) {
        // If metadata missing owner, skip validation and fall through to database fallback
        if (!metadata.created_by_id) {
          logger.warn('Metadata missing owner in R2 payload, falling back to database', { slug, ownerId });
          // Don't return here - let it fall through to database fallback
        } else if (metadata.created_by_id !== ownerId) {
          // Only fail if owner exists but doesn't match
          logger.warn('Metadata ownership mismatch from R2', { slug, ownerId, createdBy: metadata.created_by_id });
          return null;
        } else {
          // Owner exists and matches - return metadata with owner added if missing
          return { ...metadata, created_by_id: ownerId };
        }
      } else {
        // No ownership check needed
        return metadata;
      }
    } catch {
      logger.debug('Failed to get project metadata from R2, trying local file system', { slug });
    }
  }

  // Fallback to local file system for development
  try {
    const path = resolve(getProjectsPath(), slug, 'metadata.json');
    if (existsSync(path)) {
      const metadata = JSON.parse(readFileSync(path, 'utf8'));
      if (ownerId) {
        // If metadata missing owner, skip validation and fall through to database fallback
        if (!metadata.created_by_id) {
          logger.warn('Metadata missing owner in filesystem payload, falling back to database', { slug, ownerId });
          // Don't return here - let it fall through to database fallback
        } else if (metadata.created_by_id !== ownerId) {
          // Only fail if owner exists but doesn't match
          logger.warn('Metadata ownership mismatch from filesystem', { slug, ownerId, createdBy: metadata.created_by_id });
          return null;
        } else {
          // Owner exists and matches - return metadata with owner
          return { ...metadata, created_by_id: ownerId };
        }
      } else {
        // No ownership check needed
        return metadata;
      }
    }
  } catch {
    // ignore and fall through to DB lookup
  }

  // Last resort: pull metadata from database so routes don't 404 if R2/local files are missing
  try {
    const { ProjectDBService } = await import('@/backend/services/database/drizzle_project_db_service');
    const dbService = new ProjectDBService();
    const project = await dbService.getProjectBySlug(slug, ownerId);
    if (project) {
      // Parse clarification_state from JSON string if present
      let clarificationState: ClarificationState | undefined;
      if (project.clarificationState) {
        try {
          clarificationState = JSON.parse(project.clarificationState) as ClarificationState;
        } catch {
          logger.warn('Failed to parse clarification_state from database', { slug });
        }
      }

      return {
        id: project.id,
        slug: project.slug,
        name: project.name,
        description: project.description,
        current_phase: project.currentPhase,
        phases_completed: project.phasesCompleted,
        stack_choice: project.stackChoice,
        stack_approved: project.stackApproved,
        dependencies_approved: project.dependenciesApproved,
        project_type: project.projectType,
        scale_tier: project.scaleTier,
        recommended_stack: project.recommendedStack,
        workflow_version: project.workflowVersion,
        handoff_generated: project.handoffGenerated,
        handoff_generated_at: project.handoffGeneratedAt?.toISOString?.(),
        created_by_id: project.ownerId,
        orchestration_state: { artifact_versions: {}, phase_history: [], approval_gates: {} },
        clarification_state: clarificationState,
        created_at: project.createdAt?.toISOString?.(),
        updated_at: project.updatedAt?.toISOString?.()
      } satisfies ProjectMetadata;
    }
  } catch (dbError) {
    logger.debug('Failed to load project metadata from database', { slug, error: dbError instanceof Error ? dbError.message : String(dbError) });
  }

  return null;
};

/**
 * Save project metadata to R2 or local file system
 * Saves to R2 if configured, otherwise saves locally for development
 */
export const saveProjectMetadata = async (slug: string, metadata: ProjectMetadata) => {
  // Try R2 first if configured
  if (isR2Configured()) {
    try {
      await uploadMetadataToR2(slug, metadata as unknown as Record<string, unknown>);
      return;
    } catch {
      logger.debug('Failed to save project metadata to R2, trying local file system', { slug });
    }
  }

  // Fallback to local file system for development
  const dir = resolve(getProjectsPath(), slug);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(resolve(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));
};

/**
 * List all projects from file system
 */
export const listAllProjects = () => {
  const projectsPath = getProjectsPath();
  if (!existsSync(projectsPath)) {
    return [];
  }
  try {
    return readdirSync(projectsPath).filter(item => {
      const itemPath = resolve(projectsPath, item);
      return statSync(itemPath).isDirectory();
    });
  } catch {
    return [];
  }
};

/**
 * List artifacts for a phase from R2 or local file system
 * Falls back to database if R2 returns empty or fails
 */
export const listArtifacts = async (slug: string, phase: string) => {
  logger.info('listArtifacts called', { slug, phase, r2Configured: !!isR2Configured() });

  const artifactsByName = new Map<string, number>();

  // Try R2 first if configured
  if (isR2Configured()) {
    try {
      const artifacts = await listR2Artifacts(slug, phase);
      for (const artifact of artifacts) {
        artifactsByName.set(artifact.name, artifact.size);
      }
      logger.info('Artifacts listed from R2', { slug, phase, count: artifacts.length });
    } catch (r2Error) {
      logger.warn('Failed to list artifacts from R2, trying database fallback', {
        slug,
        phase,
        error: r2Error instanceof Error ? r2Error.message : String(r2Error)
      });
    }
  }

  // Try database fallback (important for Vercel where R2 might have consistency delays)
  try {
    const { ProjectDBService } = await import('@/backend/services/database/drizzle_project_db_service');
    const dbService = new ProjectDBService();
    const project = await dbService.getProjectBySlug(slug);

    if (project) {
      logger.info('Project found in database, fetching artifacts', { slug, phase, projectId: project.id });
      const dbArtifacts = await dbService.getArtifactsByPhase(project.id, phase);
      logger.info('Database artifacts query result', { slug, phase, count: dbArtifacts.length });

      if (dbArtifacts.length > 0) {
        logger.info('Artifacts listed from database', { slug, phase, count: dbArtifacts.length });
        for (const artifact of dbArtifacts as Array<{ filename: string; content: string }>) {
          const size = artifact.content ? Buffer.byteLength(artifact.content, 'utf8') : 0;
          const existing = artifactsByName.get(artifact.filename);
          artifactsByName.set(artifact.filename, Math.max(existing || 0, size));
        }
      }
    } else {
      logger.warn('Project not found in database', { slug, phase });
    }
  } catch (dbError) {
    logger.error('Failed to list artifacts from database', dbError instanceof Error ? dbError : new Error(String(dbError)), { slug, phase });
  }

  // Fallback to local file system (development only)
  const phasePath = resolve(getProjectsPath(), slug, 'specs', phase, 'v1');
  if (existsSync(phasePath)) {
    try {
      const names = readdirSync(phasePath);
      for (const name of names) {
        const size = statSync(resolve(phasePath, name)).size;
        const existing = artifactsByName.get(name);
        artifactsByName.set(name, Math.max(existing || 0, size));
      }
      logger.info('Artifacts listed from local filesystem', { slug, phase, count: names.length });
    } catch {
      // Fall through to empty array
    }
  }

  const merged = Array.from(artifactsByName.entries())
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (merged.length === 0) {
    logger.warn('No artifacts found in any storage layer', { slug, phase });
  }

  return merged;
};

/**
 * Write artifact to R2 or file system
 */
export const writeArtifact = async (slug: string, phase: string, name: string, content: string) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Try R2 first if configured
  if (isR2Configured()) {
    try {
      const key = await uploadToR2(slug, phase, name, content, {
        contentType: 'application/octet-stream',
      });
      logger.debug('Artifact saved to R2', { slug, phase, name, key });
      return key;
    } catch (r2Error) {
      const err = r2Error instanceof Error ? r2Error : new Error(String(r2Error));
      logger.error('Failed to write artifact to R2', err, {
        slug,
        phase,
        name,
        r2Error: err.message
      });

      // In production (Vercel), fail fast - don't fall back to ephemeral filesystem
      if (isProduction) {
        throw new Error(`Failed to save artifact to R2: ${err.message}`);
      }

      // In development, try local filesystem fallback
      logger.warn('Falling back to local filesystem for artifact', { slug, phase, name });
    }
  } else {
    logger.debug('R2 not configured, using local filesystem for artifacts', { slug, phase, name });
  }

  // Fallback to local file system (development only, or when R2 not configured)
  try {
    const dir = resolve(getProjectsPath(), slug, 'specs', phase, 'v1');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const path = resolve(dir, name);
    writeFileSync(path, content, 'utf8');
    logger.debug('Artifact saved to local filesystem', { slug, phase, name, path });
    return path;
  } catch (fsError) {
    const err = fsError instanceof Error ? fsError : new Error(String(fsError));
    logger.error('Failed to save artifact to both R2 and filesystem', err, { slug, phase, name });
    throw err;
  }
};

/**
 * Save artifact to R2 or file system
 * Wrapper around writeArtifact for compatibility
 */
export const saveArtifact = async (slug: string, phase: string, name: string, content: string): Promise<string> => {
  return writeArtifact(slug, phase, name, content);
};

/**
 * Read artifact from R2 or file system
 */
export const readArtifact = async (slug: string, phase: string, name: string): Promise<string> => {
  // Try R2 first if configured
  if (isR2Configured()) {
    try {
      const buffer = await downloadFromR2(slug, phase, name);
      logger.debug('Artifact read from R2', { slug, phase, name });
      return buffer.toString('utf-8');
    } catch (r2Error) {
      const err = r2Error instanceof Error ? r2Error : new Error(String(r2Error));
      logger.debug('Failed to read artifact from R2, trying local file system', {
        slug,
        phase,
        name,
        r2Error: err.message
      });
    }
  } else {
    logger.debug('R2 not configured, trying local filesystem', { slug, phase, name });
  }

  // Fallback to local file system
  try {
    const path = resolve(getProjectsPath(), slug, 'specs', phase, 'v1', name);
    logger.debug('Artifact read from local filesystem', { slug, phase, name, path });
    return readFileSync(path, 'utf-8');
  } catch (error) {
    logger.debug('Failed to read artifact from filesystem, trying database', {
      slug,
      phase,
      name,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Fallback to database content (latest version)
  try {
    const { ProjectDBService } = await import('@/backend/services/database/drizzle_project_db_service');
    const dbService = new ProjectDBService();
    const project = await dbService.getProjectBySlug(slug);
    if (!project) {
      throw new Error('Project not found in database');
    }

    const dbArtifacts = await dbService.getArtifactsByPhase(project.id, phase);
    const latest = dbArtifacts.find((a: { filename: string }) => a.filename === name);
    if (!latest || !latest.content) {
      throw new Error('Artifact not found in database');
    }

    return latest.content;
  } catch (dbError) {
    const err = dbError instanceof Error ? dbError : new Error(String(dbError));
    logger.error(`Error reading artifact from all sources`, err, { slug, phase, name });
    throw err;
  }
};

/**
 * Delete project from file system
 * Note: Async database deletion should be called separately
 * Returns true if the project was deleted or didn't exist (R2-only projects)
 * Returns false only on actual deletion errors
 */
export const deleteProject = (slug: string): boolean => {
  try {
    const projectPath = resolve(getProjectsPath(), slug);
    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
      logger.info('Project directory deleted from local filesystem', { slug, projectPath });
    } else {
      logger.debug('Project directory does not exist locally, nothing to delete', { slug, projectPath });
    }
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error deleting project ${slug}:`, err);
    return false;
  }
};

/**
 * Database persistence helper functions
 * These are async and should be called from route handlers
 */
export async function persistProjectToDB(slug: string, metadata: ProjectMetadata) {
  try {
    const db = await import('@/lib/db');
    const ownerId = metadata.created_by_id;

    if (!ownerId) {
      logger.warn('Skipping database persistence because owner is missing', { slug });
      return;
    }

    const project = await db.getProjectBySlug(slug, ownerId);

    // Ensure phases_completed is a string (comma-separated, not an array)
    const phasesCompleted = Array.isArray(metadata.phases_completed)
      ? metadata.phases_completed.filter((p: string) => p).join(',')
      : (metadata.phases_completed || '');

    if (project) {
      await db.updateProjectMetadata(slug, {
        ...metadata,
        owner_id: ownerId,
        phases_completed: phasesCompleted,
      });

      const workflowUpdate: Record<string, unknown> = { owner_id: ownerId };
      if (metadata.project_type !== undefined) {
        workflowUpdate.project_type = metadata.project_type;
      }
      if (metadata.scale_tier !== undefined) {
        workflowUpdate.scale_tier = metadata.scale_tier;
      }
      if (metadata.recommended_stack !== undefined) {
        workflowUpdate.recommended_stack = metadata.recommended_stack;
      }
      if (metadata.workflow_version !== undefined) {
        workflowUpdate.workflow_version = metadata.workflow_version;
      }

      if (Object.keys(workflowUpdate).length > 1) {
        await db.updateProjectMetadata(slug, workflowUpdate);
      }
    } else {
      await db.createProject({
        slug,
        name: metadata.name,
        description: metadata.description,
        current_phase: metadata.current_phase,
        phases_completed: phasesCompleted,
        stack_choice: metadata.stack_choice,
        stack_approved: metadata.stack_approved,
        dependencies_approved: metadata.dependencies_approved,
        handoff_generated: metadata.handoff_generated,
        handoff_generated_at: metadata.handoff_generated_at,
        owner_id: ownerId,
      });

      const workflowUpdate: Record<string, unknown> = { owner_id: ownerId };
      if (metadata.project_type !== undefined) {
        workflowUpdate.project_type = metadata.project_type;
      }
      if (metadata.scale_tier !== undefined) {
        workflowUpdate.scale_tier = metadata.scale_tier;
      }
      if (metadata.recommended_stack !== undefined) {
        workflowUpdate.recommended_stack = metadata.recommended_stack;
      }
      if (metadata.workflow_version !== undefined) {
        workflowUpdate.workflow_version = metadata.workflow_version;
      }

      if (Object.keys(workflowUpdate).length > 1) {
        await db.updateProjectMetadata(slug, workflowUpdate);
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error persisting project ${slug} to database:`, err);
  }
}

export async function deleteProjectFromDB(slug: string, ownerId?: string): Promise<boolean> {
  try {
    const db = await import('@/lib/db');
    return await db.deleteProject(slug, ownerId);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error deleting project ${slug} from database:`, err);
    return false;
  }
}
