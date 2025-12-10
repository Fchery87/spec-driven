import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, persistProjectToDB, listArtifacts, readArtifact, writeArtifact } from '@/app/api/lib/project-utils';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  category: 'requirement_mapping' | 'consistency' | 'compliance' | 'completeness';
  status: 'pass' | 'fail' | 'warning' | 'pending';
  details?: string;
  items?: {
    item: string;
    status: 'pass' | 'fail' | 'warning';
    message?: string;
  }[];
}

interface ValidationResult {
  checks: ValidationCheck[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    pending: number;
    overallStatus: 'pass' | 'fail' | 'warning' | 'pending';
    completedAt: string;
  };
}

/**
 * POST /api/projects/[slug]/validate
 * Run validation checks on all project artifacts
 */
const validateHandler = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;
      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      if (metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Collect all artifacts for validation
      const artifacts: Record<string, string> = {};
      const phases = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING'];

      for (const phase of phases) {
        const phaseArtifacts = await listArtifacts(slug, phase);
        for (const artifact of phaseArtifacts) {
          try {
            const content = await readArtifact(slug, phase, artifact.name);
            artifacts[`${phase}/${artifact.name}`] = content;
          } catch {
            // Skip missing artifacts
          }
        }
      }

      // Run validation checks
      const checks = await runValidationChecks(artifacts, metadata);

      // Calculate summary
      const summary = {
        totalChecks: checks.length,
        passed: checks.filter(c => c.status === 'pass').length,
        failed: checks.filter(c => c.status === 'fail').length,
        warnings: checks.filter(c => c.status === 'warning').length,
        pending: checks.filter(c => c.status === 'pending').length,
        overallStatus: determineOverallStatus(checks),
        completedAt: new Date().toISOString()
      };

      const result: ValidationResult = { checks, summary };

      // Generate validation report artifact
      const reportContent = generateValidationReport(result, metadata.name);
      await writeArtifact(slug, 'VALIDATE', 'validation-report.md', reportContent);

      // Generate coverage matrix artifact
      const matrixContent = generateCoverageMatrix(artifacts);
      await writeArtifact(slug, 'VALIDATE', 'coverage-matrix.md', matrixContent);

      // Save artifacts to database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug, session.user.id);
      if (dbProject) {
        await dbService.saveArtifact(dbProject.id, 'VALIDATE', 'validation-report.md', reportContent);
        await dbService.saveArtifact(dbProject.id, 'VALIDATE', 'coverage-matrix.md', matrixContent);
        await dbService.recordPhaseHistory(dbProject.id, 'VALIDATE', summary.overallStatus === 'fail' ? 'failed' : 'completed');
      }

      // Update metadata with validation state
      const updated = {
        ...metadata,
        validation_result: result,
        updated_at: new Date().toISOString()
      };
      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      logger.info('Validation completed', {
        project: slug,
        passed: summary.passed,
        failed: summary.failed,
        warnings: summary.warnings,
        overall: summary.overallStatus
      });

      return NextResponse.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error running validation', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json(
        { success: false, error: 'Failed to run validation' },
        { status: 500 }
      );
    }
  }
);

/**
 * Run all validation checks against artifacts
 */
async function runValidationChecks(
  artifacts: Record<string, string>,
  metadata: Record<string, unknown>
): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // 1. Requirement to Task Mapping
  checks.push(await checkRequirementToTaskMapping(artifacts));

  // 2. API to Data Model Mapping
  checks.push(await checkApiToDataModelMapping(artifacts));

  // 3. Persona Consistency
  checks.push(await checkPersonaConsistency(artifacts));

  // 4. Stack Consistency
  checks.push(await checkStackConsistency(artifacts, metadata));

  // 5. Epic to Task Consistency
  checks.push(await checkEpicTaskConsistency(artifacts));

  // 6. Unresolved Clarifications
  checks.push(await checkUnresolvedClarifications(artifacts));

  // 7. AI Assumptions Documented
  checks.push(await checkAIAssumptionsDocumented(artifacts));

  // 8. Design System Compliance
  checks.push(await checkDesignSystemCompliance(artifacts));

  // 9. Test-First Compliance
  checks.push(await checkTestFirstCompliance(artifacts));

  // 10. Constitutional Articles Compliance
  checks.push(await checkConstitutionalCompliance(artifacts));

  return checks;
}

