import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectDBService } from '@/backend/services/database/project_db_service';
import { ProjectStorage } from '@/backend/services/file_system/project_storage';

const getProjectsPath = () => resolve(process.cwd(), 'projects');

const getProjectMetadata = (slug: string) => {
  try {
    const path = resolve(getProjectsPath(), slug, 'metadata.json');
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'));
    }
  } catch {
    return null;
  }
};

const saveProjectMetadata = (slug: string, metadata: any) => {
  const dir = resolve(getProjectsPath(), slug);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(resolve(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));
};

const listAllProjects = () => {
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
 * GET /api/projects
 * List all projects from database
 */
export async function GET(request: NextRequest) {
  try {
    const dbService = new ProjectDBService();
    const result = await dbService.listProjects();

    const projectDetails = result.projects.map(project => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      current_phase: project.current_phase,
      stack_choice: project.stack_choice,
      stack_approved: project.stack_approved,
      dependencies_approved: project.dependencies_approved,
      created_at: project.created_at,
      updated_at: project.updated_at,
      artifact_count: project._count?.artifacts || 0
    }));

    return NextResponse.json({
      success: true,
      data: projectDetails,
      total: result.total
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project in database and filesystem
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + uuidv4().substring(0, 8);

    // Create project in database
    const dbService = new ProjectDBService();
    const dbProject = await dbService.createProject({
      name,
      description: description || undefined,
      slug
    });

    // Also create filesystem structure for artifacts
    const projectStorage = new ProjectStorage({ base_path: resolve(process.cwd(), 'projects') });
    projectStorage.createProjectDirectory(slug);

    // Store the project idea as initial context for the Analyst agent
    const projectIdeaPath = resolve(process.cwd(), 'projects', slug, 'project_idea.txt');
    writeFileSync(projectIdeaPath, description || name, 'utf8');

    // Save project metadata to filesystem for retrieval
    const metadata = {
      id: dbProject.id,
      slug: dbProject.slug,
      name: dbProject.name,
      description: dbProject.description || null,
      current_phase: dbProject.current_phase,
      phases_completed: dbProject.phases_completed,
      stack_choice: dbProject.stack_choice,
      stack_approved: dbProject.stack_approved,
      dependencies_approved: dbProject.dependencies_approved,
      created_at: dbProject.created_at,
      updated_at: dbProject.updated_at,
      orchestration_state: {}
    };
    saveProjectMetadata(slug, metadata);

    return NextResponse.json({
      success: true,
      data: {
        id: dbProject.id,
        slug: dbProject.slug,
        name: dbProject.name,
        description: dbProject.description,
        current_phase: dbProject.current_phase,
        phases_completed: dbProject.phases_completed,
        stack_choice: dbProject.stack_choice,
        stack_approved: dbProject.stack_approved,
        dependencies_approved: dbProject.dependencies_approved,
        created_at: dbProject.created_at,
        updated_at: dbProject.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
