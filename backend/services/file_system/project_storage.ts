import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { resolve, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

export interface ProjectStorageConfig {
  base_path: string;
  create_if_missing: boolean;
}

export interface ArtifactInfo {
  name: string;
  path: string;
  size: number;
  created_at: Date;
  modified_at: Date;
  hash: string;
}

export class ProjectStorage {
  private basePath: string;

  constructor(config?: Partial<ProjectStorageConfig>) {
    this.basePath = config?.base_path || '/projects';
    
    if (config?.create_if_missing !== false && !existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Create project directory structure
   */
  createProjectDirectory(projectSlug: string): string {
    const projectPath = this.getProjectPath(projectSlug);
    
    if (!existsSync(projectPath)) {
      mkdirSync(projectPath, { recursive: true });
    }

    // Create standard directory structure
    const directories = [
      'specs/ANALYSIS/v1',
      'specs/STACK_SELECTION/v1',
      'specs/SPEC/v1',
      'specs/DEPENDENCIES/v1',
      'specs/SOLUTIONING/v1',
      'specs/VALIDATE/v1',
      '.ai-config',
      'docs'
    ];

    for (const dir of directories) {
      const dirPath = resolve(projectPath, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    // Create metadata file
    const metadataPath = resolve(projectPath, 'metadata.json');
    if (!existsSync(metadataPath)) {
      const metadata = {
        project_slug: projectSlug,
        created_at: new Date().toISOString(),
        phases_completed: [],
        current_phase: 'ANALYSIS',
        stack_approved: false,
        dependencies_approved: false,
        artifact_versions: {}
      };
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    return projectPath;
  }

  /**
   * Get project directory path
   */
  getProjectPath(projectSlug: string): string {
    return resolve(this.basePath, projectSlug);
  }

  /**
   * Create phase directory
   */
  createPhaseDirectory(projectSlug: string, phase: string, version: number = 1): string {
    const phasePath = resolve(this.basePath, projectSlug, 'specs', phase, `v${version}`);
    
    if (!existsSync(phasePath)) {
      mkdirSync(phasePath, { recursive: true });
    }

    return phasePath;
  }

  /**
   * Write artifact to project
   */
  writeArtifact(
    projectSlug: string,
    phase: string,
    artifactName: string,
    content: string,
    version: number = 1
  ): string {
    const artifactPath = this.getArtifactPath(projectSlug, phase, artifactName, version);
    
    // Ensure directory exists
    const dir = dirname(artifactPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(artifactPath, content, 'utf8');
    
    // Update metadata
    this.updateArtifactMetadata(projectSlug, artifactName, {
      phase,
      version,
      file_path: artifactPath,
      file_size: Buffer.byteLength(content),
      content_hash: createHash('sha256').update(content).digest('hex'),
      updated_at: new Date()
    });

    return artifactPath;
  }

  /**
   * Read artifact from project
   */
  readArtifact(projectSlug: string, phase: string, artifactName: string, version: number = 1): string {
    const artifactPath = this.getArtifactPath(projectSlug, phase, artifactName, version);
    
    if (!existsSync(artifactPath)) {
      throw new Error(`Artifact not found: ${artifactPath}`);
    }

    return readFileSync(artifactPath, 'utf8');
  }

  /**
   * List artifacts in phase
   */
  listArtifacts(projectSlug: string, phase: string, version: number = 1): ArtifactInfo[] {
    const phasePath = resolve(this.basePath, projectSlug, 'specs', phase, `v${version}`);
    
    if (!existsSync(phasePath)) {
      return [];
    }

    const files = readdirSync(phasePath);
    const artifacts: ArtifactInfo[] = [];

    for (const file of files) {
      const filePath = resolve(phasePath, file);
      const stats = statSync(filePath);
      const content = readFileSync(filePath, 'utf8');
      
      artifacts.push({
        name: file,
        path: filePath,
        size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime,
        hash: createHash('sha256').update(content).digest('hex')
      });
    }

    return artifacts;
  }

  /**
   * Get artifact path
   */
  getArtifactPath(projectSlug: string, phase: string, artifactName: string, version: number = 1): string {
    return resolve(this.basePath, projectSlug, 'specs', phase, `v${version}`, artifactName);
  }

  /**
   * Check if artifact exists
   */
  artifactExists(projectSlug: string, phase: string, artifactName: string, version: number = 1): boolean {
    const artifactPath = this.getArtifactPath(projectSlug, phase, artifactName, version);
    return existsSync(artifactPath);
  }

  /**
   * Delete artifact
   */
  deleteArtifact(projectSlug: string, phase: string, artifactName: string, version: number = 1): boolean {
    const artifactPath = this.getArtifactPath(projectSlug, phase, artifactName, version);

    try {
      if (existsSync(artifactPath)) {
        unlinkSync(artifactPath);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete artifact ${artifactPath}:`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get project metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProjectMetadata(projectSlug: string): any {
    const metadataPath = resolve(this.basePath, projectSlug, 'metadata.json');
    
    if (!existsSync(metadataPath)) {
      return null;
    }

    try {
      const content = readFileSync(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Update project metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProjectMetadata(projectSlug: string, updates: any): void {
    const metadataPath = resolve(this.basePath, projectSlug, 'metadata.json');
    const metadata = this.getProjectMetadata(projectSlug) || {};
    
    const updatedMetadata = {
      ...metadata,
      ...updates,
      updated_at: new Date().toISOString()
    };

    writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2));
  }

  /**
   * Update artifact metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updateArtifactMetadata(projectSlug: string, artifactName: string, info: any): void {
    const metadata = this.getProjectMetadata(projectSlug) || {};
    
    if (!metadata.artifacts) {
      metadata.artifacts = {};
    }

    metadata.artifacts[artifactName] = info;
    this.updateProjectMetadata(projectSlug, metadata);
  }

  /**
   * List all projects
   */
  listProjects(): string[] {
    if (!existsSync(this.basePath)) {
      return [];
    }

    try {
      return readdirSync(this.basePath).filter(item => {
        const itemPath = resolve(this.basePath, item);
        return statSync(itemPath).isDirectory();
      });
    } catch {
      return [];
    }
  }

  /**
   * Delete project (recursive)
   */
  deleteProject(projectSlug: string): boolean {
    const projectPath = this.getProjectPath(projectSlug);

    try {
      if (existsSync(projectPath)) {
        rmSync(projectPath, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete project ${projectPath}:`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get project statistics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProjectStats(projectSlug: string): any {
    const projectPath = this.getProjectPath(projectSlug);
    
    if (!existsSync(projectPath)) {
      return null;
    }

    const stats = {
      total_artifacts: 0,
      total_size: 0,
      phases: {} as Record<string, number>
    };

    const phases = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'VALIDATE'];
    
    for (const phase of phases) {
      const artifacts = this.listArtifacts(projectSlug, phase);
      stats.phases[phase] = artifacts.length;
      stats.total_artifacts += artifacts.length;
      
      for (const artifact of artifacts) {
        stats.total_size += artifact.size;
      }
    }

    return stats;
  }
}