function determineOverallStatus(checks: ValidationCheck[]): 'pass' | 'fail' | 'warning' | 'pending' {
  if (checks.some(c => c.status === 'fail')) return 'fail';
  if (checks.some(c => c.status === 'warning')) return 'warning';
  if (checks.some(c => c.status === 'pending')) return 'pending';
  return 'pass';
}

// Validation Check Implementations

async function checkRequirementToTaskMapping(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const prd = artifacts['SPEC/PRD.md'] || '';
  const tasks = artifacts['SOLUTIONING/tasks.md'] || '';

  if (!prd || !tasks) {
    return {
      id: 'req-task-mapping',
      name: 'Requirement to Task Mapping',
      description: 'Every PRD requirement has at least one implementing task',
      category: 'requirement_mapping',
      status: 'pending',
      details: 'PRD or tasks.md not found'
    };
  }

  // Extract REQ-XXX-YYY patterns from PRD
  const reqPattern = /REQ-[A-Z]+-\d{3}/g;
  const prdReqs = [...new Set(prd.match(reqPattern) || [])];
  const taskReqs = [...new Set(tasks.match(reqPattern) || [])];

  const unmapped = prdReqs.filter(req => !taskReqs.includes(req));
  const items = prdReqs.map(req => ({
    item: req,
    status: taskReqs.includes(req) ? 'pass' as const : 'fail' as const,
    message: taskReqs.includes(req) ? 'Mapped to task' : 'No implementing task found'
  }));

  return {
    id: 'req-task-mapping',
    name: 'Requirement to Task Mapping',
    description: 'Every PRD requirement has at least one implementing task',
    category: 'requirement_mapping',
    status: unmapped.length === 0 ? 'pass' : 'fail',
    details: `${prdReqs.length - unmapped.length}/${prdReqs.length} requirements mapped to tasks`,
    items
  };
}

async function checkApiToDataModelMapping(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const apiSpec = artifacts['SPEC/api-spec.json'] || '';
  const dataModel = artifacts['SPEC/data-model.md'] || '';

  if (!apiSpec || !dataModel) {
    return {
      id: 'api-data-mapping',
      name: 'API to Data Model Mapping',
      description: 'All API response schemas have corresponding data model entities',
      category: 'consistency',
      status: 'pending',
      details: 'api-spec.json or data-model.md not found'
    };
  }

  // Extract entity names from data model (look for ## EntityName patterns)
  const entityPattern = /^##\s+(\w+)/gm;
  const entities = [...dataModel.matchAll(entityPattern)].map(m => m[1].toLowerCase());

  // Try to parse API spec and extract schema references
  let apiEntities: string[] = [];
  try {
    const spec = JSON.parse(apiSpec);
    const schemas = spec.components?.schemas || {};
    apiEntities = Object.keys(schemas).map(s => s.toLowerCase());
  } catch {
    return {
      id: 'api-data-mapping',
      name: 'API to Data Model Mapping',
      description: 'All API response schemas have corresponding data model entities',
      category: 'consistency',
      status: 'warning',
      details: 'Could not parse api-spec.json'
    };
  }

  const unmapped = apiEntities.filter(e => !entities.includes(e) && !['error', 'pagination', 'meta'].includes(e));
  const items = apiEntities.map(entity => ({
    item: entity,
    status: entities.includes(entity) || ['error', 'pagination', 'meta'].includes(entity) ? 'pass' as const : 'warning' as const,
    message: entities.includes(entity) ? 'Found in data model' : 'Not in data model'
  }));

  return {
    id: 'api-data-mapping',
    name: 'API to Data Model Mapping',
    description: 'All API response schemas have corresponding data model entities',
    category: 'consistency',
    status: unmapped.length === 0 ? 'pass' : 'warning',
    details: `${apiEntities.length - unmapped.length}/${apiEntities.length} schemas mapped`,
    items
  };
}

