import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, writeArtifact, persistProjectToDB } from '@/app/api/lib/project-utils';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { ConfigLoader } from '@/backend/services/orchestrator/config_loader';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { ApproveStackSchema, type CustomStackComposition, type TechnicalPreferences } from '@/app/api/schemas';

export const runtime = 'nodejs';

type ArchitectureType = 'web_application' | 'mobile_application' | 'api_first_platform' | 'static_site' | 'backend_heavy' | 'custom';
type PackageManager = 'pnpm' | 'npm' | 'bun';

type StackTemplateComposition = Partial<Record<'frontend' | 'mobile' | 'backend' | 'database' | 'deployment' | 'auth' | 'storage', string>>;
interface StackTemplate {
  name?: string;
  description?: string;
  composition?: StackTemplateComposition;
}
interface RawSpecWithTemplates {
  stack_templates?: Record<string, StackTemplate>;
}

function inferArchitectureType(stackChoice: string, composition?: Record<string, unknown>, mode: 'template' | 'custom' = 'template'): ArchitectureType {
  if (mode === 'custom' || stackChoice === 'custom') return 'custom';
  const id = stackChoice.toLowerCase();
  const mobile = typeof composition?.mobile === 'string' ? composition.mobile.toLowerCase() : '';

  if (id.includes('astro') || id.includes('static')) return 'static_site';
  if (id.includes('hono') || id.includes('api') || id.includes('edge') || id.includes('serverless')) return 'api_first_platform';
  if (id.includes('fastapi') || id.includes('django') || id.includes('go_')) return 'backend_heavy';
  if (mobile.includes('expo') || mobile.includes('flutter') || id.includes('expo') || id.includes('flutter') || id.includes('react_native')) {
    return 'mobile_application';
  }
  return 'web_application';
}

function generateStackProposalContent(params: {
  mode: 'template' | 'custom';
  stackChoice: string;
  packageManager: PackageManager;
  architectureType: ArchitectureType;
  templateName?: string;
}): string {
  const date = new Date().toISOString().split('T')[0];
  return `---
title: "Technology Stack Proposal"
owner: "architect"
version: "1"
date: "${date}"
status: "draft"
---

# Technology Stack Proposal

## Recommendation
- **Recommended Template**: ${params.mode === 'custom' ? 'custom' : params.stackChoice}
- **Architecture Type**: ${params.architectureType}
- **Package Manager**: ${params.packageManager}

## Notes
This proposal is a lightweight summary captured at approval time.
If you want an AI-authored recommendation matrix, run the STACK_SELECTION phase proposal generator (when available).
`;
}

function buildStackJson(params: {
  mode: 'template' | 'custom';
  stackChoice: string;
  packageManager: PackageManager;
  architectureType: ArchitectureType;
  customComposition?: CustomStackComposition;
  technicalPreferences?: TechnicalPreferences;
  template?: StackTemplate;
}): Record<string, unknown> {
  if (params.mode === 'custom' && params.customComposition) {
    return {
      template_id: 'custom',
      architecture_type: 'custom',
      package_manager: params.packageManager,
      frontend: params.customComposition.frontend,
      mobile: params.customComposition.mobile,
      backend: params.customComposition.backend,
      database: {
        provider: params.customComposition.database.provider,
        type: params.customComposition.database.type,
        orm: params.customComposition.database.orm || null,
      },
      deployment: params.customComposition.deployment,
      storage: null,
      auth: null,
      preferences: params.technicalPreferences || {},
    };
  }

  const composition = (params.template?.composition || {}) as StackTemplateComposition;
  const db = String(composition.database || '');
  const orm = db.toLowerCase().includes('drizzle') ? 'Drizzle' : db.toLowerCase().includes('prisma') ? 'Prisma' : null;
  const dbProvider = db.toLowerCase().includes('neon') ? 'Neon' : db.toLowerCase().includes('supabase') ? 'Supabase' : db;

  const isDefaultWeb = params.stackChoice === 'nextjs_web_app' || params.stackChoice === 'nextjs_web_only';

  return {
    template_id: params.stackChoice,
    architecture_type: params.architectureType,
    package_manager: params.packageManager,
    composition,
    database: {
      provider: dbProvider,
      engine: db.toLowerCase().includes('postgres') ? 'PostgreSQL' : null,
      orm,
    },
    storage: isDefaultWeb
      ? { provider: 'Cloudflare R2', protocol: 'S3-compatible' }
      : composition.storage
        ? { provider: composition.storage, protocol: null }
        : null,
    auth: isDefaultWeb
      ? { provider: 'Better Auth' }
      : composition.auth
        ? { provider: composition.auth }
        : null,
    deployment: { primary: composition.deployment || null },
    preferences: params.technicalPreferences || {},
  };
}

