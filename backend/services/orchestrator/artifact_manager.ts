import { ProjectArtifact, ValidationResult } from '@/types/orchestrator';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { Archiver } from '../file_system/archiver';
import { ProjectStorage } from '../file_system/project_storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logger } from '@/lib/logger';

export class ArtifactManager {
  private basePath: string = resolve(process.cwd(), 'projects');
  private projectStorage: ProjectStorage;
  private archiver: Archiver;

  constructor() {
    // Don't create directory on init - ProjectStorage will only try if explicitly configured
    this.projectStorage = new ProjectStorage({ base_path: this.basePath, create_if_missing: false });
    this.archiver = new Archiver(this.projectStorage);
  }

  /**
   * Validate artifacts exist for a project
   */
  async validateArtifacts(projectId: string, requiredArtifacts: string[]): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    for (const artifact of requiredArtifacts) {
      const artifactPath = this.getArtifactPath(projectId, artifact);
      const exists = existsSync(artifactPath);
      checks[artifact] = exists;
      
      if (!exists) {
        errors.push(`Missing artifact: ${artifact}`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * List artifacts for a project phase
   */
  async listArtifacts(projectId: string, phase: string): Promise<string[]> {
    const phasePath = resolve(this.basePath, projectId, 'specs', phase, 'v1');
    
    if (!existsSync(phasePath)) {
      return [];
    }

    try {
      return readdirSync(phasePath);
    } catch {
      return [];
    }
  }

  /**
   * Get artifact content
   */
  async getArtifactContent(projectId: string, artifactName: string): Promise<string> {
    const artifactPath = this.getArtifactPath(projectId, artifactName);
    
    if (!existsSync(artifactPath)) {
      throw new Error(`Artifact not found: ${artifactName}`);
    }

    return readFileSync(artifactPath, 'utf8');
  }

  /**
   * Write artifact content
   */
  async writeArtifact(
    projectId: string,
    phase: string,
    artifactName: string,
    content: string
  ): Promise<void> {
    const artifactPath = this.getArtifactPath(projectId, artifactName, phase);

    // Ensure directory exists (only if the parent directory is writable)
    const dir = dirname(artifactPath);
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        // On serverless environments like Vercel, the filesystem may be read-only
        // In this case, we skip local write since artifacts are stored in R2
        logger.debug('Unable to create artifact directory on filesystem, skipping local write', {
          artifactPath,
          error: error instanceof Error ? error.message : String(error)
        });
        return;
      }
    }

    try {
      writeFileSync(artifactPath, content, 'utf8');
    } catch (error) {
      // Filesystem write failed - this is expected on Vercel
      // R2 storage is handled separately in the route handler
      logger.debug('Unable to write artifact to filesystem, continuing without local copy', {
        artifactPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Save artifact content (alias for writeArtifact)
   * Used by OrchestratorEngine for consistency
   */
  async saveArtifact(
    projectId: string,
    phase: string,
    artifactName: string,
    content: string
  ): Promise<void> {
    return this.writeArtifact(projectId, phase, artifactName, content);
  }

  /**
   * Get artifact metadata
   */
  async getArtifactMetadata(projectId: string, artifactName: string): Promise<Partial<ProjectArtifact>> {
    const artifactPath = this.getArtifactPath(projectId, artifactName);
    
    if (!existsSync(artifactPath)) {
      throw new Error(`Artifact not found: ${artifactName}`);
    }

    const stats = statSync(artifactPath);
    const content = readFileSync(artifactPath, 'utf8');
    const contentHash = createHash('sha256').update(content).digest('hex');
    
    // Extract frontmatter if markdown
    let frontmatter = null;
    if (artifactName.endsWith('.md')) {
      frontmatter = this.extractFrontmatter(content);
    }

    return {
      artifact_name: artifactName,
      file_path: artifactPath,
      file_size: stats.size,
      content_hash: contentHash,
      frontmatter: frontmatter || undefined,
      created_at: stats.birthtime,
      updated_at: stats.mtime
    };
  }

  /**
   * Create project directory structure
   */
  async createProjectDirectory(projectSlug: string): Promise<string> {
    const projectPath = resolve(this.basePath, projectSlug);
    
    if (!existsSync(projectPath)) {
      mkdirSync(projectPath, { recursive: true });
    }

    // Create subdirectories
    const subdirs = [
      'specs/ANALYSIS/v1',
      'specs/STACK_SELECTION/v1',
      'specs/SPEC/v1',
      'specs/DEPENDENCIES/v1',
      'specs/SOLUTIONING/v1',
      '.ai-config',
      'docs'
    ];

    for (const subdir of subdirs) {
      const dirPath = resolve(projectPath, subdir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    return projectPath;
  }

  /**
   * Get project path
   */
  getProjectPath(projectSlug: string): string {
    return resolve(this.basePath, projectSlug);
  }

  /**
   * Create phase directory
   */
  async createPhaseDirectory(projectSlug: string, phase: string): Promise<string> {
    const phasePath = resolve(this.basePath, projectSlug, 'specs', phase, 'v1');
    
    if (!existsSync(phasePath)) {
      mkdirSync(phasePath, { recursive: true });
    }

    return phasePath;
  }

  /**
   * Get artifact file path
   */
  private getArtifactPath(projectId: string, artifactName: string, phase?: string): string {
    // If phase not provided, try to infer from artifact name
    if (!phase) {
      phase = this.inferPhaseFromArtifact(artifactName);
    }
    
    return resolve(this.basePath, projectId, 'specs', phase, 'v1', artifactName);
  }

  /**
   * Infer phase from artifact name
   */
  private inferPhaseFromArtifact(artifactName: string): string {
    const artifactPhases: Record<string, string> = {
      'constitution.md': 'ANALYSIS',
      'project-brief.md': 'ANALYSIS',
      'personas.md': 'ANALYSIS',
      'plan.md': 'STACK_SELECTION',
      'README.md': 'STACK_SELECTION',
      'PRD.md': 'SPEC',
      'data-model.md': 'SPEC',
      'api-spec.json': 'SPEC',
      'DEPENDENCIES.md': 'DEPENDENCIES',
      'dependency-proposal.md': 'DEPENDENCIES',
      'architecture.md': 'SOLUTIONING',
      'epics.md': 'SOLUTIONING',
      'tasks.md': 'SOLUTIONING',
      'HANDOFF.md': 'DONE'
    };

    return artifactPhases[artifactName] || 'UNKNOWN';
  }

  /**
   * Extract frontmatter from markdown content
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractFrontmatter(content: string): Record<string, any> | null {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return null;
    
    try {
      // Simple YAML parsing - in production use proper YAML parser
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const frontmatter: Record<string, any> = {};
      const lines = match[1].split('\n');
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          frontmatter[key.trim()] = valueParts.join(':').trim();
        }
      }
      
      return frontmatter;
    } catch {
      return null;
    }
  }

  /**
   * Archive project artifacts into ZIP
   */
  async createProjectZip(projectSlug: string): Promise<Buffer> {
    return this.archiver.createProjectZip(projectSlug);
  }

  /**
   * Generate handoff prompt
   */
  async generateHandoffPrompt(projectSlug: string): Promise<string> {
    return this.archiver.createHandoffPrompt(projectSlug);
  }
}