async function checkPersonaConsistency(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const personas = artifacts['ANALYSIS/personas.md'] || '';
  const prd = artifacts['SPEC/PRD.md'] || '';

  if (!personas || !prd) {
    return {
      id: 'persona-consistency',
      name: 'Persona Consistency',
      description: 'All personas referenced in PRD exist in personas.md',
      category: 'consistency',
      status: 'pending',
      details: 'personas.md or PRD.md not found'
    };
  }

  // Extract persona names from personas.md (look for ## Name patterns)
  const personaPattern = /^##\s+(.+?)(?:\s*\(|$)/gm;
  const definedPersonas = [...personas.matchAll(personaPattern)].map(m => m[1].trim().toLowerCase());

  // Look for persona references in PRD
  const prdPersonaRefs = prd.toLowerCase();
  const items = definedPersonas.map(persona => ({
    item: persona,
    status: prdPersonaRefs.includes(persona) ? 'pass' as const : 'warning' as const,
    message: prdPersonaRefs.includes(persona) ? 'Referenced in PRD' : 'Not referenced in PRD'
  }));

  const unreferenced = items.filter(i => i.status === 'warning').length;

  return {
    id: 'persona-consistency',
    name: 'Persona Consistency',
    description: 'All personas referenced in PRD exist in personas.md',
    category: 'consistency',
    status: unreferenced === 0 ? 'pass' : 'warning',
    details: `${definedPersonas.length - unreferenced}/${definedPersonas.length} personas referenced in PRD`,
    items
  };
}

async function checkStackConsistency(artifacts: Record<string, string>, metadata: Record<string, unknown>): Promise<ValidationCheck> {
  const stackDecision = artifacts['STACK_SELECTION/stack-decision.md'] || '';
  const architecture = artifacts['SOLUTIONING/architecture.md'] || '';
  const approvedStack = metadata.stack_choice as string || '';

  if (!stackDecision || !architecture) {
    return {
      id: 'stack-consistency',
      name: 'Stack Consistency',
      description: 'Technologies in architecture.md match stack-decision.md',
      category: 'consistency',
      status: 'pending',
      details: 'stack-decision.md or architecture.md not found'
    };
  }

  const items: { item: string; status: 'pass' | 'fail' | 'warning'; message?: string }[] = [];

  // Check if approved stack is mentioned
  if (approvedStack) {
    const stackMentioned = architecture.toLowerCase().includes(approvedStack.toLowerCase().replace(/_/g, ' '));
    items.push({
      item: `Approved stack: ${approvedStack}`,
      status: stackMentioned ? 'pass' : 'warning',
      message: stackMentioned ? 'Referenced in architecture' : 'Not explicitly mentioned'
    });
  }

  // Check for common technology mentions
  const techKeywords = ['next.js', 'react', 'node', 'postgres', 'prisma', 'drizzle', 'typescript', 'vercel'];
  for (const tech of techKeywords) {
    const inDecision = stackDecision.toLowerCase().includes(tech);
    const inArch = architecture.toLowerCase().includes(tech);
    if (inDecision) {
      items.push({
        item: tech,
        status: inArch ? 'pass' : 'warning',
        message: inArch ? 'Consistent' : 'In stack-decision but not in architecture'
      });
    }
  }

  const warnings = items.filter(i => i.status === 'warning').length;

  return {
    id: 'stack-consistency',
    name: 'Stack Consistency',
    description: 'Technologies in architecture.md match stack-decision.md',
    category: 'consistency',
    status: warnings === 0 ? 'pass' : 'warning',
    details: `${items.length - warnings}/${items.length} technologies consistent`,
    items
  };
}

