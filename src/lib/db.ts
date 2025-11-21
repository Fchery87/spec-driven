import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { Project, Artifact, PhaseHistory } from '@/backend/lib/schema';
import { logger } from './logger';

/**
 * Database layer for project management
 * Uses Drizzle ORM under the hood
 */

const dbService = new ProjectDBService();

export interface ProjectData {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  current_phase?: string;
  phases_completed?: string;
  stack_choice?: string | null;
  stack_approved?: boolean;
  dependencies_approved?: boolean;
  handoff_generated?: boolean;
  handoff_generated_at?: Date | string | null;
}

/**
 * Create a new project in the database
 */
export async function createProject(data: ProjectData): Promise<Project> {
  return dbService.createProject({
    slug: data.slug,
    name: data.name,
    description: data.description || undefined,
  });
}

/**
 * Get a project by slug
 */
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const project = await dbService.getProjectBySlug(slug);
  return project || null;
}

/**
 * Get a project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const project = await dbService.getProjectById(id);
  return project || null;
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  data: Partial<ProjectData>
): Promise<Project> {
  const project = await getProjectById(id);
  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }

  // Use the drizzle service to update
  // For now, we'll need to update by slug since our service uses slug
  return dbService.updateProjectPhase(project.slug, data.current_phase || project.currentPhase);
}

/**
 * Update project metadata (common fields)
 */
export async function updateProjectMetadata(
  slug: string,
  metadata: Record<string, unknown>
): Promise<Project> {
  const project = await getProjectBySlug(slug);
  if (!project) {
    throw new Error(`Project not found: ${slug}`);
  }

  // Map metadata fields and update
  // Since Drizzle service doesn't have a general update method,
  // we'll update specific fields as needed

  if (metadata.current_phase && typeof metadata.current_phase === 'string') {
    return dbService.updateProjectPhase(slug, metadata.current_phase);
  }

  if (metadata.stack_choice && metadata.stack_approved) {
    return dbService.approveStackSelection(
      slug,
      String(metadata.stack_choice),
      String(metadata.stack_reasoning || '')
    );
  }

  if (metadata.dependencies_approved) {
    return dbService.approveDependencies(slug, String(metadata.dependencies_approval_notes || ''));
  }

  if (metadata.handoff_generated) {
    return dbService.markHandoffGenerated(slug);
  }

  // If no specific update, just return the project as-is
  return project;
}

/**
 * Delete a project and all related artifacts
 */
export async function deleteProject(slug: string): Promise<boolean> {
  try {
    await dbService.deleteProject(slug);
    return true;
  } catch (error) {
    logger.error(`Error deleting project ${slug}`, error instanceof Error ? error : new Error(String(error)), { slug });
    return false;
  }
}

/**
 * List all projects with pagination
 */
export async function listProjects(
  skip: number = 0,
  take: number = 50
): Promise<{ projects: Project[]; total: number }> {
  return dbService.listProjects(skip, take);
}

/**
 * Save an artifact for a project
 */
export async function saveArtifact(
  projectId: string,
  phase: string,
  filename: string,
  content: string,
  version: number = 1
): Promise<void> {
  await dbService.saveArtifact(projectId, phase, filename, content);
}

/**
 * Get an artifact for a project
 */
export async function getArtifact(
  projectId: string,
  phase: string,
  filename: string,
  version: number = 1
): Promise<string | null> {
  const artifacts = await dbService.getArtifactsByPhase(projectId, phase);
  const artifact = artifacts.find(a => a.filename === filename && a.version === version);
  return artifact?.content || null;
}

/**
 * List artifacts for a phase
 */
export async function listArtifacts(
  projectId: string,
  phase: string
): Promise<Array<{ filename: string; version: number; createdAt: Date }>> {
  const artifacts = await dbService.getArtifactsByPhase(projectId, phase);
  return artifacts.map(a => ({
    filename: a.filename,
    version: a.version,
    createdAt: a.createdAt,
  }));
}

/**
 * Record phase completion
 */
export async function recordPhaseCompletion(
  projectId: string,
  phase: string,
  durationMs: number = 0,
  errorMessage?: string
): Promise<void> {
  const status = errorMessage ? 'failed' : 'completed';
  await dbService.recordPhaseHistory(projectId, phase, status, errorMessage);
}

/**
 * Get phase history for a project
 */
export async function getPhaseHistory(projectId: string): Promise<PhaseHistory[]> {
  const project = await getProjectById(projectId);
  if (!project) {
    return [];
  }

  // Use Drizzle service to get stats which includes phase history
  try {
    const stats = await dbService.getProjectStats(project.slug);
    return stats.phase_history || [];
  } catch {
    return [];
  }
}
