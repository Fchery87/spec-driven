import { ProjectArtifact, ValidationResult } from '@/types/orchestrator';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { Archiver } from '../file_system/archiver';
import { ProjectStorage } from '../file_system/project_storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logger } from '@/lib/logger';
import { listArtifactNamesMerged } from './artifact_access';

export class ArtifactManager {
  private basePath: string = resolve(process.cwd(), 'projects');
  private projectStorage: ProjectStorage;
  private archiver: Archiver;

  constructor() {
    // Don't create directory on init - ProjectStorage will only try if explicitly configured
    this.projectStorage = new ProjectStorage({
      base_path: this.basePath,
      create_if_missing: false,
    });
    this.archiver = new Archiver(this.projectStorage);
  }

  /**
   * Validate artifacts exist for a project
   */
  async validateArtifacts(
    projectId: string,
    requiredArtifacts: string[]
  ): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // Group required artifacts by inferred phase to avoid repeated remote listing
    const byPhase = new Map<string, string[]>();
    for (const artifact of requiredArtifacts) {
      const phase = this.inferPhaseFromArtifact(artifact);
      const list = byPhase.get(phase) || [];
      list.push(artifact);
      byPhase.set(phase, list);
    }

    for (const [phase, artifacts] of byPhase.entries()) {
      let remoteNames: Set<string> | null = null;

      // Prefer R2/DB-aware listing; fall back to filesystem-only if it fails.
      try {
        const names = await listArtifactNamesMerged(projectId, phase);
        remoteNames = new Set(names);
      } catch (error) {
        logger.debug(
          'validateArtifacts: remote list failed, using filesystem fallback',
          {
            projectId,
            phase,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }

      for (const artifact of artifacts) {
        const artifactPath = this.getArtifactPath(projectId, artifact, phase);
        const existsOnFs = existsSync(artifactPath);
        const existsRemotely = remoteNames ? remoteNames.has(artifact) : false;
        const exists = existsOnFs || existsRemotely;
        checks[artifact] = exists;
        if (!exists) errors.push(`Missing artifact: ${artifact}`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
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
  async getArtifactContent(
    projectId: string,
    artifactName: string
  ): Promise<string> {
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
        logger.debug(
          'Unable to create artifact directory on filesystem, skipping local write',
          {
            artifactPath,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        return;
      }
    }

    try {
      writeFileSync(artifactPath, content, 'utf8');
    } catch (error) {
      // Filesystem write failed - this is expected on Vercel
      // R2 storage is handled separately in the route handler
      logger.debug(
        'Unable to write artifact to filesystem, continuing without local copy',
        {
          artifactPath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
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
  async getArtifactMetadata(
    projectId: string,
    artifactName: string
  ): Promise<Partial<ProjectArtifact>> {
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
      updated_at: stats.mtime,
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
      'specs/SPEC_PM/v1',
      'specs/SPEC_ARCHITECT/v1',
      'specs/SPEC_DESIGN_TOKENS/v1',
      'specs/SPEC_DESIGN_COMPONENTS/v1',
      'specs/FRONTEND_BUILD/v1',
      'specs/DEPENDENCIES/v1',
      'specs/SOLUTIONING/v1',
      'specs/VALIDATE/v1',
      'specs/AUTO_REMEDY/v1',
      'specs/DONE/v1',
      // Legacy fallback for existing projects
      'specs/SPEC/v1',
      '.ai-config',
      'docs',
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
  async createPhaseDirectory(
    projectSlug: string,
    phase: string
  ): Promise<string> {
    const phasePath = resolve(this.basePath, projectSlug, 'specs', phase, 'v1');

    if (!existsSync(phasePath)) {
      mkdirSync(phasePath, { recursive: true });
    }

    return phasePath;
  }

  /**
   * Get artifact file path
   */
  private getArtifactPath(
    projectId: string,
    artifactName: string,
    phase?: string
  ): string {
    // If phase not provided, try to infer from artifact name
    if (!phase) {
      phase = this.inferPhaseFromArtifact(artifactName);
    }

    return resolve(
      this.basePath,
      projectId,
      'specs',
      phase,
      'v1',
      artifactName
    );
  }

  /**
   * Infer phase from artifact name
   */
  private inferPhaseFromArtifact(artifactName: string): string {
    const artifactPhases: Record<string, string> = {
      // ANALYSIS phase
      'constitution.md': 'ANALYSIS',
      'project-brief.md': 'ANALYSIS',
      'project-classification.json': 'ANALYSIS',
      'personas.md': 'ANALYSIS',
      // STACK_SELECTION phase
      'stack-analysis.md': 'STACK_SELECTION',
      'stack-decision.md': 'STACK_SELECTION',
      'stack-rationale.md': 'STACK_SELECTION',
      'stack.json': 'STACK_SELECTION',
      // SPEC_PM phase (new 12-phase system)
      'PRD.md': 'SPEC_PM',
      // SPEC_ARCHITECT phase (new 12-phase system)
      'data-model.md': 'SPEC_ARCHITECT',
      'api-spec.json': 'SPEC_ARCHITECT',
      // SPEC_DESIGN_TOKENS phase
      'design-tokens.md': 'SPEC_DESIGN_TOKENS',
      'design-system.md': 'SPEC_DESIGN_TOKENS',
      // SPEC_DESIGN_COMPONENTS phase
      'component-inventory.md': 'SPEC_DESIGN_COMPONENTS',
      'component-mapping.md': 'SPEC_DESIGN_COMPONENTS',
      'user-flows.md': 'SPEC_DESIGN_COMPONENTS',
      'journey-maps.md': 'SPEC_DESIGN_COMPONENTS',
      // DEPENDENCIES phase
      'DEPENDENCIES.md': 'DEPENDENCIES',
      'dependencies.json': 'DEPENDENCIES',
      'approval.md': 'DEPENDENCIES',
      // SOLUTIONING phase
      'architecture.md': 'SOLUTIONING',
      'epics.md': 'SOLUTIONING',
      'tasks.md': 'SOLUTIONING',
      'plan.md': 'SOLUTIONING',
      // VALIDATE phase
      'validation-report.md': 'VALIDATE',
      'coverage-matrix.md': 'VALIDATE',
      // AUTO_REMEDY phase
      'auto-remedy-report.md': 'AUTO_REMEDY',
      // DONE phase
      'README.md': 'DONE',
      'HANDOFF.md': 'DONE',
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
