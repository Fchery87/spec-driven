import prisma from '@/backend/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export class ProjectDBService {
  /**
   * Create a new project
   */
  async createProject(data: {
    name: string;
    description?: string;
    slug: string;
  }) {
    return prisma.project.create({
      data: {
        id: uuidv4(),
        slug: data.slug,
        name: data.name,
        description: data.description || null,
        current_phase: 'ANALYSIS',
        phases_completed: ''
      }
    });
  }

  /**
   * Get project by slug
   */
  async getProjectBySlug(slug: string) {
    return prisma.project.findUnique({
      where: { slug },
      include: {
        artifacts: true,
        phase_history: {
          orderBy: { started_at: 'desc' },
          take: 20
        }
      }
    });
  }

  /**
   * Get project by ID
   */
  async getProjectById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        artifacts: true,
        phase_history: {
          orderBy: { started_at: 'desc' }
        }
      }
    });
  }

  /**
   * List all projects
   */
  async listProjects(skip = 0, take = 20) {
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { artifacts: true }
          }
        }
      }),
      prisma.project.count()
    ]);

    return { projects, total, skip, take };
  }

  /**
   * Update project phase
   */
  async updateProjectPhase(slug: string, newPhase: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    const phasesCompleted = project.phases_completed
      ? project.phases_completed.split(',').filter(p => p)
      : [];

    if (!phasesCompleted.includes(project.current_phase)) {
      phasesCompleted.push(project.current_phase);
    }

    return prisma.project.update({
      where: { slug },
      data: {
        current_phase: newPhase,
        phases_completed: phasesCompleted.join(','),
        updated_at: new Date()
      }
    });
  }

  /**
   * Approve stack selection
   */
  async approveStackSelection(slug: string, stackChoice: string, reasoning: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    // Create stack choice record
    await prisma.stackChoice.upsert({
      where: { project_id: project.id },
      update: { stack_id: stackChoice, reasoning },
      create: {
        id: uuidv4(),
        project_id: project.id,
        stack_id: stackChoice,
        reasoning
      }
    });

    // Update project
    return prisma.project.update({
      where: { slug },
      data: {
        stack_choice: stackChoice,
        stack_approved: true,
        updated_at: new Date()
      }
    });
  }

  /**
   * Approve dependencies
   */
  async approveDependencies(slug: string, notes?: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    // Create approval record
    await prisma.dependencyApproval.upsert({
      where: { project_id: project.id },
      update: { notes: notes || null },
      create: {
        id: uuidv4(),
        project_id: project.id,
        notes: notes || null
      }
    });

    // Update project
    return prisma.project.update({
      where: { slug },
      data: {
        dependencies_approved: true,
        updated_at: new Date()
      }
    });
  }

  /**
   * Save artifact
   */
  async saveArtifact(
    projectId: string,
    phase: string,
    filename: string,
    content: string
  ) {
    // Get current version for this artifact
    const existing = await prisma.artifact.findFirst({
      where: {
        project_id: projectId,
        phase,
        filename
      },
      orderBy: { version: 'desc' },
      take: 1
    });

    const version = (existing?.version || 0) + 1;

    return prisma.artifact.create({
      data: {
        id: uuidv4(),
        project_id: projectId,
        phase,
        filename,
        content,
        version
      }
    });
  }

  /**
   * Get artifacts for a phase
   */
  async getArtifactsByPhase(projectId: string, phase: string) {
    return prisma.artifact.findMany({
      where: {
        project_id: projectId,
        phase
      },
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Get all artifacts for project
   */
  async getAllArtifacts(projectId: string) {
    return prisma.artifact.findMany({
      where: { project_id: projectId },
      orderBy: [{ phase: 'asc' }, { created_at: 'desc' }]
    });
  }

  /**
   * Record phase completion
   */
  async recordPhaseHistory(
    projectId: string,
    phase: string,
    status: 'in_progress' | 'completed' | 'failed',
    errorMessage?: string
  ) {
    const record = await prisma.phaseHistory.create({
      data: {
        id: uuidv4(),
        project_id: projectId,
        phase,
        status,
        error_message: errorMessage || null
      }
    });

    // If completed, update duration
    if (status === 'completed') {
      const duration = Date.now() - record.started_at.getTime();
      return prisma.phaseHistory.update({
        where: { id: record.id },
        data: {
          completed_at: new Date(),
          duration_ms: duration
        }
      });
    }

    return record;
  }

  /**
   * Delete project (cascade deletes artifacts and history)
   */
  async deleteProject(slug: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    return prisma.project.delete({
      where: { id: project.id }
    });
  }

  /**
   * Mark handoff as generated
   */
  async markHandoffGenerated(slug: string) {
    return prisma.project.update({
      where: { slug },
      data: {
        handoff_generated: true,
        handoff_generated_at: new Date(),
        updated_at: new Date()
      }
    });
  }

  /**
   * Get project statistics
   */
  async getProjectStats(slug: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    const artifactCount = await prisma.artifact.count({
      where: { project_id: project.id }
    });

    const phaseHistory = await prisma.phaseHistory.findMany({
      where: { project_id: project.id }
    });

    return {
      project_id: project.id,
      current_phase: project.current_phase,
      phases_completed: project.phases_completed.split(',').filter(p => p),
      artifact_count: artifactCount,
      stack_approved: project.stack_approved,
      dependencies_approved: project.dependencies_approved,
      handoff_generated: project.handoff_generated,
      phase_history: phaseHistory,
      created_at: project.created_at,
      updated_at: project.updated_at
    };
  }
}
