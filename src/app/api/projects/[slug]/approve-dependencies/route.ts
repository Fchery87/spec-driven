import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, writeArtifact, persistProjectToDB } from '@/app/api/lib/project-utils';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { ApproveDependenciesSchema, type DependencyPackage, type DependencyOption } from '@/app/api/schemas';

export const runtime = 'nodejs';

type PackageManager = 'pnpm' | 'npm' | 'bun';

function getLockfile(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'package-lock.json';
    case 'bun':
      return 'bun.lock';
    default:
      return 'pnpm-lock.yaml';
  }
}

function buildDependenciesJson(params: {
  packageManager: PackageManager;
  option?: DependencyOption;
  customStack?: { frontend: string; backend: string; database: string; deployment: string; dependencies: string[]; requests?: string };
}): string {
  const toEntry = (pkg: DependencyPackage) => ({
    name: pkg.name,
    range: pkg.version,
    category: pkg.category,
    reason: `${pkg.category} dependency`,
    links: [pkg.category === 'dev' ? 'DX-TOOLING' : 'ARCH-STACK'],
  });

  const baseline = params.option
    ? {
        dependencies: params.option.packages.filter(p => p.category !== 'dev').map(toEntry),
        devDependencies: params.option.packages.filter(p => p.category === 'dev').map(toEntry),
      }
    : params.customStack
      ? {
          dependencies: params.customStack.dependencies.map((d) => ({
            name: d,
            range: '*',
            category: 'core',
            reason: 'Custom dependency',
            links: ['ARCH-STACK'],
          })),
          devDependencies: [],
        }
      : { dependencies: [], devDependencies: [] };

  const json = {
    package_manager: params.packageManager,
    lockfile: getLockfile(params.packageManager),
    baseline,
    addons: [],
    banned: ['request', 'left-pad'],
    commands: {
      pnpm: {
        install: 'pnpm install',
        ci: 'pnpm install --frozen-lockfile',
        add: 'pnpm add <pkg>',
        addDev: 'pnpm add -D <pkg>',
      },
      npm: {
        install: 'npm install',
        ci: 'npm ci',
        add: 'npm install <pkg>',
        addDev: 'npm install -D <pkg>',
      },
      bun: {
        install: 'bun install',
        ci: 'bun install --frozen-lockfile',
        add: 'bun add <pkg>',
        addDev: 'bun add -d <pkg>',
      },
    },
  };

  return JSON.stringify(json, null, 2);
}

/**
 * Generate DEPENDENCIES.md content from selected packages
 */
