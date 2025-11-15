import { prisma } from './prisma';
import { Project } from '@prisma/client';

/**
 * Database layer for project management
 * Provides abstraction over Prisma for CRUD operations
 */

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
  handoff_generated_at?: Date | null;
}

/**
 * Create a new project in the database
 */
export async function createProject(data: ProjectData): Promise<Project> {
  return prisma.project.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description || null,
      current_phase: data.current_phase || 'ANALYSIS',
      phases_completed: data.phases_completed || '',
      stack_choice: data.stack_choice || null,
      stack_approved: data.stack_approved || false,
      dependencies_approved: data.dependencies_approved || false,
      handoff_generated: data.handoff_generated || false,
      handoff_generated_at: data.handoff_generated_at || null,
    },
  });
}

/**
 * Get a project by slug
 */
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  return prisma.project.findUnique({
    where: { slug },
  });
}

/**
 * Get a project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  return prisma.project.findUnique({
    where: { id },
  });
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  data: Partial<ProjectData>
): Promise<Project> {
  return prisma.project.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.current_phase && { current_phase: data.current_phase }),
      ...(data.phases_completed && { phases_completed: data.phases_completed }),
      ...(data.stack_choice !== undefined && { stack_choice: data.stack_choice }),
      ...(data.stack_approved !== undefined && { stack_approved: data.stack_approved }),
      ...(data.dependencies_approved !== undefined && {
        dependencies_approved: data.dependencies_approved,
      }),
      ...(data.handoff_generated !== undefined && {
        handoff_generated: data.handoff_generated,
      }),
      ...(data.handoff_generated_at !== undefined && {
        handoff_generated_at: data.handoff_generated_at,
      }),
    },
  });
}

/**
 * Update project metadata (common fields)
 */
export async function updateProjectMetadata(
  slug: string,
  metadata: Record<string, any>
): Promise<Project> {
  const project = await getProjectBySlug(slug);
  if (!project) {
    throw new Error(`Project not found: ${slug}`);
  }

  const updateData: any = {};

  // Map metadata fields to project fields
  if (metadata.current_phase) updateData.current_phase = metadata.current_phase;
  if (metadata.phases_completed) updateData.phases_completed = metadata.phases_completed;
  if (metadata.stack_choice) updateData.stack_choice = metadata.stack_choice;
  if (metadata.stack_approved !== undefined) updateData.stack_approved = metadata.stack_approved;
  if (metadata.dependencies_approved !== undefined) {
    updateData.dependencies_approved = metadata.dependencies_approved;
  }
  if (metadata.handoff_generated !== undefined) {
    updateData.handoff_generated = metadata.handoff_generated;
  }

  return prisma.project.update({
    where: { id: project.id },
    data: updateData,
  });
}

/**
 * Delete a project and all related artifacts
 */
export async function deleteProject(slug: string): Promise<boolean> {
  try {
    const project = await getProjectBySlug(slug);
    if (!project) {
      return false;
    }

    await prisma.project.delete({
      where: { id: project.id },
    });

    return true;
  } catch (error) {
    console.error(`Error deleting project ${slug}:`, error);
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
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      skip,
      take,
      orderBy: { created_at: 'desc' },
    }),
    prisma.project.count(),
  ]);

  return { projects, total };
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
  const fileHash = require('crypto')
    .createHash('sha256')
    .update(content)
    .digest('hex');

  await prisma.artifact.upsert({
    where: {
      project_id_phase_filename_version: {
        project_id: projectId,
        phase,
        filename,
        version,
      },
    },
    update: {
      content,
      file_hash: fileHash,
    },
    create: {
      project_id: projectId,
      phase,
      filename,
      content,
      version,
      file_hash: fileHash,
    },
  });
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
  const artifact = await prisma.artifact.findUnique({
    where: {
      project_id_phase_filename_version: {
        project_id: projectId,
        phase,
        filename,
        version,
      },
    },
  });

  return artifact?.content || null;
}

/**
 * List artifacts for a phase
 */
export async function listArtifacts(
  projectId: string,
  phase: string
): Promise<Array<{ filename: string; version: number; createdAt: Date }>> {
  const artifacts = await prisma.artifact.findMany({
    where: {
      project_id: projectId,
      phase,
    },
    select: {
      filename: true,
      version: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return artifacts.map(a => ({
    filename: a.filename,
    version: a.version,
    createdAt: a.created_at,
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
  await prisma.phaseHistory.create({
    data: {
      project_id: projectId,
      phase,
      status: errorMessage ? 'failed' : 'completed',
      completed_at: new Date(),
      duration_ms: durationMs,
      error_message: errorMessage,
    },
  });
}

/**
 * Get phase history for a project
 */
export async function getPhaseHistory(projectId: string) {
  return prisma.phaseHistory.findMany({
    where: { project_id: projectId },
    orderBy: { started_at: 'asc' },
  });
}
