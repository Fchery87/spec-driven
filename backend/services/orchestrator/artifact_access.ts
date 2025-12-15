import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { logger } from '@/lib/logger';
import { downloadFromR2, listR2Artifacts } from '@/lib/r2-storage';

const PROJECTS_BASE_PATH = resolve(process.cwd(), 'projects');

export const ORCHESTRATOR_PHASES = [
  'ANALYSIS',
  'STACK_SELECTION',
  'SPEC',
  'DEPENDENCIES',
  'SOLUTIONING',
  'VALIDATE',
  'DONE',
] as const;

export type OrchestratorPhase = (typeof ORCHESTRATOR_PHASES)[number];

function isR2Configured(): boolean {
  return Boolean(
    (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID) &&
      (process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID) &&
      (process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY)
  );
}

function readArtifactFromFilesystem(projectSlug: string, phase: string, filename: string): string | null {
  const artifactPath = resolve(PROJECTS_BASE_PATH, projectSlug, 'specs', phase, 'v1', filename);
  try {
    if (!existsSync(artifactPath)) return null;
    return readFileSync(artifactPath, 'utf8');
  } catch (error) {
    logger.debug('Failed to read artifact from filesystem', {
      projectSlug,
      phase,
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function getDbProjectIdBySlug(projectSlug: string): Promise<string | null> {
  try {
    const { db } = await import('@/backend/lib/drizzle');
    const { projects } = await import('@/backend/lib/schema');
    const { eq } = await import('drizzle-orm');

    const row = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
      columns: { id: true },
    });

    return row?.id || null;
  } catch (error) {
    logger.debug('Failed to resolve DB project id for slug', {
      projectSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readArtifactFromDatabase(projectSlug: string, phase: string, filename: string): Promise<string | null> {
  try {
    const projectId = await getDbProjectIdBySlug(projectSlug);
    if (!projectId) return null;

    const { db } = await import('@/backend/lib/drizzle');
    const { artifacts } = await import('@/backend/lib/schema');
    const { and, eq, desc } = await import('drizzle-orm');

    const row = await db.query.artifacts.findFirst({
      where: and(eq(artifacts.projectId, projectId), eq(artifacts.phase, phase), eq(artifacts.filename, filename)),
      orderBy: [desc(artifacts.version)],
      columns: { content: true },
    });

    return row?.content ?? null;
  } catch (error) {
    logger.debug('Failed to read artifact from database', {
      projectSlug,
      phase,
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readArtifactFromR2(projectSlug: string, phase: string, filename: string): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    const buffer = await downloadFromR2(projectSlug, phase, filename);
    return buffer.toString('utf-8');
  } catch (error) {
    logger.debug('Failed to read artifact from R2', {
      projectSlug,
      phase,
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function readArtifactContent(projectSlug: string, phase: string, filename: string): Promise<string> {
  // Priority: R2 -> DB -> filesystem
  const fromR2 = await readArtifactFromR2(projectSlug, phase, filename);
  if (fromR2 !== null) return fromR2;

  const fromDb = await readArtifactFromDatabase(projectSlug, phase, filename);
  if (fromDb !== null) return fromDb;

  const fromFs = readArtifactFromFilesystem(projectSlug, phase, filename);
  if (fromFs !== null) return fromFs;

  return '';
}

export async function listArtifactNamesMerged(projectSlug: string, phase: string): Promise<string[]> {
  const names = new Set<string>();

  // R2
  if (isR2Configured()) {
    try {
      const r2Files = await listR2Artifacts(projectSlug, phase);
      for (const file of r2Files) names.add(file.name);
    } catch (error) {
      logger.debug('Failed to list artifacts from R2', {
        projectSlug,
        phase,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // DB
  try {
    const projectId = await getDbProjectIdBySlug(projectSlug);
    if (projectId) {
      const { db } = await import('@/backend/lib/drizzle');
      const { artifacts } = await import('@/backend/lib/schema');
      const { and, eq } = await import('drizzle-orm');

      const rows = await db
        .select({ filename: artifacts.filename })
        .from(artifacts)
        .where(and(eq(artifacts.projectId, projectId), eq(artifacts.phase, phase)));

      for (const row of rows) names.add(row.filename);
    }
  } catch (error) {
    logger.debug('Failed to list artifacts from DB', {
      projectSlug,
      phase,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // filesystem
  try {
    const phasePath = resolve(PROJECTS_BASE_PATH, projectSlug, 'specs', phase, 'v1');
    if (existsSync(phasePath)) {
      for (const file of readdirSync(phasePath)) names.add(file);
    }
  } catch (error) {
    logger.debug('Failed to list artifacts from filesystem', {
      projectSlug,
      phase,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return Array.from(names).sort();
}

export async function buildArtifactCacheForProject(projectSlug: string): Promise<Map<string, string>> {
  const cache = new Map<string, string>();

  for (const phase of ORCHESTRATOR_PHASES) {
    const names = await listArtifactNamesMerged(projectSlug, phase);
    for (const name of names) {
      const content = await readArtifactContent(projectSlug, phase, name);
      cache.set(`${phase}/${name}`, content);
    }
  }

  return cache;
}

export async function artifactExists(projectSlug: string, phase: string, filename: string): Promise<boolean> {
  const names = await listArtifactNamesMerged(projectSlug, phase);
  return names.includes(filename);
}
