import { ProjectArtifact, ValidationResult } from '@/types/orchestrator';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';

export class ArtifactManager {
  private basePath: string = '/projects';

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

    // Ensure directory exists
    const dir = dirname(artifactPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(artifactPath, content, 'utf8');
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
  private extractFrontmatter(content: string): Record<string, any> | null {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return null;
    
    try {
      // Simple YAML parsing - in production use proper YAML parser
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
   * Archive project artifacts into ZIP (placeholder)
   */
  async createProjectZip(projectSlug: string): Promise<Buffer> {
    // This would create a ZIP file with all project artifacts
    // For now, return a placeholder
    const projectPath = this.getProjectPath(projectSlug);
    
    // In production, use a library like archiver or jszip
    const placeholder = `Project ZIP for ${projectSlug}`;
    return Buffer.from(placeholder);
  }

  /**
   * Generate handoff prompt (placeholder)
   */
  async generateHandoffPrompt(projectSlug: string): Promise<string> {
    // This would generate the comprehensive HANDOFF.md content
    // For now, return a placeholder
    return `# Handoff: ${projectSlug}

This is the master handoff document for LLM code generation.

## Project Context
[Project details would go here]

## Reading Order
1. constitution.md
2. project-brief.md
3. personas.md
4. PRD.md
5. data-model.md
6. api-spec.json
7. architecture.md
8. DEPENDENCIES.md
9. epics.md
10. tasks.md

## LLM Prompt
You are a senior full-stack engineer implementing this project...
`;
  }
}