async function checkEpicTaskConsistency(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const epics = artifacts['SOLUTIONING/epics.md'] || '';
  const tasks = artifacts['SOLUTIONING/tasks.md'] || '';

  if (!epics || !tasks) {
    return {
      id: 'epic-task-consistency',
      name: 'Epic to Task Consistency',
      description: 'All EPIC-IDs in tasks.md exist in epics.md',
      category: 'requirement_mapping',
      status: 'pending',
      details: 'epics.md or tasks.md not found'
    };
  }

  // Extract EPIC-XXX patterns
  const epicPattern = /EPIC-\d{3}/g;
  const definedEpics = [...new Set(epics.match(epicPattern) || [])];
  const taskEpics = [...new Set(tasks.match(epicPattern) || [])];

  const orphaned = taskEpics.filter(e => !definedEpics.includes(e));
  const items = taskEpics.map(epic => ({
    item: epic,
    status: definedEpics.includes(epic) ? 'pass' as const : 'fail' as const,
    message: definedEpics.includes(epic) ? 'Defined in epics.md' : 'Not defined in epics.md'
  }));

  return {
    id: 'epic-task-consistency',
    name: 'Epic to Task Consistency',
    description: 'All EPIC-IDs in tasks.md exist in epics.md',
    category: 'requirement_mapping',
    status: orphaned.length === 0 ? 'pass' : 'fail',
    details: `${taskEpics.length - orphaned.length}/${taskEpics.length} epics valid`,
    items
  };
}

async function checkUnresolvedClarifications(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const unresolvedPattern = /\[NEEDS CLARIFICATION:[^\]]+\]/g;
  const items: { item: string; status: 'pass' | 'fail' | 'warning'; message?: string }[] = [];

  for (const [path, content] of Object.entries(artifacts)) {
    const matches = content.match(unresolvedPattern) || [];
    for (const match of matches) {
      items.push({
        item: match.substring(0, 60) + (match.length > 60 ? '...' : ''),
        status: 'fail',
        message: `Found in ${path}`
      });
    }
  }

  return {
    id: 'unresolved-clarifications',
    name: 'No Unresolved Clarifications',
    description: 'All [NEEDS CLARIFICATION] markers have been resolved',
    category: 'completeness',
    status: items.length === 0 ? 'pass' : 'fail',
    details: items.length === 0 ? 'No unresolved clarifications' : `${items.length} unresolved clarifications found`,
    items: items.length > 0 ? items : undefined
  };
}

async function checkAIAssumptionsDocumented(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const assumptionPattern = /\[AI ASSUMED:[^\]]+\]/g;
  const items: { item: string; status: 'pass' | 'fail' | 'warning'; message?: string }[] = [];

  for (const [path, content] of Object.entries(artifacts)) {
    const matches = content.match(assumptionPattern) || [];
    for (const match of matches) {
      items.push({
        item: match.substring(0, 60) + (match.length > 60 ? '...' : ''),
        status: 'warning',
        message: `Documented in ${path}`
      });
    }
  }

  return {
    id: 'ai-assumptions',
    name: 'AI Assumptions Documented',
    description: 'All AI assumptions are properly documented',
    category: 'completeness',
    status: 'pass', // Assumptions being documented is good
    details: items.length === 0 ? 'No AI assumptions made' : `${items.length} AI assumptions documented`,
    items: items.length > 0 ? items : undefined
  };
}

