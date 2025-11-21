import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { db } from '@/backend/lib/drizzle';
import {
  projects,
  artifacts,
  phaseHistory,
  stackChoices,
  dependencyApprovals
} from '@/backend/lib/schema';
import {
  eq,
  desc,
  asc,
  and,
  count,
  sql
} from 'drizzle-orm';

export class ProjectDBService {
  /**
   * Create a new project
   */
  async createProject(data: {
    name: string;
    description?: string;
    slug: string;
  }) {
    const result = await db.insert(projects).values({
      id: uuidv4(),
      slug: data.slug,
      name: data.name,
      description: data.description || null,
      currentPhase: 'ANALYSIS',
      phasesCompleted: ''
    }).returning();
    
    return result[0];
  }

  /**
   * Get project by slug
   */
  async getProjectBySlug(slug: string) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
      with: {
        artifacts: true,
        phaseHistory: {
          orderBy: [desc(phaseHistory.startedAt)],
          limit: 20
        }
      }
    });

    return project;
  }

  /**
   * Get project by ID
   */
  async getProjectById(id: string) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        artifacts: true,
        phaseHistory: {
          orderBy: [desc(phaseHistory.startedAt)]
        }
      }
    });

    return project;
  }

  /**
   * List all projects
   */
  async listProjects(skip = 0, take = 20) {
    const projectsResult = await db.query.projects.findMany({
      offset: skip,
      limit: take,
      orderBy: [desc(projects.createdAt)]
    });

    const total = await db.select({ count: count() }).from(projects);
    const totalValue = total[0].count;

    return { 
      projects: projectsResult, 
      total: Number(totalValue), 
      skip, 
      take 
    };
  }

  /**
   * Update project phase
   */
  async updateProjectPhase(slug: string, newPhase: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    const phasesCompleted = project.phasesCompleted
      ? project.phasesCompleted.split(',').filter(p => p)
      : [];

    if (!phasesCompleted.includes(project.currentPhase)) {
      phasesCompleted.push(project.currentPhase);
    }

    const result = await db.update(projects)
      .set({
        currentPhase: newPhase,
        phasesCompleted: phasesCompleted.join(','),
        updatedAt: new Date()
      })
      .where(eq(projects.slug, slug))
      .returning();
    
    return result[0];
  }

  /**
   * Approve stack selection
   */
  async approveStackSelection(slug: string, stackChoice: string, reasoning: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    // Create or update stack choice record
    await db.insert(stackChoices).values({
      id: uuidv4(),
      projectId: project.id,
      stackId: stackChoice,
      reasoning
    }).onConflictDoUpdate({
      target: [stackChoices.projectId],
      set: {
        stackId: stackChoice,
        reasoning,
        approvedAt: new Date()
      }
    });

    // Update project
    const result = await db.update(projects)
      .set({
        stackChoice: stackChoice,
        stackApproved: true,
        updatedAt: new Date()
      })
      .where(eq(projects.slug, slug))
      .returning();
    
    return result[0];
  }

  /**
   * Approve dependencies
   */
  async approveDependencies(slug: string, notes?: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    // Create or update approval record
    await db.insert(dependencyApprovals).values({
      id: uuidv4(),
      projectId: project.id,
      notes: notes || null
    }).onConflictDoUpdate({
      target: [dependencyApprovals.projectId],
      set: {
        notes: notes || null,
        approvedAt: new Date()
      }
    });

    // Update project
    const result = await db.update(projects)
      .set({
        dependenciesApproved: true,
        updatedAt: new Date()
      })
      .where(eq(projects.slug, slug))
      .returning();
    
    return result[0];
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
    const existing = await db.query.artifacts.findFirst({
      where: and(
        eq(artifacts.projectId, projectId),
        eq(artifacts.phase, phase),
        eq(artifacts.filename, filename)
      ),
      orderBy: [desc(artifacts.version)],
    });

    const version = (existing?.version || 0) + 1;

    const result = await db.insert(artifacts).values({
      id: uuidv4(),
      projectId,
      phase,
      filename,
      content,
      version
    }).returning();
    
    return result[0];
  }

  /**
   * Get artifacts for a phase
   */
  async getArtifactsByPhase(projectId: string, phase: string) {
    const result = await db.query.artifacts.findMany({
      where: and(
        eq(artifacts.projectId, projectId),
        eq(artifacts.phase, phase)
      ),
      orderBy: [desc(artifacts.createdAt)]
    });

    return result;
  }

  /**
   * Get all artifacts for project
   */
  async getAllArtifacts(projectId: string) {
    const result = await db.query.artifacts.findMany({
      where: eq(artifacts.projectId, projectId),
      orderBy: [asc(artifacts.phase), desc(artifacts.createdAt)]
    });

    return result;
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
    const result = await db.insert(phaseHistory).values({
      id: uuidv4(),
      projectId,
      phase,
      status,
      errorMessage: errorMessage || null
    }).returning();

    const record = result[0];

    // If completed, update duration
    if (status === 'completed') {
      const duration = Date.now() - record.startedAt.getTime();
      const updatedRecord = await db.update(phaseHistory)
        .set({
          completedAt: new Date(),
          durationMs: duration
        })
        .where(eq(phaseHistory.id, record.id))
        .returning();
      
      return updatedRecord[0];
    }

    return record;
  }

  /**
   * Delete project
   */
  async deleteProject(slug: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    const result = await db.delete(projects)
      .where(eq(projects.id, project.id))
      .returning();

    return result[0];
  }

  /**
   * Mark handoff as generated
   */
  async markHandoffGenerated(slug: string) {
    const result = await db.update(projects)
      .set({
        handoffGenerated: true,
        handoffGeneratedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(projects.slug, slug))
      .returning();

    return result[0];
  }

  /**
   * Get project statistics
   */
  async getProjectStats(slug: string) {
    const project = await this.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');

    const artifactsResult = await db.select({ count: count() })
      .from(artifacts)
      .where(eq(artifacts.projectId, project.id));

    const artifactCount = Number(artifactsResult[0].count);

    const phaseHistoryResult = await db.query.phaseHistory.findMany({
      where: eq(phaseHistory.projectId, project.id)
    });

    return {
      project_id: project.id,
      current_phase: project.currentPhase,
      phases_completed: project.phasesCompleted.split(',').filter(p => p),
      artifact_count: artifactCount,
      stack_approved: project.stackApproved,
      dependencies_approved: project.dependenciesApproved,
      handoff_generated: project.handoffGenerated,
      phase_history: phaseHistoryResult,
      created_at: project.createdAt,
      updated_at: project.updatedAt
    };
  }
}