function generateDependenciesMarkdown(
  option: DependencyOption | undefined,
  customStack: { frontend: string; backend: string; database: string; deployment: string; dependencies: string[]; requests?: string } | undefined,
  architecture: string | undefined,
  notes: string | undefined
): string {
  const date = new Date().toISOString().split('T')[0];
  
  if (option) {
    // Preset selection
    const productionDeps = option.packages.filter(p => p.category !== 'dev');
    const devDeps = option.packages.filter(p => p.category === 'dev');
    
    const formatPackage = (pkg: DependencyPackage) => {
      let line = `| ${pkg.name} | ${pkg.version} | ${pkg.category} |`;
      if (pkg.size) line = `| ${pkg.name} | ${pkg.version} | ${pkg.category} | ${pkg.size} |`;
      return line;
    };

    return `---
title: "Project Dependencies"
owner: "devops"
version: "1"
date: "${date}"
status: "approved"
architecture: "${architecture || 'web_application'}"
preset: "${option.id}"
---

# Project Dependencies

## Overview

| Attribute | Value |
|-----------|-------|
| **Architecture** | ${architecture?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Web Application'} |
| **Preset** | ${option.title} |
| **Total Packages** | ${option.packages.length} |
| **Production** | ${productionDeps.length} |
| **Development** | ${devDeps.length} |
| **Status** | ✅ Approved |

## Stack Configuration

| Component | Technology |
|-----------|------------|
| **Frontend** | ${option.frontend} |
| **Backend** | ${option.backend} |
| **Database** | ${option.database} |
| **Deployment** | ${option.deployment} |

## Production Dependencies

| Package | Version | Category | Size |
|---------|---------|----------|------|
${productionDeps.map(formatPackage).join('\n')}

${devDeps.length > 0 ? `## Development Dependencies

| Package | Version | Category | Size |
|---------|---------|----------|------|
${devDeps.map(formatPackage).join('\n')}
` : ''}

## Key Highlights

${option.highlights.map(h => `- ${h}`).join('\n')}

## Installation

\`\`\`bash
# pnpm (default)
pnpm install
pnpm install --frozen-lockfile

# npm
npm install
npm ci

# bun
bun install
bun install --frozen-lockfile
\`\`\`

## Approval Notes

${notes || 'Dependencies reviewed and approved for this project.'}

## Approved

- **Date**: ${new Date().toISOString()}
- **Status**: ✅ Approved
`;
  } else if (customStack) {
    // Custom stack
    return `---
title: "Project Dependencies"
owner: "devops"
version: "1"
date: "${date}"
status: "approved"
architecture: "custom"
---

# Project Dependencies (Custom Stack)

## Overview

| Attribute | Value |
|-----------|-------|
| **Architecture** | Custom |
| **Total Packages** | ${customStack.dependencies.length} |
| **Status** | ✅ Approved |

## Stack Configuration

| Component | Technology |
|-----------|------------|
| **Frontend** | ${customStack.frontend} |
| **Backend** | ${customStack.backend} |
| **Database** | ${customStack.database} |
| **Deployment** | ${customStack.deployment} |

## Dependencies

${customStack.dependencies.map(d => `- ${d}`).join('\n')}

${customStack.requests ? `## Additional Requests

${customStack.requests}
` : ''}

## Approval Notes

${notes || 'Custom dependencies reviewed and approved for this project.'}

## Approved

- **Date**: ${new Date().toISOString()}
- **Status**: ✅ Approved
`;
  }

  // Fallback for legacy approval (notes only)
  return `---
title: "Dependencies Approval"
owner: "devops"
version: "1"
date: "${date}"
status: "approved"
---

# Dependencies Approval

## Status
**Approved**

## Approval Notes
${notes || 'Dependencies reviewed and approved for this project.'}

## Date Approved
${new Date().toISOString()}

## What This Means
All project dependencies have been reviewed and approved. The project is now cleared to proceed to the SOLUTIONING phase where architecture design and task breakdown will occur.
`;
}

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await params;
      const body = await request.json();

      // Validate input with Zod schema
      const validationResult = ApproveDependenciesSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn(
          'POST /api/projects/:slug/approve-dependencies - validation failed',
          {
            errors: validationResult.error.flatten(),
          }
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { notes, mode, architecture, option, customStack } = validationResult.data;

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata || metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Check if in DEPENDENCIES phase
      if (metadata.current_phase !== 'DEPENDENCIES') {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot approve dependencies in ${metadata.current_phase} phase. Must be in DEPENDENCIES phase.`,
          },
          { status: 400 }
        );
      }

      // Generate DEPENDENCIES.md content
      const dependenciesContent = generateDependenciesMarkdown(option, customStack, architecture, notes);

      const packageManager = (metadata.package_manager || 'pnpm') as PackageManager;
      const dependenciesJsonContent = buildDependenciesJson({
        packageManager,
        option,
        customStack,
      });

      // Write DEPENDENCIES.md artifact to filesystem
      await writeArtifact(slug, 'DEPENDENCIES', 'DEPENDENCIES.md', dependenciesContent);

      // Canonical machine-readable artifact
      await writeArtifact(slug, 'DEPENDENCIES', 'dependencies.json', dependenciesJsonContent);

      // Also write approval.md for backward compatibility
      const approvalContent = `---
title: "Dependencies Approval"
owner: "devops"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "approved"
---

# Dependencies Approval

## Status
**Approved**

## Mode
${mode === 'preset' ? `Preset: ${option?.title}` : mode === 'custom' ? 'Custom Stack' : 'Direct Approval'}

## Approval Notes
${notes || 'Dependencies reviewed and approved for this project.'}

## Date Approved
${new Date().toISOString()}
`;

      await writeArtifact(slug, 'DEPENDENCIES', 'approval.md', approvalContent);

      // DB-primary: persist artifacts to database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug, session.user.id);

      if (dbProject) {
        try {
          // Save DEPENDENCIES.md
          await dbService.saveArtifact(
            dbProject.id,
            'DEPENDENCIES',
            'DEPENDENCIES.md',
            dependenciesContent
          );

          // Save dependencies.json
          await dbService.saveArtifact(
            dbProject.id,
            'DEPENDENCIES',
            'dependencies.json',
            dependenciesJsonContent
          );

          // Save approval.md
          await dbService.saveArtifact(
            dbProject.id,
            'DEPENDENCIES',
            'approval.md',
            approvalContent
          );

          logger.info(
            'Dependencies artifacts persisted to database',
            {
              slug,
              projectId: dbProject.id,
              mode,
              architecture,
            }
          );
        } catch (dbError) {
          logger.warn(
            `Failed to persist dependencies to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
            { slug }
          );
          // Don't fail the request; artifacts are still in filesystem
        }
      }

      // Update project metadata with dependency info
      const updated = {
        ...metadata,
        dependencies_approved: true,
        dependencies_approval_date: new Date().toISOString(),
        dependencies_approval_notes: notes,
        dependencies_mode: mode,
        dependencies_architecture: architecture,
        dependencies_preset: option?.id,
        dependencies_package_manager: packageManager,
        created_by_id: metadata.created_by_id || session.user.id,
        updated_at: new Date().toISOString(),
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      logger.info('Dependencies approved', {
        slug,
        userId: session.user.id,
        mode,
        architecture,
        preset: option?.id,
      });

      return NextResponse.json({
        success: true,
        data: {
          slug,
          dependencies_approved: true,
          mode,
          architecture,
          preset: option?.id,
          message: 'Dependencies approved successfully',
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error approving dependencies:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to approve dependencies' },
        { status: 500 }
      );
    }
  }
);