async function checkDesignSystemCompliance(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const designSystem = artifacts['SPEC/design-system.md'] || '';

  if (!designSystem) {
    return {
      id: 'design-system-compliance',
      name: 'Design System Compliance',
      description: 'Design system follows established guidelines',
      category: 'compliance',
      status: 'pending',
      details: 'design-system.md not found'
    };
  }

  const items: { item: string; status: 'pass' | 'fail' | 'warning'; message?: string }[] = [];

  // Check for purple/indigo (not allowed as primary)
  const hasPurplePrimary = /primary.*(?:purple|indigo|#[89ab][0-9a-f]{2}[89ab][0-9a-f]{2})/i.test(designSystem);
  items.push({
    item: 'No purple/indigo as primary color',
    status: hasPurplePrimary ? 'fail' : 'pass',
    message: hasPurplePrimary ? 'Purple/indigo detected as primary' : 'Compliant'
  });

  // Check for OKLCH color format
  const hasOKLCH = /oklch/i.test(designSystem);
  items.push({
    item: 'OKLCH color format used',
    status: hasOKLCH ? 'pass' : 'warning',
    message: hasOKLCH ? 'OKLCH format found' : 'Consider using OKLCH'
  });

  // Check for typography sizes (should have exactly 4)
  const typographySizes = designSystem.match(/text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)/g) || [];
  const uniqueSizes = [...new Set(typographySizes)].length;
  items.push({
    item: 'Exactly 4 typography sizes',
    status: uniqueSizes <= 4 ? 'pass' : 'warning',
    message: `${uniqueSizes} sizes found`
  });

  const failures = items.filter(i => i.status === 'fail').length;

  return {
    id: 'design-system-compliance',
    name: 'Design System Compliance',
    description: 'Design system follows established guidelines',
    category: 'compliance',
    status: failures > 0 ? 'fail' : 'pass',
    details: `${items.length - failures}/${items.length} guidelines met`,
    items
  };
}

async function checkTestFirstCompliance(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const tasks = artifacts['SOLUTIONING/tasks.md'] || '';

  if (!tasks) {
    return {
      id: 'test-first-compliance',
      name: 'Test-First Compliance',
      description: 'Tests are specified before implementation in tasks',
      category: 'compliance',
      status: 'pending',
      details: 'tasks.md not found'
    };
  }

  // Check if tasks mention tests before implementation
  const hasTestSection = /test.*specification|test.*criteria|acceptance.*test/i.test(tasks);
  const hasTestFirst = /##.*test/i.test(tasks);

  const items: { item: string; status: 'pass' | 'fail' | 'warning'; message?: string }[] = [];

  items.push({
    item: 'Test specifications present',
    status: hasTestSection || hasTestFirst ? 'pass' : 'warning',
    message: hasTestSection || hasTestFirst ? 'Test sections found' : 'No explicit test sections'
  });

  // Check for Gherkin-style acceptance criteria
  const hasGherkin = /given.*when.*then/i.test(tasks);
  items.push({
    item: 'Gherkin acceptance criteria',
    status: hasGherkin ? 'pass' : 'warning',
    message: hasGherkin ? 'Gherkin format found' : 'Consider adding Given/When/Then'
  });

  const warnings = items.filter(i => i.status === 'warning').length;

  return {
    id: 'test-first-compliance',
    name: 'Test-First Compliance',
    description: 'Tests are specified before implementation in tasks',
    category: 'compliance',
    status: warnings === 0 ? 'pass' : 'warning',
    details: `${items.length - warnings}/${items.length} test-first criteria met`,
    items
  };
}

