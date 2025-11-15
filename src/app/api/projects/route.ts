import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

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
 * List all projects
 */
export async function GET(request: NextRequest) {
  try {
    const projects = listAllProjects();

    const projectDetails = projects.map(slug => {
      const metadata = getProjectMetadata(slug);

      return {
        slug,
        name: metadata?.name || slug,
        current_phase: metadata?.current_phase || 'ANALYSIS',
        stack_choice: metadata?.stack_choice,
        stack_approved: metadata?.stack_approved || false,
        dependencies_approved: metadata?.dependencies_approved || false,
        created_at: metadata?.created_at,
        updated_at: metadata?.updated_at,
        stats: { total_artifacts: 0, total_size: 0 }
      };
    });

    return NextResponse.json({
      success: true,
      data: projectDetails
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
 * Create a new project
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

    // Create project directory
    const projectsPath = getProjectsPath();
    const projectPath = resolve(projectsPath, slug);

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

    // Initialize metadata
    const metadata = {
      id: uuidv4(),
      slug,
      name,
      description,
      created_by_id: 'system',
      current_phase: 'ANALYSIS',
      phases_completed: [],
      stack_choice: null,
      stack_approved: false,
      dependencies_approved: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_path: projectPath,
      orchestration_state: {
        artifact_versions: {},
        phase_history: [],
        approval_gates: {},
        stack_choice: null
      }
    };

    // Store the project idea as initial context for the Analyst agent
    const projectIdeaPath = resolve(projectPath, 'project_idea.txt');
    writeFileSync(projectIdeaPath, description || name, 'utf8');

    saveProjectMetadata(slug, metadata);

    return NextResponse.json({
      success: true,
      data: {
        ...metadata,
        orchestration_state: {
          artifact_versions: {},
          validation_results: {},
          approval_gates: {}
        }
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