/**
 * Generate stack-decision.md content based on mode (template or custom)
 */
function generateStackDecisionContent(
  mode: 'template' | 'custom',
  stackChoice: string,
  reasoning: string,
  customComposition?: CustomStackComposition,
  technicalPreferences?: TechnicalPreferences,
  alternativesConsidered?: Array<{ stack: string; reason_not_chosen: string }>
): string {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();

  // Build composition table based on mode
  let compositionTable = '';
  if (mode === 'custom' && customComposition) {
    compositionTable = `| Layer | Technology | Details |
|-------|------------|---------|
| Frontend | ${customComposition.frontend.framework} | ${customComposition.frontend.meta_framework || 'N/A'} + ${customComposition.frontend.styling} + ${customComposition.frontend.ui_library} |
| Mobile | ${customComposition.mobile.platform} | ${customComposition.mobile.platform === 'none' ? 'Responsive web only' : customComposition.mobile.platform} |
| Backend | ${customComposition.backend.language} | ${customComposition.backend.framework} |
| Database | ${customComposition.database.provider} | ${customComposition.database.type}${customComposition.database.orm ? ` + ${customComposition.database.orm}` : ''} |
| Deployment | ${customComposition.deployment.platform} | ${customComposition.deployment.architecture} architecture |`;
  } else {
    compositionTable = `| Layer | Selection |
|-------|-----------|
| Template | ${stackChoice} |

*See stack_templates in orchestrator_spec.yml for full composition details.*`;
  }

  // Build technical preferences table
  let preferencesTable = '';
  if (technicalPreferences && Object.keys(technicalPreferences).length > 0) {
    const prefs = Object.entries(technicalPreferences)
      .filter(([, v]) => v)
      .map(([k, v]) => `| ${k.replace(/_/g, ' ')} | ${v} |`)
      .join('\n');
    preferencesTable = `## Technical Preferences Applied

| Category | Library |
|----------|---------|
${prefs}`;
  }

  // Build alternatives table
  let alternativesTable = '';
  if (alternativesConsidered && alternativesConsidered.length > 0) {
    const alts = alternativesConsidered
      .map((alt) => `| ${alt.stack} | ${alt.reason_not_chosen} |`)
      .join('\n');
    alternativesTable = `## Alternatives Considered

| Stack | Why Not Chosen |
|-------|----------------|
${alts}`;
  }

  return `---
title: "Technology Stack Decision"
owner: "architect"
version: "1"
date: "${date}"
status: "approved"
mode: "${mode}"
template: "${stackChoice}"
---

# Technology Stack Decision

## Selection Mode
**${mode === 'custom' ? 'Custom Stack' : 'Template: ' + stackChoice}**

## Composition

${compositionTable}

${preferencesTable}

## Rationale
${reasoning || 'Stack approved by user.'}

${alternativesTable}

## Approval Details
- **Approved At**: ${timestamp}
- **Mode**: ${mode}

## Next Steps
This stack decision will guide dependency generation in the DEPENDENCIES phase.
`;
}

/**
 * Generate stack-rationale.md content for audit trail
 */
