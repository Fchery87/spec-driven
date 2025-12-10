import { logger } from '@/lib/logger';
import {
  Project,
  OrchestrationState,
  PhaseHistory,
  ProjectArtifact
} from '@/types/orchestrator';
import { ProjectStorage } from '../file_system/project_storage';

export interface CreateProjectRequest {
  name: string;
  description: string;
  slug: string;
  created_by_id: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  current_phase?: string;
  stack_choice?: string;
  stack_approved?: boolean;
  dependencies_approved?: boolean;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  per_page: number;
}

export class ProjectsService {
  private projectStorage: ProjectStorage;

  constructor(projectStorage?: ProjectStorage) {
    this.projectStorage = projectStorage || new ProjectStorage();
  }

  /**
   * Create new project
   */
  async createProject(request: CreateProjectRequest): Promise<Project> {
    // Validate slug uniqueness
    const existingProjects = this.projectStorage.listProjects();
    if (existingProjects.includes(request.slug)) {
      throw new Error(`Project with slug '${request.slug}' already exists`);
    }

    // Create project directory
    const projectPath = this.projectStorage.createProjectDirectory(request.slug);

    // Initialize project with defaults
    const project: Project = {
      id: this.generateId(),
      slug: request.slug,
      name: request.name,
      description: request.description,
      created_by_id: request.created_by_id,
      current_phase: 'ANALYSIS',
      phases_completed: [],
      stack_choice: undefined,
      stack_approved: false,
      dependencies_approved: false,
      orchestration_state: {
        artifact_versions: {},
        validation_results: {},
        approval_gates: {}
      },
      project_path: projectPath,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Save project metadata
    this.projectStorage.updateProjectMetadata(request.slug, {
      ...project,
      created_at: project.created_at.toISOString(),
      updated_at: project.updated_at.toISOString()
    });

    // Record initial phase history
    await this.recordPhaseHistory(project.id, 'INITIAL', 'ANALYSIS', request.created_by_id);

    return project;
  }

  /**
   * Get project by slug
   */
  async getProject(slug: string): Promise<Project | null> {
    const metadata = this.projectStorage.getProjectMetadata(slug);
    
    if (!metadata) {
      return null;
    }

    // Convert metadata to Project object
    return {
      id: metadata.id || this.generateId(),
      slug: metadata.project_slug || slug,
      name: metadata.name || slug,
      description: metadata.description || '',
      created_by_id: metadata.created_by_id || '',
      current_phase: metadata.current_phase || 'ANALYSIS',
      phases_completed: metadata.phases_completed || [],
      stack_choice: metadata.stack_choice || undefined,
      stack_approved: metadata.stack_approved || false,
      stack_approval_date: metadata.stack_approval_date ? new Date(metadata.stack_approval_date) : undefined,
      dependencies_approved: metadata.dependencies_approved || false,
      dependencies_approval_date: metadata.dependencies_approval_date ? new Date(metadata.dependencies_approval_date) : undefined,
      orchestration_state: metadata.orchestration_state || {
        artifact_versions: {},
        validation_results: {},
        approval_gates: {}
      },
      project_path: this.projectStorage.getProjectPath(slug),
      created_at: metadata.created_at ? new Date(metadata.created_at) : new Date(),
      updated_at: metadata.updated_at ? new Date(metadata.updated_at) : new Date()
    };
  }

  /**
   * List projects with pagination
   */
  async listProjects(page: number = 1, perPage: number = 20): Promise<ProjectListResponse> {
    const allSlugs = this.projectStorage.listProjects();
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedSlugs = allSlugs.slice(startIndex, endIndex);

    const projects: Project[] = [];
    
    for (const slug of paginatedSlugs) {
      const project = await this.getProject(slug);
      if (project) {
        projects.push(project);
      }
    }

    return {
      projects,
      total: allSlugs.length,
      page,
      per_page: perPage
    };
  }

  /**
   * Update project
   */
  async updateProject(slug: string, request: UpdateProjectRequest): Promise<Project> {
    const existingProject = await this.getProject(slug);
    
    if (!existingProject) {
      throw new Error(`Project not found: ${slug}`);
    }

    // Update fields
    const updatedProject: Project = {
      ...existingProject,
      ...request,
      updated_at: new Date()
    };

    // Handle stack approval
    if (request.stack_approved && !existingProject.stack_approved) {
      updatedProject.stack_approval_date = new Date();
    }

    // Handle dependencies approval
    if (request.dependencies_approved && !existingProject.dependencies_approved) {
      updatedProject.dependencies_approval_date = new Date();
    }

    // Handle phase change
    if (request.current_phase && request.current_phase !== existingProject.current_phase) {
      if (!existingProject.phases_completed.includes(existingProject.current_phase)) {
        updatedProject.phases_completed.push(existingProject.current_phase);
      }
      
      await this.recordPhaseHistory(
        updatedProject.id,
        existingProject.current_phase,
        request.current_phase,
        existingProject.created_by_id
      );
    }

    // Save updated metadata
    this.projectStorage.updateProjectMetadata(slug, {
      ...updatedProject,
      created_at: updatedProject.created_at.toISOString(),
      updated_at: updatedProject.updated_at.toISOString(),
      stack_approval_date: updatedProject.stack_approval_date?.toISOString(),
      dependencies_approval_date: updatedProject.dependencies_approval_date?.toISOString()
    });

    return updatedProject;
  }

  /**
   * Delete project
   */
  async deleteProject(slug: string): Promise<boolean> {
    const project = await this.getProject(slug);
    
    if (!project) {
      return false;
    }

    return this.projectStorage.deleteProject(slug);
  }

  /**
   * Get project artifacts
   */
  async getProjectArtifacts(slug: string, phase?: string): Promise<ProjectArtifact[]> {
    const project = await this.getProject(slug);
    
    if (!project) {
      throw new Error(`Project not found: ${slug}`);
    }

    const artifacts: ProjectArtifact[] = [];
    const phases = phase ? [phase] : ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'VALIDATE'];

    for (const phaseName of phases) {
      const phaseArtifacts = this.projectStorage.listArtifacts(slug, phaseName);
      
      for (const artifact of phaseArtifacts) {
        const projectArtifact: ProjectArtifact = {
          id: this.generateId(),
          project_id: project.id,
          phase: phaseName,
          artifact_name: artifact.name,
          version: 1, // Would be tracked in metadata
          file_path: artifact.path,
          file_size: artifact.size,
          content_hash: artifact.hash,
          validation_status: 'pending',
          created_at: artifact.created_at,
          updated_at: artifact.modified_at
        };

        artifacts.push(projectArtifact);
      }
    }

    return artifacts;
  }

