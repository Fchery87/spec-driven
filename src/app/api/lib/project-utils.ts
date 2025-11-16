import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { resolve } from 'path';

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
  handoff_generated?: boolean;
  handoff_generated_at?: string;
  orchestration_state?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const getProjectsPath = () => resolve(process.cwd(), 'projects');

/**
 * Get project metadata from file system
 * Database persistence handled separately in async functions
 */
export const getProjectMetadata = (slug: string) => {
  try {
    const path = resolve(getProjectsPath(), slug, 'metadata.json');
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'));
    }
  } catch {
    return null;
  }
};

/**
 * Save project metadata to file system
 * Database persistence handled separately in async functions
 */
export const saveProjectMetadata = (slug: string, metadata: ProjectMetadata) => {
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
 * List artifacts for a phase (file system)
 */
export const listArtifacts = (slug: string, phase: string) => {
  const phasePath = resolve(getProjectsPath(), slug, 'specs', phase, 'v1');
  if (!existsSync(phasePath)) {
    return [];
  }
  try {
    return readdirSync(phasePath).map(name => ({
      name,
      size: statSync(resolve(phasePath, name)).size
    }));
  } catch {
    return [];
  }
};

/**
 * Write artifact to file system
 */
export const writeArtifact = (slug: string, phase: string, name: string, content: string) => {
  const dir = resolve(getProjectsPath(), slug, 'specs', phase, 'v1');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = resolve(dir, name);
  writeFileSync(path, content, 'utf8');
  return path;
};

/**
 * Save artifact (file system only)
 * Note: Artifact content is stored in files for easy ZIPping
 * Database stores metadata only
 */
export const saveArtifact = (slug: string, phase: string, name: string, content: string): string => {
  return writeArtifact(slug, phase, name, content);
};

/**
 * Delete project from file system
 * Note: Async database deletion should be called separately
 */
export const deleteProject = (slug: string): boolean => {
  try {
    const projectPath = resolve(getProjectsPath(), slug);
    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting project ${slug}:`, error);
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
    const project = await db.getProjectBySlug(slug);

    // Ensure phases_completed is a string (comma-separated, not an array)
    const phasesCompleted = Array.isArray(metadata.phases_completed)
      ? metadata.phases_completed.filter((p: string) => p).join(',')
      : (metadata.phases_completed || '');

    if (project) {
      await db.updateProjectMetadata(slug, {
        ...metadata,
        phases_completed: phasesCompleted,
      });
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
      });
    }
  } catch (error) {
    console.error(`Error persisting project ${slug} to database:`, error);
  }
}

export async function deleteProjectFromDB(slug: string): Promise<boolean> {
  try {
    const db = await import('@/lib/db');
    return await db.deleteProject(slug);
  } catch (error) {
    console.error(`Error deleting project ${slug} from database:`, error);
    return false;
  }
}