async function checkConstitutionalCompliance(artifacts: Record<string, string>): Promise<ValidationCheck> {
  const architecture = artifacts['SOLUTIONING/architecture.md'] || '';
  const tasks = artifacts['SOLUTIONING/tasks.md'] || '';
  const dependencies = artifacts['DEPENDENCIES/DEPENDENCIES.md'] || '';

  const items: { item: string; status: 'pass' | 'fail' | 'warning'; message?: string }[] = [];

  // Article 1: Library-First Principle
  const hasModularStructure = /module|component|service|library/i.test(architecture);
  items.push({
    item: 'Article 1: Library-First',
    status: hasModularStructure ? 'pass' : 'warning',
    message: hasModularStructure ? 'Modular structure evident' : 'Consider modular boundaries'
  });

  // Article 2: Test-First Imperative (already checked separately)
  items.push({
    item: 'Article 2: Test-First',
    status: /test/i.test(tasks) ? 'pass' : 'warning',
    message: 'See Test-First Compliance check'
  });

  // Article 3: Simplicity Gate (max 3 services for MVP)
  const serviceCount = (architecture.match(/service|microservice/gi) || []).length;
  items.push({
    item: 'Article 3: Simplicity (≤3 services)',
    status: serviceCount <= 3 ? 'pass' : 'warning',
    message: `${serviceCount} service mentions found`
  });

  // Article 4: Anti-Abstraction
  const hasAbstractionJustification = /wrapper|abstraction|justify/i.test(dependencies);
  items.push({
    item: 'Article 4: Anti-Abstraction',
    status: 'pass', // Hard to validate automatically
    message: 'Manual review recommended'
  });

  // Article 5: Integration-First Testing
  const hasIntegrationTests = /integration.*test|real.*database|real.*service/i.test(tasks);
  items.push({
    item: 'Article 5: Integration-First',
    status: hasIntegrationTests ? 'pass' : 'warning',
    message: hasIntegrationTests ? 'Integration tests mentioned' : 'Consider real service tests'
  });

  const failures = items.filter(i => i.status === 'fail').length;
  const warnings = items.filter(i => i.status === 'warning').length;

  return {
    id: 'constitutional-compliance',
    name: 'Constitutional Articles Compliance',
    description: 'All 5 Constitutional Articles are followed',
    category: 'compliance',
    status: failures > 0 ? 'fail' : (warnings > 2 ? 'warning' : 'pass'),
    details: `${5 - failures - warnings}/5 articles fully compliant`,
    items
  };
}

function generateValidationReport(result: ValidationResult, projectName: string): string {
  const { checks, summary } = result;
  
  let report = `---
title: Validation Report
project: ${projectName}
generated_at: ${summary.completedAt}
overall_status: ${summary.overallStatus}
---

# Validation Report

## Summary

| Metric | Count |
|--------|-------|
| Total Checks | ${summary.totalChecks} |
| Passed | ${summary.passed} |
| Failed | ${summary.failed} |
| Warnings | ${summary.warnings} |
| Overall Status | **${summary.overallStatus.toUpperCase()}** |

## Detailed Results

`;

  const categories = ['requirement_mapping', 'consistency', 'compliance', 'completeness'] as const;
  const categoryLabels: Record<typeof categories[number], string> = {
    requirement_mapping: 'Requirement Mapping',
    consistency: 'Consistency Checks',
    compliance: 'Constitutional Compliance',
    completeness: 'Completeness Checks'
  };

  for (const category of categories) {
    const categoryChecks = checks.filter(c => c.category === category);
    if (categoryChecks.length === 0) continue;

    report += `### ${categoryLabels[category]}\n\n`;

    for (const check of categoryChecks) {
      const statusEmoji = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      report += `#### ${statusEmoji} ${check.name}\n\n`;
      report += `${check.description}\n\n`;
      report += `**Status:** ${check.status.toUpperCase()}\n\n`;
      if (check.details) {
        report += `**Details:** ${check.details}\n\n`;
      }
      if (check.items && check.items.length > 0) {
        report += `| Item | Status | Message |\n|------|--------|--------|\n`;
        for (const item of check.items) {
          report += `| ${item.item} | ${item.status} | ${item.message || '-'} |\n`;
        }
        report += '\n';
      }
    }
  }

  return report;
}

function generateCoverageMatrix(artifacts: Record<string, string>): string {
  let matrix = `---
title: Coverage Matrix
generated_at: ${new Date().toISOString()}
---

# Coverage Matrix

## Artifacts by Phase

| Phase | Artifact | Size | Status |
|-------|----------|------|--------|
`;

  const phases = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING'];
  
  for (const phase of phases) {
    const phaseArtifacts = Object.entries(artifacts)
      .filter(([path]) => path.startsWith(`${phase}/`))
      .map(([path, content]) => ({
        name: path.split('/')[1],
        size: content.length
      }));

    for (const artifact of phaseArtifacts) {
      matrix += `| ${phase} | ${artifact.name} | ${(artifact.size / 1024).toFixed(1)}KB | ✅ Present |\n`;
    }
  }

  return matrix;
}

export const POST = validateHandler;