  /**
   * Get project phase history
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getProjectPhaseHistory(slug: string): Promise<PhaseHistory[]> {
    // This would read from a phase history store
    // For now, return empty array
    return [];
  }

  /**
   * Update orchestration state
   */
  async updateOrchestrationState(
    slug: string, 
    state: Partial<OrchestrationState>
  ): Promise<void> {
    const project = await this.getProject(slug);
    
    if (!project) {
      throw new Error(`Project not found: ${slug}`);
    }

    const updatedState = {
      ...project.orchestration_state,
      ...state
    };

    this.projectStorage.updateProjectMetadata(slug, {
      orchestration_state: updatedState
    });
  }

  /**
   * Get project statistics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getProjectStats(slug: string): Promise<any> {
    const stats = this.projectStorage.getProjectStats(slug);
    const project = await this.getProject(slug);
    
    if (!project) {
      return null;
    }

    return {
      ...stats,
      current_phase: project.current_phase,
      phases_completed: project.phases_completed.length,
      stack_approved: project.stack_approved,
      dependencies_approved: project.dependencies_approved,
      created_at: project.created_at,
      updated_at: project.updated_at
    };
  }

  /**
   * Search projects
   */
  async searchProjects(query: string, userId?: string): Promise<Project[]> {
    const allSlugs = this.projectStorage.listProjects();
    const matchingProjects: Project[] = [];

    for (const slug of allSlugs) {
      const project = await this.getProject(slug);
      
      if (project && this.matchesQuery(project, query, userId)) {
        matchingProjects.push(project);
      }
    }

    return matchingProjects;
  }

  /**
   * Record phase history
   */
  private async recordPhaseHistory(
    projectId: string,
    fromPhase: string,
    toPhase: string,
    userId: string
  ): Promise<void> {
    const history: PhaseHistory = {
      id: this.generateId(),
      project_id: projectId,
      from_phase: fromPhase,
      to_phase: toPhase,
      artifacts_generated: [],
      validation_passed: true,
      transitioned_by: userId,
      transition_date: new Date()
    };

    // In a real implementation, this would save to a database
    logger.info('Phase history recorded', { history });
  }

  /**
   * Check if project matches search query
   */
  private matchesQuery(project: Project, query: string, userId?: string): boolean {
    const searchQuery = query.toLowerCase();
    
    // Check name, description, slug
    const matchesText = 
      project.name.toLowerCase().includes(searchQuery) ||
      project.description.toLowerCase().includes(searchQuery) ||
      project.slug.toLowerCase().includes(searchQuery);

    // Check user filter
    const matchesUser = !userId || project.created_by_id === userId;

    return matchesText && matchesUser;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate project slug
   */
  validateSlug(slug: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!slug || slug.length < 3) {
      errors.push('Slug must be at least 3 characters long');
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
    }

    if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.push('Slug cannot start or end with a hyphen');
    }

    if (/--/.test(slug)) {
      errors.push('Slug cannot contain consecutive hyphens');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