function generateStackRationaleContent(
  mode: 'template' | 'custom',
  stackChoice: string,
  reasoning: string,
  alternativesConsidered?: Array<{ stack: string; reason_not_chosen: string }>
): string {
  const date = new Date().toISOString().split('T')[0];

  return `---
title: "Stack Selection Rationale"
owner: "architect"
version: "1"
date: "${date}"
status: "approved"
---

# Stack Selection Rationale

## Summary
- **Selection Mode**: ${mode}
- **Chosen Stack**: ${stackChoice}
- **Decision Date**: ${date}

## Reasoning

${reasoning || 'User approved the stack selection.'}

## Decision Factors

The stack was selected based on:
1. Project requirements from project-brief.md
2. User persona needs from personas.md
3. Technical constraints from constitution.md

${alternativesConsidered && alternativesConsidered.length > 0 ? `
## Alternatives Considered

${alternativesConsidered.map((alt) => `### ${alt.stack}
**Why not chosen**: ${alt.reason_not_chosen}
`).join('\n')}` : ''}

## Trade-offs Accepted

*To be detailed based on the specific stack choice.*

## Future Considerations

- Monitor performance and scalability as the project grows
- Re-evaluate stack if requirements change significantly
- Consider migration paths documented in orchestrator_spec.yml
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
      const validationResult = ApproveStackSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn('POST /api/projects/:slug/approve-stack - validation failed', {
          errors: validationResult.error.flatten(),
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const {
        mode = 'template',
        stack_choice,
        custom_composition,
        technical_preferences,
        package_manager,
        reasoning,
        alternatives_considered,
        platform,
      } = validationResult.data;

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata || metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      const configLoader = new ConfigLoader();
      const spec = configLoader.loadSpec() as unknown as RawSpecWithTemplates;
      const stackTemplates = spec.stack_templates || {};
      const template = stackTemplates[stack_choice];

      if (mode === 'template' && !template && stack_choice !== 'custom') {
        return NextResponse.json(
          {
            success: false,
            error: `Unknown stack_choice template: "${stack_choice}"`,
            details: {
              stack_choice,
              available_templates: Object.keys(stackTemplates).sort(),
            },
          },
          { status: 400 }
        );
      }

      const architectureType = inferArchitectureType(stack_choice, template?.composition, mode);
      const packageManager = (package_manager || 'pnpm') as PackageManager;

      // Generate stack-decision.md
      const stackDecisionContent = generateStackDecisionContent(
        mode,
        stack_choice,
        reasoning || '',
        custom_composition,
        technical_preferences,
        alternatives_considered
      );

      // Generate stack-rationale.md
      const stackRationaleContent = generateStackRationaleContent(
        mode,
        stack_choice,
        reasoning || '',
        alternatives_considered
      );

      // Write artifacts to filesystem
      const stackProposalContent = generateStackProposalContent({
        mode,
        stackChoice: stack_choice,
        packageManager,
        architectureType,
        templateName: template?.name,
      });

      const stackJson = buildStackJson({
        mode,
        stackChoice: stack_choice,
        packageManager,
        architectureType,
        customComposition: custom_composition,
        technicalPreferences: technical_preferences,
        template,
      });

      const stackJsonContent = JSON.stringify(stackJson, null, 2);

      await writeArtifact(slug, 'STACK_SELECTION', 'stack-proposal.md', stackProposalContent);
      await writeArtifact(slug, 'STACK_SELECTION', 'stack-decision.md', stackDecisionContent);
      await writeArtifact(slug, 'STACK_SELECTION', 'stack-rationale.md', stackRationaleContent);
      await writeArtifact(slug, 'STACK_SELECTION', 'stack.json', stackJsonContent);

      // DB-primary: persist artifacts to database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug, session.user.id);

      if (dbProject) {
        try {
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'stack-proposal.md',
            stackProposalContent
          );
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'stack-decision.md',
            stackDecisionContent
          );
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'stack-rationale.md',
            stackRationaleContent
          );
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'stack.json',
            stackJsonContent
          );

          logger.info('Stack approval artifacts persisted to database', {
            slug,
            projectId: dbProject.id,
            mode,
          });
        } catch (dbError) {
          logger.warn(
            `Failed to persist stack artifacts to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
            { slug }
          );
        }
      }

      // Update project metadata with extended information
      const updated = {
        ...metadata,
        stack_choice,
        stack_mode: mode,
        platform_type: platform,
        architecture_type: architectureType,
        package_manager: packageManager,
        stack_approved: true,
        stack_approval_date: new Date().toISOString(),
        stack_reasoning: reasoning,
        technical_preferences: technical_preferences || {},
        custom_composition: mode === 'custom' ? custom_composition : undefined,
        created_by_id: metadata.created_by_id || session.user.id,
        updated_at: new Date().toISOString(),
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      logger.info('Stack selection approved', {
        slug,
        userId: session.user.id,
        stackChoice: stack_choice,
        mode,
      });

      return NextResponse.json({
        success: true,
        data: {
          slug,
          stack_choice,
          mode,
          platform_type: platform,
          architecture_type: architectureType,
          package_manager: packageManager,
          stack_approved: true,
          technical_preferences,
          message: 'Stack selection approved successfully',
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error approving stack:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to approve stack' },
        { status: 500 }
      );
    }
  }
);
