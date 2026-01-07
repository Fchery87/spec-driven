import { Validator, ValidationResult, Project } from '@/types/orchestrator';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { resolve, extname } from 'path';
import { execSync } from 'child_process';
import { logger } from '@/lib/logger';
import {
  buildArtifactCacheForProject,
  ORCHESTRATOR_PHASES,
} from './artifact_access';
import { detectForbiddenPatterns } from '@/backend/services/validation/anti_ai_slop_validator';

export class Validators {
  private validators: Record<string, Validator>;
  private projectsBasePath: string;
  private artifactCache: Map<string, string> | null = null;
  private artifactCacheProjectId: string | null = null;

  constructor(validators?: Record<string, Validator>) {
    this.validators = validators || {};
    this.projectsBasePath = resolve(process.cwd(), 'projects');
  }

  private async ensureArtifactCache(project: Project): Promise<void> {
    if (this.artifactCache && this.artifactCacheProjectId === project.id)
      return;
    this.artifactCache = await buildArtifactCacheForProject(project.id);
    this.artifactCacheProjectId = project.id;
  }

  /**
   * Run multiple validators for a phase
   */
  async runValidators(
    validatorNames: string[],
    project: Project
  ): Promise<ValidationResult> {
    const results: ValidationResult = {
      status: 'pass',
      checks: {},
      errors: [],
      warnings: [],
    };

    await this.ensureArtifactCache(project);

    for (const validatorName of validatorNames) {
      const validator = this.validators[validatorName];
      if (!validator) {
        results.errors?.push(`Unknown validator: ${validatorName}`);
        continue;
      }

      try {
        const result = await this.runValidator(
          validatorName,
          validator,
          project
        );
        results.checks[validatorName] = result.checks || {};

        if (result.status === 'fail') {
          results.status = 'fail';
          results.errors?.push(...(result.errors || []));
        } else if (result.status === 'warn' && results.status === 'pass') {
          results.status = 'warn';
        }

        results.warnings?.push(...(result.warnings || []));
      } catch (error) {
        results.status = 'fail';
        results.errors?.push(`Validator ${validatorName} failed: ${error}`);
      }
    }

    return results;
  }

  /**
   * Run a single validator
   */
  private async runValidator(
    name: string,
    validator: Validator,
    project: Project
  ): Promise<ValidationResult> {
    switch (validator.implementation) {
      case 'file_exists_check':
        return this.validateFilePresence(project);

      case 'frontmatter_parser':
        return this.validateFrontmatter(project);

      case 'content_length_check':
        return this.validateContentLength(
          project,
          (validator.min_length as number) || 100
        );

      case 'coverage_analysis':
        return this.validateCoverage(
          project,
          (validator.requirements as Record<string, string>) || {}
        );

      case 'openapi_validator':
        return this.validateOpenAPI(project);

      case 'database_field_check':
        return this.validateDatabaseField(
          project,
          validator.field as string,
          validator.expected_value
        );

      case 'script_execution':
        return this.validateScripts(
          project,
          (validator.scripts as string[]) || []
        );

      case 'dependency_graph_analysis':
        return this.validateTaskDependencies(project);

      case 'handoff_validator':
        return this.validateHandoff(
          project,
          (validator.required_sections as string[]) || []
        );

      case 'zip_validation':
        return this.validateZip(
          project,
          (validator.required_files as string[]) || []
        );

      case 'regex_pattern_check':
        return this.validateRequirementFormat(
          project,
          validator.pattern as string,
          validator.min_count as number
        );

      case 'cross_reference_check':
        return this.validateRequirementTraceability(
          project,
          validator.source_artifact as string,
          validator.target_artifact as string
        );

      case 'api_task_mapping':
        return this.validateAPIEndpointCoverage(
          project,
          validator.source_artifact as string,
          validator.target_artifact as string
        );

      case 'multi_artifact_validation':
        return this.validateCrossArtifactConsistency(
          project,
          validator.checks as string[]
        );

      case 'quality_scoring':
        return this.validateQualityScore(
          project,
          validator.criteria as Record<string, number>,
          validator.minimum_score as number
        );

      case 'json_schema_check':
        return this.validateJsonSchema(
          project,
          validator.artifact as string,
          (validator.required_fields as string[]) || []
        );

      case 'clarification_marker_check':
        return this.validateClarificationMarkers(
          project,
          (validator.allowed_unresolved as number) ?? 0,
          (validator.auto_resolved_marker as string) || '[AI ASSUMED:'
        );

      case 'test_first_validator':
        return this.validateTestFirstCompliance(project);

      case 'constitutional_validator':
        return this.validateConstitutionalCompliance(
          project,
          (validator.articles as Record<string, unknown>) || {}
        );

      case 'design_validator':
        return this.validateDesignSystemCompliance(
          project,
          (validator.checks as Record<string, unknown>) || {},
          (validator.anti_patterns as string[]) || []
        );

      case 'two_file_design_output':
        return this.validateTwoFileDesignOutput(project);

      case 'no_console_log':
        return this.validateNoConsoleLogs(project);

      case 'accessibility_check':
        return this.validateAccessibility(project);

      case 'no_placeholder':
        return this.validateNoPlaceholders(project);

      case 'stack_validator':
        return this.validateStackCompleteness(project);

      default:
        return {
          status: 'warn',
          checks: {},
          warnings: [
            `Unknown validator implementation: ${validator.implementation}`,
          ],
        };
    }
  }

  private validateClarificationMarkers(
    project: Project,
    allowedUnresolved: number,
    autoResolvedMarker: string
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const analysisFiles = [
      'constitution.md',
      'project-brief.md',
      'personas.md',
    ];
    const needsClarificationRegex = /\[NEEDS CLARIFICATION:/g;

    let totalUnresolved = 0;
    for (const filename of analysisFiles) {
      const content = this.getArtifactContent(project.id, filename, 'ANALYSIS');
      const matches = content.match(needsClarificationRegex) || [];
      totalUnresolved += matches.length;
      checks[`unresolved:${filename}`] = matches.length === 0;

      if (
        content.includes('[NEEDS CLARIFICATION') &&
        !content.match(/\bCLAR-\d{3}\b/)
      ) {
        warnings.push(
          `${filename} contains [NEEDS CLARIFICATION] markers but no CLAR-### IDs in an Open Questions list`
        );
      }

      if (
        content.includes(autoResolvedMarker) &&
        !content.match(/\bASM-\d{3}\b/)
      ) {
        warnings.push(
          `${filename} contains [AI ASSUMED] markers but no ASM-### IDs in an Assumptions Log`
        );
      }
    }

    checks['no_unresolved_clarifications'] =
      totalUnresolved <= allowedUnresolved;

    if (totalUnresolved > allowedUnresolved) {
      errors.push(
        `Found ${totalUnresolved} unresolved [NEEDS CLARIFICATION] markers (allowed: ${allowedUnresolved})`
      );
    }

    return {
      status:
        errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateTestFirstCompliance(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const tasksContent = this.getArtifactContent(
      project.id,
      'tasks.md',
      'SOLUTIONING'
    );
    if (!tasksContent) {
      return {
        status: 'warn',
        checks: { tasks_exists: false },
        warnings: [
          'tasks.md not found - skipping test-first compliance validation',
        ],
      };
    }

    const taskHeaderRegex = /^###\s+TASK-[A-Z0-9]+-[0-9]+:/gm;
    const headers = Array.from(tasksContent.matchAll(taskHeaderRegex));
    checks['tasks_found'] = headers.length > 0;

    if (headers.length === 0) {
      return {
        status: 'warn',
        checks,
        warnings: [
          'No TASK headings found in tasks.md - cannot validate test-first ordering',
        ],
      };
    }

    let compliant = 0;
    let missingTestSpecs = 0;
    let missingImplementationNotes = 0;
    let wrongOrder = 0;
    let missingTestTypes = 0;
    let missingRealServicesMention = 0;

    for (let i = 0; i < headers.length; i++) {
      const start = headers[i].index ?? 0;
      const end =
        i + 1 < headers.length
          ? headers[i + 1].index ?? tasksContent.length
          : tasksContent.length;
      const taskBlock = tasksContent.slice(start, end);

      const testIndex = taskBlock.search(
        /##\s*TESTS FIRST\b|Test Specifications/i
      );
      const implIndex = taskBlock.search(/Implementation Notes/i);

      if (testIndex === -1) {
        missingTestSpecs++;
        continue;
      }
      if (implIndex === -1) {
        missingImplementationNotes++;
        continue;
      }
      if (testIndex > implIndex) {
        wrongOrder++;
        continue;
      }

      const hasContract = /Contract/i.test(taskBlock);
      const hasIntegration = /Integration/i.test(taskBlock);
      const hasE2E = /\bE2E\b/i.test(taskBlock);
      const hasUnit = /\bUnit\b/i.test(taskBlock);
      if (!(hasContract && hasIntegration && hasE2E && hasUnit)) {
        missingTestTypes++;
      }

      const mentionsRealServices =
        /real\s+postgre(sql)?/i.test(taskBlock) ||
        /real\s+database/i.test(taskBlock) ||
        /test\s+instance/i.test(taskBlock);
      const mentionsSQLite = /\bsqlite\b/i.test(taskBlock);
      if (!mentionsRealServices || mentionsSQLite) {
        missingRealServicesMention++;
      }

      compliant++;
    }

    checks['test_specs_present'] = missingTestSpecs === 0;
    checks['implementation_notes_present'] = missingImplementationNotes === 0;
    checks['test_before_implementation'] = wrongOrder === 0;

    if (missingTestSpecs > 0) {
      errors.push(
        `${missingTestSpecs} tasks missing a Test Specifications section`
      );
    }
    if (missingImplementationNotes > 0) {
      warnings.push(
        `${missingImplementationNotes} tasks missing an Implementation Notes section (cannot validate ordering)`
      );
    }
    if (wrongOrder > 0) {
      errors.push(
        `${wrongOrder} tasks list implementation before tests (violates Article 2)`
      );
    }
    if (missingTestTypes > 0) {
      warnings.push(
        `${missingTestTypes} tasks do not clearly include Contract/Integration/E2E/Unit test types`
      );
    }
    if (missingRealServicesMention > 0) {
      warnings.push(
        `${missingRealServicesMention} tasks do not clearly specify real services for integration tests (Article 5)`
      );
    }

    checks['tasks_compliant'] =
      compliant === headers.length && errors.length === 0;

    return {
      status:
        errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateDesignSystemCompliance(
    project: Project,
    checksConfig: Record<string, unknown>,
    antiPatterns: string[]
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    // Look for spec-compliant design-tokens.md first, then legacy design-system.md
    const content =
      this.getArtifactContent(
        project.id,
        'design-tokens.md',
        'SPEC_DESIGN_TOKENS'
      ) ||
      this.getArtifactContent(
        project.id,
        'design-system.md',
        'SPEC_DESIGN_TOKENS'
      ) ||
      this.getArtifactContent(project.id, 'design-system.md', 'SPEC'); // Legacy fallback
    if (!content) {
      return {
        status: 'warn',
        checks: { design_tokens_exists: false },
        warnings: [
          'design-tokens.md (or legacy design-system.md) not found - skipping design system compliance validation',
        ],
      };
    }

    const hasOKLCH = /oklch\(/i.test(content) || /\bOKLCH\b/i.test(content);
    checks['oklch_color_format'] = hasOKLCH;
    if (!hasOKLCH) {
      errors.push(
        'Design tokens file does not appear to use OKLCH color format'
      );
    }

    const forbiddenColorMatch = content.match(
      /\b(primary|accent)\b[^\n]{0,120}\b(purple|indigo|violet)\b/i
    );
    checks['no_purple_primary'] = !forbiddenColorMatch;
    if (forbiddenColorMatch) {
      errors.push(
        'Design tokens file appears to use purple/indigo/violet for primary/accent tokens'
      );
    }

    const hasReducedMotion =
      /useReducedMotion/i.test(content) || /reduced\s+motion/i.test(content);
    checks['reduced_motion_support'] = hasReducedMotion;
    if (!hasReducedMotion) {
      warnings.push(
        'Design tokens file does not mention reduced motion support (useReducedMotion)'
      );
    }

    const hasAnimationTokens =
      /duration/i.test(content) && /spring/i.test(content);
    checks['has_animation_tokens'] = hasAnimationTokens;
    if (!hasAnimationTokens) {
      warnings.push(
        'Design tokens file does not clearly define animation tokens (durations + springs)'
      );
    }

    const typographySectionMatch = content.match(
      /##\s*Typography[\s\S]*?(?=\n##\s|\n#\s|$)/i
    );
    const typographySection = typographySectionMatch
      ? typographySectionMatch[0]
      : content;
    const tokenMatches =
      typographySection.match(/\b(body|label|heading|display)\b/gi) || [];
    const uniqueTokens = Array.from(
      new Set(tokenMatches.map((t) => t.toLowerCase()))
    );
    checks['typography_tokens_present'] =
      uniqueTokens.includes('body') &&
      uniqueTokens.includes('label') &&
      uniqueTokens.includes('heading') &&
      uniqueTokens.includes('display');
    if (!checks['typography_tokens_present']) {
      warnings.push(
        'Typography section does not clearly define the 4 required tokens: body, label, heading, display'
      );
    }

    // Spacing divisibility check (only inside the spacing section if present)
    const spacingSectionMatch = content.match(
      /##\s*Spacing[\s\S]*?(?=\n##\s|\n#\s|$)/i
    );
    const spacingSection = spacingSectionMatch ? spacingSectionMatch[0] : '';
    if (spacingSection) {
      const pxMatches = Array.from(
        spacingSection.matchAll(/\b(\d+(?:\.\d+)?)\s*px\b/g)
      ).map((m) => Number(m[1]));
      const invalid = pxMatches.filter(
        (n) => Number.isFinite(n) && n % 4 !== 0
      );
      checks['spacing_divisible_by_4'] = invalid.length === 0;
      if (invalid.length > 0) {
        warnings.push(
          `Found spacing values not divisible by 4 in Spacing section: ${invalid
            .slice(0, 8)
            .join(', ')}`
        );
      }
    } else {
      warnings.push(
        'No Spacing section found; cannot validate spacing token grid'
      );
    }

    // Anti-pattern heuristic checks (warn-only; content may list anti-patterns explicitly)
    for (const pattern of antiPatterns) {
      const needle = String(pattern).toLowerCase();
      if (
        needle &&
        content.toLowerCase().includes(needle) &&
        !needle.includes('avoid') &&
        !needle.includes('no ')
      ) {
        checks[`anti_pattern_mentioned:${pattern}`] = true;
      }
    }

    // Allow config to tighten checks later; currently informational
    checks['design_checks_config_present'] =
      Object.keys(checksConfig || {}).length > 0;

    return {
      status:
        errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateConstitutionalCompliance(
    project: Project,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    articles: Record<string, any>
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const architecture = this.getArtifactContent(
      project.id,
      'architecture.md',
      'SOLUTIONING'
    );
    const tasks = this.getArtifactContent(
      project.id,
      'tasks.md',
      'SOLUTIONING'
    );
    const dependencies = this.getArtifactContent(
      project.id,
      'DEPENDENCIES.md',
      'DEPENDENCIES'
    );

    // Article 1: Library-first / modular boundaries (heuristic)
    const hasModuleLanguage = /module|boundary|bounded context|layered/i.test(
      architecture
    );
    checks['article_1_modularity'] = hasModuleLanguage;
    if (!hasModuleLanguage) {
      warnings.push(
        'Architecture does not clearly describe module boundaries (Article 1)'
      );
    }

    // Article 2 + 5: reuse test-first validator signal
    const testFirst = this.validateTestFirstCompliance(project);
    checks['article_2_test_first'] = testFirst.status !== 'fail';
    if (testFirst.status === 'fail') {
      errors.push(
        ...(testFirst.errors || ['Test-first compliance failed (Article 2)'])
      );
    } else if (testFirst.status === 'warn') {
      warnings.push(...(testFirst.warnings || []));
    }

    const hasRealServicesMention =
      /real\s+postgre(sql)?|real\s+database|test\s+instance/i.test(tasks);
    checks['article_5_real_services'] = hasRealServicesMention;
    if (!hasRealServicesMention) {
      warnings.push(
        'Tasks do not clearly specify real services for integration tests (Article 5)'
      );
    }

    // Article 3: <= 3 services for MVP unless justified (heuristic)
    const servicesSection =
      architecture.match(/##\s*Services[\s\S]*?(?=\n##\s|\n#\s|$)/i)?.[0] || '';
    const serviceBullets = servicesSection
      ? servicesSection.match(/^\s*[-*]\s+/gm) || []
      : [];
    const hasJustification = /justify|justification|rationale/i.test(
      architecture
    );
    const serviceCount = serviceBullets.length;
    checks['article_3_simplicity'] =
      serviceCount === 0 ? true : serviceCount <= 3 || hasJustification;
    if (serviceCount > 3 && !hasJustification) {
      warnings.push(
        `Architecture appears to define >3 services (${serviceCount}) without explicit justification (Article 3)`
      );
    }

    // Article 4: anti-abstraction (heuristic)
    const hasAbstractionJustification =
      /anti-abstraction|abstraction|why not|alternatives/i.test(dependencies);
    checks['article_4_anti_abstraction'] = hasAbstractionJustification;
    if (!hasAbstractionJustification) {
      warnings.push(
        'Dependencies document does not clearly justify abstraction layers (Article 4)'
      );
    }

    checks['articles_config_present'] = Object.keys(articles || {}).length > 0;

    return {
      status:
        errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateStackCompleteness(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const stackJsonRaw = this.getArtifactContent(
      project.id,
      'stack.json',
      'STACK_SELECTION'
    );
    let stackJson: Record<string, unknown> | null = null;
    if (stackJsonRaw) {
      try {
        stackJson = JSON.parse(stackJsonRaw) as Record<string, unknown>;
        checks['stack.json_valid'] = true;
      } catch {
        checks['stack.json_valid'] = false;
        errors.push('stack.json is not valid JSON');
      }
    } else {
      checks['stack.json_present'] = false;
      warnings.push('stack.json not found; cannot validate infra defaults');
    }

    const decision = this.getArtifactContent(
      project.id,
      'stack-decision.md',
      'STACK_SELECTION'
    );
    const rationale = this.getArtifactContent(
      project.id,
      'stack-rationale.md',
      'STACK_SELECTION'
    );

    if (!decision) {
      return {
        status: 'fail',
        checks: { 'stack-decision.md': false },
        errors: ['stack-decision.md not found'],
      };
    }

    const requiredLayers = [
      'Frontend',
      'Backend',
      'Database',
      'Deployment',
      'Mobile',
    ];
    for (const layer of requiredLayers) {
      const ok = new RegExp(`\\b${layer}\\b`, 'i').test(decision);
      checks[`layer:${layer}`] = ok;
      if (!ok) {
        warnings.push(
          `stack-decision.md does not clearly specify the ${layer} layer`
        );
      }
    }

    const hasCompositionTable = /\|\s*Layer\s*\|\s*Technology\s*\|/i.test(
      decision
    );
    checks['has_composition_table'] = hasCompositionTable;
    if (!hasCompositionTable) {
      warnings.push(
        'stack-decision.md does not include the expected Composition table'
      );
    }

    const hasDecisionMatrix =
      /Decision Matrix/i.test(rationale) ||
      /\|\s*Factor\s*\|\s*Weight\s*\|/i.test(rationale);
    checks['has_decision_matrix'] = hasDecisionMatrix;
    if (!hasDecisionMatrix) {
      warnings.push(
        'stack-rationale.md does not include a clear Decision Matrix'
      );
    }

    // Enforce default infra wiring for the default Next.js web template.
    if (stackJson) {
      const templateId = String(stackJson['template_id'] || '');
      const isDefaultNextWeb =
        templateId === 'nextjs_web_app' || templateId === 'nextjs_web_only';

      if (isDefaultNextWeb) {
        const database = (stackJson['database'] || {}) as Record<
          string,
          unknown
        >;
        const storage = (stackJson['storage'] || {}) as Record<string, unknown>;
        const auth = (stackJson['auth'] || {}) as Record<string, unknown>;

        const dbProvider = String(database['provider'] || '');
        const dbOrm = String(database['orm'] || '');
        const storageProvider = String(storage['provider'] || '');
        const authProvider = String(auth['provider'] || '');

        checks['default_web_db_provider_neon'] = /neon/i.test(dbProvider);
        checks['default_web_db_orm_drizzle'] = /drizzle/i.test(dbOrm);
        checks['default_web_storage_r2'] = /cloudflare\s*r2/i.test(
          storageProvider
        );
        checks['default_web_auth_better_auth'] = /better\s*auth/i.test(
          authProvider
        );

        if (!checks['default_web_db_provider_neon'])
          errors.push(
            `Default web stack must use Neon (stack.json database.provider: "${
              dbProvider || 'MISSING'
            }")`
          );
        if (!checks['default_web_db_orm_drizzle'])
          errors.push(
            `Default web stack must use Drizzle (stack.json database.orm: "${
              dbOrm || 'MISSING'
            }")`
          );
        if (!checks['default_web_storage_r2'])
          errors.push(
            `Default web stack must use Cloudflare R2 (stack.json storage.provider: "${
              storageProvider || 'MISSING'
            }")`
          );
        if (!checks['default_web_auth_better_auth'])
          errors.push(
            `Default web stack must use Better Auth (stack.json auth.provider: "${
              authProvider || 'MISSING'
            }")`
          );
      }
    }

    // Hard-fail only if we are missing the decision itself; the rest is warn-level to avoid false negatives.
    return {
      status:
        errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateJsonSchema(
    project: Project,
    artifactName: string,
    requiredFields: string[]
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const phasePath = `${project.project_path}/specs/${project.current_phase}/v1`;
    const artifactPath = resolve(phasePath, artifactName);

    if (!existsSync(artifactPath)) {
      return {
        status: 'fail',
        checks: { [artifactName]: false },
        errors: [`Required JSON artifact missing: ${artifactName}`],
      };
    }

    try {
      const raw = readFileSync(artifactPath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      checks[artifactName] = true;

      for (const field of requiredFields) {
        const ok = Object.prototype.hasOwnProperty.call(parsed, field);
        checks[`${artifactName}:${field}`] = ok;
        if (!ok) {
          errors.push(`${artifactName} missing required field: ${field}`);
        }
      }
    } catch (error) {
      return {
        status: 'fail',
        checks: { [artifactName]: false },
        errors: [
          `Failed to parse ${artifactName} as JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate if required files exist
   */
  private validateFilePresence(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // Get current phase and check required outputs
    const projectPath = project.project_path;
    const phasePath = `${projectPath}/specs/${project.current_phase}/v1`;

    const requiredFiles = this.getRequiredFilesForPhase(project.current_phase);

    for (const file of requiredFiles) {
      const filePath = resolve(phasePath, file);
      const exists = existsSync(filePath);
      checks[file] = exists;

      if (!exists) {
        errors.push(`Required file missing: ${file}`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate markdown frontmatter
   */
  private validateFrontmatter(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const warnings: string[] = [];

    const requiredFields = ['title', 'owner', 'version', 'date', 'status'];
    const markdownFiles = this.getMarkdownFilesForPhase(project.current_phase);

    for (const file of markdownFiles) {
      const content = this.getArtifactContent(project.id, file);
      const frontmatter = this.extractFrontmatter(content);

      checks[file] = true;

      for (const field of requiredFields) {
        if (!frontmatter || !frontmatter[field]) {
          errors.push(`${file} missing frontmatter field: ${field}`);
          checks[file] = false;
        }
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate content length
   */
  private validateContentLength(
    project: Project,
    minLength: number
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const files = this.getMarkdownFilesForPhase(project.current_phase);

    for (const file of files) {
      const content = this.getArtifactContent(project.id, file);
      const length = content.replace(/\s/g, '').length;

      checks[file] = length >= minLength;

      if (length < minLength) {
        errors.push(
          `${file} content too short: ${length} chars (min ${minLength})`
        );
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate content coverage
   */
  private validateCoverage(
    project: Project,
    requirements: Record<string, string>
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    for (const [file, requirement] of Object.entries(requirements)) {
      checks[file] = true;

      switch (requirement) {
        case 'at_least_5_requirements':
          const prdContent = this.getArtifactContent(project.id, 'PRD.md');
          const reqMatches = prdContent.match(/REQ-\w+-\d+/g) || [];
          if (reqMatches.length < 5) {
            errors.push(
              `${file} has only ${reqMatches.length} requirements (min 5)`
            );
            checks[file] = false;
          }
          break;

        case 'has_tables':
          const dataModelContent = this.getArtifactContent(
            project.id,
            'data-model.md'
          );
          if (
            !dataModelContent.includes('CREATE TABLE') &&
            !dataModelContent.includes('```sql')
          ) {
            errors.push(`${file} missing table definitions`);
            checks[file] = false;
          }
          break;

        case 'has_endpoints':
          const apiSpec = this.getArtifactContent(project.id, 'api-spec.json');
          try {
            const spec = JSON.parse(apiSpec);
            const endpoints = Object.keys(spec.paths || {});
            if (endpoints.length === 0) {
              errors.push(`${file} has no endpoints defined`);
              checks[file] = false;
            }
          } catch {
            errors.push(`${file} is not valid JSON`);
            checks[file] = false;
          }
          break;

        case 'at_least_10_tasks':
          const tasksContent = this.getArtifactContent(project.id, 'tasks.md');
          const taskMatches = tasksContent.match(/## Task \d+\.\d+/g) || [];
          if (taskMatches.length < 10) {
            errors.push(
              `${file} has only ${taskMatches.length} tasks (min 10)`
            );
            checks[file] = false;
          }
          break;
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate OpenAPI specification
   */
  private validateOpenAPI(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    try {
      const apiSpec = JSON.parse(
        this.getArtifactContent(project.id, 'api-spec.json')
      );

      checks['has_openapi_version'] = !!(
        apiSpec.openapi && apiSpec.openapi.startsWith('3.')
      );
      checks['has_info'] = !!apiSpec.info;
      checks['has_paths'] = !!(
        apiSpec.paths && Object.keys(apiSpec.paths).length > 0
      );

      if (!checks['has_openapi_version']) {
        errors.push('Missing or invalid OpenAPI version');
      }
      if (!checks['has_info']) {
        errors.push('Missing API info section');
      }
      if (!checks['has_paths']) {
        errors.push('No API paths defined');
      }
    } catch (error) {
      errors.push(`Invalid JSON in api-spec.json: ${error}`);
      checks['valid_json'] = false;
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate database field
   */
  private validateDatabaseField(
    project: Project,
    field: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expectedValue: any
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actualValue = (project as any)[field];
    checks[field] = actualValue === expectedValue;

    if (actualValue !== expectedValue) {
      errors.push(`${field} is ${actualValue} (expected ${expectedValue})`);
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate scripts (npm audit, pip-audit, etc.)
   */
  private validateScripts(
    project: Project,
    scripts: string[]
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const script of scripts) {
      if (script === 'npm_audit') {
        const npmResult = this.runNpmAudit(project.id);
        checks['npm_audit'] = npmResult.passed;

        if (!npmResult.passed) {
          errors.push(`npm audit found vulnerabilities: ${npmResult.message}`);
        }
        if (npmResult.warnings) {
          warnings.push(...npmResult.warnings);
        }
      } else if (script === 'pip_audit') {
        const pipResult = this.runPipAudit(project.id);
        checks['pip_audit'] = pipResult.passed;

        if (!pipResult.passed) {
          errors.push(`pip-audit found vulnerabilities: ${pipResult.message}`);
        }
        if (pipResult.warnings) {
          warnings.push(...pipResult.warnings);
        }
      }
    }

    return {
      status:
        errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Run npm audit and check for HIGH/CRITICAL vulnerabilities
   */
  private runNpmAudit(projectId: string): {
    passed: boolean;
    message: string;
    warnings?: string[];
  } {
    try {
      const projectPath = resolve(this.projectsBasePath, projectId);

      // Check if package.json exists
      if (!existsSync(resolve(projectPath, 'package.json'))) {
        return {
          passed: true,
          message: 'No package.json found - npm audit skipped',
          warnings: ['npm audit skipped: no package.json'],
        };
      }

      // Run npm audit with JSON output
      let auditOutput: string;
      try {
        auditOutput = execSync('npm audit --json', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // npm audit exits with non-zero code when vulnerabilities are found
        // The output is still in error.stdout
        auditOutput = error.stdout || '';
      }

      // Parse audit results
      try {
        const auditData = JSON.parse(auditOutput);

        // Check for metadata
        const metadata = auditData.metadata || {};
        const vulnerabilities = auditData.vulnerabilities || {};

        // Count HIGH and CRITICAL vulnerabilities
        let criticalCount = 0;
        let highCount = 0;
        const vulnerablePackages: string[] = [];

        for (const [pkgName, vulnData] of Object.entries(vulnerabilities)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vuln = vulnData as any;
          if (vuln.severity === 'critical') {
            criticalCount++;
            vulnerablePackages.push(`${pkgName} (CRITICAL)`);
          } else if (vuln.severity === 'high') {
            highCount++;
            vulnerablePackages.push(`${pkgName} (HIGH)`);
          }
        }

        if (criticalCount > 0 || highCount > 0) {
          return {
            passed: false,
            message: `Found ${criticalCount} CRITICAL and ${highCount} HIGH vulnerabilities`,
            warnings: vulnerablePackages.slice(0, 5), // Limit to first 5
          };
        }

        return {
          passed: true,
          message: 'npm audit passed - no HIGH/CRITICAL vulnerabilities',
          warnings: metadata.vulnerabilities
            ? [
                `Found ${metadata.vulnerabilities} total vulnerabilities (all LOW/MODERATE)`,
              ]
            : undefined,
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (parseError) {
        // If JSON parsing fails, fallback to string parsing
        if (auditOutput.includes('CRITICAL') || auditOutput.includes('high')) {
          return {
            passed: false,
            message: 'npm audit found HIGH or CRITICAL vulnerabilities',
          };
        }
        return {
          passed: true,
          message: 'npm audit passed',
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `npm audit execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Run pip-audit and check for HIGH/CRITICAL vulnerabilities
   */
  private runPipAudit(projectId: string): {
    passed: boolean;
    message: string;
    warnings?: string[];
  } {
    try {
      const projectPath = resolve(this.projectsBasePath, projectId);

      // Check if requirements.txt or setup.py exists
      const hasRequirements = existsSync(
        resolve(projectPath, 'requirements.txt')
      );
      const hasSetupPy = existsSync(resolve(projectPath, 'setup.py'));

      if (!hasRequirements && !hasSetupPy) {
        return {
          passed: true,
          message: 'No Python dependencies found - pip-audit skipped',
          warnings: ['pip-audit skipped: no requirements.txt or setup.py'],
        };
      }

      // Run pip-audit with JSON output
      let auditOutput: string;
      try {
        auditOutput = execSync('pip-audit --format json', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // pip-audit may exit with non-zero code when vulnerabilities are found
        auditOutput = error.stdout || '';
      }

      // Parse audit results
      try {
        const auditData = JSON.parse(auditOutput);
        const vulnerabilities = auditData.vulnerabilities || [];

        // Check for HIGH and CRITICAL severities
        let criticalCount = 0;
        let highCount = 0;
        const vulnerablePackages: string[] = [];

        for (const vuln of vulnerabilities) {
          const severity = vuln.fix_available ? 'MEDIUM' : 'HIGH'; // pip-audit uses different severity system

          // Check if vulnerability description contains CRITICAL
          if (
            vuln.description?.toUpperCase().includes('CRITICAL') ||
            vuln.vulnerability_id?.includes('CRITICAL')
          ) {
            criticalCount++;
            vulnerablePackages.push(`${vuln.name} (${vuln.vulnerability_id})`);
          } else if (severity === 'HIGH') {
            highCount++;
            vulnerablePackages.push(`${vuln.name} (${vuln.vulnerability_id})`);
          }
        }

        if (criticalCount > 0 || highCount > 0) {
          return {
            passed: false,
            message: `Found ${criticalCount} CRITICAL and ${highCount} HIGH vulnerabilities`,
            warnings: vulnerablePackages.slice(0, 5), // Limit to first 5
          };
        }

        return {
          passed: true,
          message: 'pip-audit passed - no HIGH/CRITICAL vulnerabilities',
          warnings:
            vulnerabilities.length > 0
              ? [`Found ${vulnerabilities.length} LOW/MODERATE vulnerabilities`]
              : undefined,
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (parseError) {
        // If JSON parsing fails, fallback to string parsing
        if (
          auditOutput.toUpperCase().includes('CRITICAL') ||
          auditOutput.toUpperCase().includes('HIGH')
        ) {
          return {
            passed: false,
            message: 'pip-audit found HIGH or CRITICAL vulnerabilities',
          };
        }
        return {
          passed: true,
          message: 'pip-audit passed',
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `pip-audit execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Validate task dependencies - check for circular references in task DAG
   */
  private validateTaskDependencies(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Read tasks.md artifact
      const tasksContent = this.getArtifactContent(
        project.id,
        'tasks.md',
        'SOLUTIONING'
      );

      if (!tasksContent) {
        warnings.push(
          'tasks.md not found - skipping task dependency validation'
        );
        checks['no_circular_deps'] = true;
        return {
          status: 'warn',
          checks,
          warnings,
        };
      }

      // Parse task dependencies from markdown
      const taskDependencies = this.parseTaskDependencies(tasksContent);

      if (Object.keys(taskDependencies).length === 0) {
        checks['no_circular_deps'] = true;
        warnings.push('No task dependencies found in tasks.md');
        return {
          status: 'warn',
          checks,
          warnings,
        };
      }

      // Detect circular dependencies using DFS
      const circularDeps = this.detectCircularDependencies(taskDependencies);

      if (circularDeps.length > 0) {
        checks['no_circular_deps'] = false;
        for (const cycle of circularDeps) {
          errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
        }
        return {
          status: 'fail',
          checks,
          errors,
        };
      }

      // Validate DAG structure
      checks['no_circular_deps'] = true;
      checks['valid_dag'] = true;
      const stats = this.validateDAGStructure(taskDependencies);

      if (stats.orphanedTasks.length > 0) {
        warnings.push(
          `Found ${
            stats.orphanedTasks.length
          } orphaned tasks: ${stats.orphanedTasks.join(', ')}`
        );
      }

      if (stats.deepestPath > 10) {
        warnings.push(
          `Task dependency depth is ${stats.deepestPath} (consider breaking into smaller epics)`
        );
      }

      return {
        status: warnings.length > 0 ? 'warn' : 'pass',
        checks,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: { no_circular_deps: false },
        errors: [
          `Failed to validate task dependencies: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  /**
   * Parse task dependencies from tasks.md markdown content
   */
  private parseTaskDependencies(
    tasksContent: string
  ): Record<string, string[]> {
    const dependencies: Record<string, string[]> = {};

    // Match task entries with IDs and dependencies
    // Expected format: ## TASK-001: Task Name\nDepends on: T-002, T-003
    // Use [\s\S]*? to match across lines until next task header or end
    const taskRegex = /#{1,3}\s+([T\w-]+):\s*([\s\S]*?)(?=#{1,3}\s+[T\w-]+:|$)/g;
    let match;

    while ((match = taskRegex.exec(tasksContent)) !== null) {
      const taskId = match[1].trim();
      const taskBlock = match[2].trim();

      // Find dependencies section - handle various formats
      const depsRegex = /(?:depends\s+on|dependencies?)[:\s]+([^\n]+)/i;
      const depsMatch = depsRegex.exec(taskBlock);

      if (depsMatch) {
        const depsText = depsMatch[1];
        // Extract task IDs from comma/space-separated list
        const depIds = depsText
          .split(/[,;\s]+/)
          .map((id) => id.trim())
          .filter((id) => id.match(/^[T\w-]+$/i));

        dependencies[taskId] = depIds;
      } else {
        dependencies[taskId] = [];
      }
    }

    // Fallback parser for simple "## Task" blocks with depends_on: [Task A]
    if (Object.keys(dependencies).length === 0) {
      const simpleTaskRegex =
        /##\s*(.+?)\s*\n[\s\S]*?-+\s*depends_on:\s*\[([^\]]*)\]/gi;
      let simpleMatch;
      while ((simpleMatch = simpleTaskRegex.exec(tasksContent)) !== null) {
        const taskName = simpleMatch[1].trim();
        const deps = simpleMatch[2]
          .split(',')
          .map((dep) => dep.replace(/[\[\]]/g, '').trim())
          .filter(Boolean);
        dependencies[taskName] = deps;
      }
    }

    return dependencies;
  }

  /**
   * Detect circular dependencies using depth-first search
   */
  private detectCircularDependencies(
    dependencies: Record<string, string[]>
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string) => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const deps = dependencies[taskId] || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          // Found a cycle - extract the cycle path
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart).concat([dep]);
          cycles.push(cycle);
        }
      }

      recursionStack.delete(taskId);
      path.pop();
    };

    // Run DFS from each unvisited node
    for (const taskId of Object.keys(dependencies)) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  /**
   * Validate overall DAG structure and return statistics
   */
  private validateDAGStructure(dependencies: Record<string, string[]>): {
    orphanedTasks: string[];
    deepestPath: number;
  } {
    const allTasks = new Set(Object.keys(dependencies));
    const tasksWithIncoming = new Set<string>();
    const maxDepth: Record<string, number> = {};

    // Find tasks with incoming edges
    for (const deps of Object.values(dependencies)) {
      deps.forEach((dep) => tasksWithIncoming.add(dep));
    }

    // Find orphaned tasks (no incoming edges, no outgoing edges)
    const orphanedTasks = Array.from(allTasks).filter(
      (task) =>
        !tasksWithIncoming.has(task) && (dependencies[task]?.length || 0) === 0
    );

    // Calculate deepest path using memoization
    const calculateDepth = (
      taskId: string,
      visited = new Set<string>()
    ): number => {
      if (maxDepth[taskId] !== undefined) {
        return maxDepth[taskId];
      }

      if (visited.has(taskId)) {
        return 0; // Avoid infinite recursion in case of cycles (shouldn't happen)
      }

      visited.add(taskId);
      const deps = dependencies[taskId] || [];
      const childDepths = deps.map((dep) =>
        calculateDepth(dep, new Set(visited))
      );
      const depth = childDepths.length > 0 ? 1 + Math.max(...childDepths) : 1;

      maxDepth[taskId] = depth;
      return depth;
    };

    let deepestPath = 0;
    for (const taskId of allTasks) {
      deepestPath = Math.max(deepestPath, calculateDepth(taskId));
    }

    return {
      orphanedTasks,
      deepestPath,
    };
  }

  /**
   * Validate handoff document
   */
  private validateHandoff(
    project: Project,
    requiredSections: string[]
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const handoffContent = this.getArtifactContent(project.id, 'HANDOFF.md');

    for (const section of requiredSections) {
      const hasSection =
        handoffContent.includes(section) ||
        handoffContent.toLowerCase().includes(section.toLowerCase());
      checks[section] = hasSection;

      if (!hasSection) {
        errors.push(`HANDOFF.md missing section: ${section}`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate ZIP file (placeholder)
   */
  private validateZip(
    project: Project,
    requiredFiles: string[]
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const warnings: string[] = [];

    for (const file of requiredFiles) {
      checks[file] = true; // Placeholder - would check ZIP contents
      warnings.push(`ZIP validation not implemented for: ${file}`);
    }

    return {
      status: warnings.length > 0 ? 'warn' : 'pass',
      checks,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate requirements follow REQ-XXX-YYY format
   */
  private validateRequirementFormat(
    project: Project,
    pattern: string,
    minCount: number
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const prdContent =
        this.getArtifactContent(project.id, 'PRD.md', 'SPEC_PM') ||
        this.getArtifactContent(project.id, 'PRD.md', 'SPEC'); // Legacy fallback

      if (!prdContent) {
        return {
          status: 'warn',
          checks: { prd_exists: false },
          warnings: [
            'PRD.md not found - skipping requirement format validation',
          ],
        };
      }

      // Use the pattern from the validator config or default
      const regex = new RegExp(pattern || 'REQ-[A-Z]+-\\d{3}', 'g');
      const matches = prdContent.match(regex) || [];
      const uniqueReqs = Array.from(new Set(matches));

      checks['has_requirements'] = uniqueReqs.length > 0;
      checks['meets_minimum'] = uniqueReqs.length >= (minCount || 15);
      checks['valid_format'] = true;

      if (uniqueReqs.length < (minCount || 15)) {
        errors.push(
          `Found only ${uniqueReqs.length} requirements (minimum: ${
            minCount || 15
          })`
        );
      }

      // Check for proper categories
      const validCategories = [
        'AUTH',
        'USER',
        'CRUD',
        'PAYMENT',
        'NOTIF',
        'REPORT',
        'ADMIN',
        'INTEG',
        'SEARCH',
        'MEDIA',
      ];
      const invalidReqs = uniqueReqs.filter((req) => {
        const category = req.split('-')[1];
        return !validCategories.includes(category);
      });

      if (invalidReqs.length > 0) {
        warnings.push(
          `Found requirements with non-standard categories: ${invalidReqs
            .slice(0, 5)
            .join(', ')}`
        );
      }

      return {
        status:
          errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
        checks,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: {},
        errors: [
          `Failed to validate requirement format: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  /**
   * Validate requirement traceability - all PRD requirements covered by tasks
   */
  private validateRequirementTraceability(
    project: Project,
    sourceArtifact: string,
    targetArtifact: string
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const prdContent = this.getArtifactContent(
        project.id,
        sourceArtifact || 'PRD.md',
        'SPEC'
      );
      const tasksContent = this.getArtifactContent(
        project.id,
        targetArtifact || 'tasks.md',
        'SOLUTIONING'
      );

      if (!prdContent || !tasksContent) {
        return {
          status: 'warn',
          checks: {},
          warnings: [
            'PRD.md or tasks.md not found - skipping traceability validation',
          ],
        };
      }

      // Extract requirements from PRD
      const reqRegex = /REQ-[A-Z]+-\d{3}/g;
      const prdReqs = Array.from(new Set(prdContent.match(reqRegex) || []));
      const taskReqs = Array.from(new Set(tasksContent.match(reqRegex) || []));

      // Find uncovered requirements
      const uncoveredReqs = prdReqs.filter((req) => !taskReqs.includes(req));

      checks['all_requirements_covered'] = uncoveredReqs.length === 0;
      checks['prd_requirements_count'] = prdReqs.length > 0;
      checks['tasks_reference_requirements'] = taskReqs.length > 0;

      if (uncoveredReqs.length > 0) {
        const mvpUncovered = uncoveredReqs.filter((req) => {
          // Check if this is an MVP requirement by looking at context in PRD
          const reqIndex = prdContent.indexOf(req);
          if (reqIndex === -1) return false;
          const contextStart = Math.max(0, reqIndex - 200);
          const contextEnd = Math.min(prdContent.length, reqIndex + 200);
          const context = prdContent.slice(contextStart, contextEnd);
          return (
            context.toLowerCase().includes('mvp') ||
            context.toLowerCase().includes('phase 1')
          );
        });

        if (mvpUncovered.length > 0) {
          errors.push(
            `${
              mvpUncovered.length
            } MVP requirements not covered by tasks: ${mvpUncovered
              .slice(0, 5)
              .join(', ')}`
          );
        } else {
          warnings.push(
            `${
              uncoveredReqs.length
            } Phase 2+ requirements not covered by tasks: ${uncoveredReqs
              .slice(0, 5)
              .join(', ')}`
          );
        }
      }

      return {
        status:
          errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
        checks,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: {},
        errors: [
          `Failed to validate requirement traceability: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  /**
   * Validate API endpoint coverage - all endpoints have tasks
   */
  private validateAPIEndpointCoverage(
    project: Project,
    sourceArtifact: string,
    targetArtifact: string
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const apiSpecContent = this.getArtifactContent(
        project.id,
        sourceArtifact || 'api-spec.json',
        'SPEC'
      );
      const tasksContent = this.getArtifactContent(
        project.id,
        targetArtifact || 'tasks.md',
        'SOLUTIONING'
      );

      if (!apiSpecContent || !tasksContent) {
        return {
          status: 'warn',
          checks: {},
          warnings: [
            'api-spec.json or tasks.md not found - skipping API coverage validation',
          ],
        };
      }

      // Parse API spec to extract endpoints
      let apiSpec;
      try {
        apiSpec = JSON.parse(apiSpecContent);
      } catch {
        return {
          status: 'warn',
          checks: { valid_json: false },
          warnings: [
            'api-spec.json is not valid JSON - skipping API coverage validation',
          ],
        };
      }

      const endpoints: string[] = [];
      for (const [path, methods] of Object.entries(apiSpec.paths || {})) {
        for (const method of Object.keys(methods as object)) {
          if (
            ['get', 'post', 'put', 'patch', 'delete'].includes(
              method.toLowerCase()
            )
          ) {
            endpoints.push(`${method.toUpperCase()} ${path}`);
          }
        }
      }

      // Check which endpoints are mentioned in tasks
      const tasksLower = tasksContent.toLowerCase();
      const uncoveredEndpoints = endpoints.filter((endpoint) => {
        const [method, path] = endpoint.split(' ');
        // Check if endpoint path or method+path is mentioned
        return (
          !tasksLower.includes(path.toLowerCase()) &&
          !tasksLower.includes(endpoint.toLowerCase())
        );
      });

      checks['has_endpoints'] = endpoints.length > 0;
      checks['endpoints_covered'] = uncoveredEndpoints.length === 0;

      if (uncoveredEndpoints.length > 0) {
        warnings.push(
          `${
            uncoveredEndpoints.length
          } API endpoints not explicitly referenced in tasks: ${uncoveredEndpoints
            .slice(0, 5)
            .join(', ')}`
        );
      }

      return {
        status:
          errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
        checks,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: {},
        errors: [
          `Failed to validate API endpoint coverage: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  /**
   * Validate cross-artifact consistency
   */
  private validateCrossArtifactConsistency(
    project: Project,
    checksConfig: string[]
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Load all relevant artifacts
      const personasContent = this.getArtifactContent(
        project.id,
        'personas.md',
        'ANALYSIS'
      );
      const prdContent = this.getArtifactContent(project.id, 'PRD.md', 'SPEC');
      const tasksContent = this.getArtifactContent(
        project.id,
        'tasks.md',
        'SOLUTIONING'
      );
      const epicsContent = this.getArtifactContent(
        project.id,
        'epics.md',
        'SOLUTIONING'
      );
      const architectureContent = this.getArtifactContent(
        project.id,
        'architecture.md',
        'SOLUTIONING'
      );

      for (const checkName of checksConfig || []) {
        if (checkName.includes('personas in PRD exist in personas.md')) {
          // Extract persona names from both documents
          const personaNameRegex =
            /##\s*(?:Persona\s*\d+:?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
          const personasMatches = Array.from(
            personasContent.matchAll(personaNameRegex) || []
          );
          const personaNames = personasMatches
            .map((m) => m[1]?.toLowerCase())
            .filter(Boolean);

          // Check if PRD references personas not in personas.md
          const prdPersonaRefs =
            prdContent.match(
              /(?:persona|user|as a)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
            ) || [];
          const unknownPersonas = prdPersonaRefs.filter((ref) => {
            const name = ref
              .replace(/(?:persona|user|as a)\s*:?\s*/i, '')
              .toLowerCase();
            return (
              name.length > 2 &&
              !personaNames.some((p) => name.includes(p) || p.includes(name))
            );
          });

          checks['personas_consistent'] = unknownPersonas.length < 3; // Allow some flexibility
          if (unknownPersonas.length >= 3) {
            warnings.push(
              `PRD references personas not clearly defined in personas.md`
            );
          }
        }

        if (checkName.includes('REQ-IDs in tasks.md exist in PRD.md')) {
          const prdReqs = Array.from(
            new Set(prdContent.match(/REQ-[A-Z]+-\d{3}/g) || [])
          );
          const taskReqs = Array.from(
            new Set(tasksContent.match(/REQ-[A-Z]+-\d{3}/g) || [])
          );

          const orphanedTaskReqs = taskReqs.filter(
            (req) => !prdReqs.includes(req)
          );
          checks['task_reqs_valid'] = orphanedTaskReqs.length === 0;

          if (orphanedTaskReqs.length > 0) {
            errors.push(
              `Tasks reference non-existent requirements: ${orphanedTaskReqs
                .slice(0, 5)
                .join(', ')}`
            );
          }
        }

        if (checkName.includes('EPIC-IDs in tasks.md exist in epics.md')) {
          const epicIds = Array.from(
            new Set(epicsContent.match(/EPIC-\d{3}/g) || [])
          );
          const taskEpicRefs = Array.from(
            new Set(tasksContent.match(/EPIC-\d{3}/g) || [])
          );

          const orphanedEpicRefs = taskEpicRefs.filter(
            (epic) => !epicIds.includes(epic)
          );
          checks['task_epics_valid'] = orphanedEpicRefs.length === 0;

          if (orphanedEpicRefs.length > 0) {
            errors.push(
              `Tasks reference non-existent epics: ${orphanedEpicRefs.join(
                ', '
              )}`
            );
          }
        }

        if (
          checkName.includes(
            'Stack choice in architecture.md matches approved stack'
          )
        ) {
          const approvedStack = project.stack_choice;
          if (approvedStack && architectureContent) {
            const stackMentioned =
              architectureContent
                .toLowerCase()
                .includes(approvedStack.toLowerCase().replace(/_/g, ' ')) ||
              architectureContent
                .toLowerCase()
                .includes(approvedStack.toLowerCase());
            checks['stack_consistent'] = stackMentioned;

            if (!stackMentioned) {
              warnings.push(
                `Architecture document may not reflect approved stack: ${approvedStack}`
              );
            }
          }
        }
      }

      return {
        status:
          errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
        checks,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: {},
        errors: [
          `Failed to validate cross-artifact consistency: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  /**
   * Validate artifact quality score
   */
  private validateQualityScore(
    project: Project,
    criteria: Record<string, number>,
    minimumScore: number
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      let totalScore = 0;
      let maxScore = 0;
      const scoreBreakdown: Record<string, number> = {};

      const artifacts = [
        { name: 'constitution.md', phase: 'ANALYSIS' },
        { name: 'project-brief.md', phase: 'ANALYSIS' },
        { name: 'personas.md', phase: 'ANALYSIS' },
        { name: 'PRD.md', phase: 'SPEC' },
        { name: 'data-model.md', phase: 'SPEC' },
        { name: 'architecture.md', phase: 'SOLUTIONING' },
        { name: 'tasks.md', phase: 'SOLUTIONING' },
        { name: 'epics.md', phase: 'SOLUTIONING' },
      ];

      for (const artifact of artifacts) {
        const content = this.getArtifactContent(
          project.id,
          artifact.name,
          artifact.phase
        );
        if (!content) continue;

        let artifactScore = 0;
        const artifactMax = Object.values(criteria || {}).reduce(
          (a, b) => a + b,
          0
        );

        // frontmatter_complete (check for YAML frontmatter)
        if (criteria?.frontmatter_complete) {
          const hasFrontmatter =
            content.startsWith('---') && content.includes('---\n', 4);
          if (hasFrontmatter) {
            const frontmatter = this.extractFrontmatter(content);
            const requiredFields = [
              'title',
              'owner',
              'version',
              'date',
              'status',
            ];
            const hasAllFields =
              frontmatter && requiredFields.every((f) => frontmatter[f]);
            artifactScore += hasAllFields
              ? criteria.frontmatter_complete
              : criteria.frontmatter_complete / 2;
          }
        }

        // min_content_length (check minimum content length)
        if (criteria?.min_content_length) {
          const contentWithoutFrontmatter = content.replace(
            /^---[\s\S]*?---\n/,
            ''
          );
          const wordCount = contentWithoutFrontmatter
            .split(/\s+/)
            .filter(Boolean).length;
          if (wordCount >= 500) {
            artifactScore += criteria.min_content_length;
          } else if (wordCount >= 200) {
            artifactScore += criteria.min_content_length / 2;
          }
        }

        // structured_sections (check for proper section headers)
        if (criteria?.structured_sections) {
          const sectionHeaders = content.match(/^#{1,3}\s+.+$/gm) || [];
          if (sectionHeaders.length >= 5) {
            artifactScore += criteria.structured_sections;
          } else if (sectionHeaders.length >= 3) {
            artifactScore += criteria.structured_sections / 2;
          }
        }

        // actionable_criteria (check for actionable content like acceptance criteria)
        if (criteria?.actionable_criteria) {
          const hasGherkin =
            content.includes('GIVEN') &&
            content.includes('WHEN') &&
            content.includes('THEN');
          const hasCheckboxes = (content.match(/- \[ \]/g) || []).length >= 3;
          const hasRequirements =
            (content.match(/REQ-[A-Z]+-\d{3}/g) || []).length >= 3;

          if (hasGherkin || hasCheckboxes || hasRequirements) {
            artifactScore += criteria.actionable_criteria;
          } else if (
            content.includes('acceptance') ||
            content.includes('criteria')
          ) {
            artifactScore += criteria.actionable_criteria / 2;
          }
        }

        scoreBreakdown[artifact.name] = Math.round(
          (artifactScore / artifactMax) * 100
        );
        totalScore += artifactScore;
        maxScore += artifactMax;
      }

      const finalScore =
        maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      checks['quality_score'] = finalScore >= (minimumScore || 70);
      checks['score_value'] = finalScore as unknown as boolean; // Store score for reporting

      if (finalScore < (minimumScore || 70)) {
        errors.push(
          `Quality score ${finalScore}/100 is below minimum ${
            minimumScore || 70
          }`
        );
      } else if (finalScore < 85) {
        warnings.push(`Quality score ${finalScore}/100 could be improved`);
      }

      return {
        status:
          errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
        checks: { ...checks, ...scoreBreakdown },
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: {},
        errors: [
          `Failed to calculate quality score: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  // Helper methods
  private getRequiredFilesForPhase(phase: string): string[] {
    const phaseFiles: Record<string, string[]> = {
      // 12-phase system
      ANALYSIS: [
        'constitution.md',
        'project-brief.md',
        'project-classification.json',
        'personas.md',
      ],
      STACK_SELECTION: [
        'stack-analysis.md',
        'stack-decision.md',
        'stack-rationale.md',
        'stack.json',
      ],
      SPEC_PM: ['PRD.md'],
      SPEC_ARCHITECT: ['data-model.md', 'api-spec.json'],
      SPEC_DESIGN_TOKENS: ['design-tokens.md'],
      SPEC_DESIGN_COMPONENTS: ['component-mapping.md', 'journey-maps.md'],
      FRONTEND_BUILD: [], // Generates code files, not spec artifacts
      DEPENDENCIES: ['DEPENDENCIES.md', 'dependencies.json'],
      SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
      VALIDATE: ['validation-report.md', 'coverage-matrix.md'],
      AUTO_REMEDY: ['auto-remedy-report.md'],
      DONE: ['HANDOFF.md'],
      // Legacy fallback for existing projects
      SPEC: [
        'PRD.md',
        'data-model.md',
        'api-spec.json',
        'design-system.md',
        'component-inventory.md',
        'user-flows.md',
      ],
    };

    return phaseFiles[phase] || [];
  }

  // ============================================================================
  // QUALITY CHECKLIST VALIDATORS (Phases 1, 3, 6, 9)
  // These validators enforce blocking quality checks as defined in orchestrator_spec.yml
  // ============================================================================

  /**
   * PHASE 1 (ANALYSIS) - validateAnalysisQuality
   * Validates the ANALYSIS phase quality checklist:
   * - 3-5 distinct personas exist in personas.md
   * - Constitution quality checks
   * - All 4 required files exist (constitution.md, project-brief.md, project-classification.json, personas.md)
   * - Personas are specific (not generic like "developer", "user")
   */
  public validateAnalysisQuality(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    // Check 1: File presence - must match orchestrator_spec.yml ANALYSIS outputs
    const requiredFiles = [
      'constitution.md',
      'project-brief.md',
      'project-classification.json',
      'personas.md',
    ];

    for (const file of requiredFiles) {
      if (!artifacts[file] || artifacts[file].length === 0) {
        issues.push({
          severity: 'error',
          category: 'missing_file',
          message: `Required file missing or empty: ${file}`,
        });
      }
    }

    // Check 2: Persona count (3-5 distinct personas)
    const personasContent = artifacts['personas.md'] || '';
    if (personasContent) {
      // Extract persona names from markdown headers
      const personaMatches = personasContent.match(/^##?\s+(?:Persona\s*:?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gm) || [];
      // Also try YAML frontmatter if present
      const frontmatterPersonas = personasContent.match(/^-?\s*name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gim) || [];

      const totalPersonas = new Set([...personaMatches.map(p => p.replace(/^##?\s+(?:Persona\s*:?\s*)?/i, '')), ...frontmatterPersonas.map(p => p.replace(/^-?\s*name:\s*/i, ''))]);

      if (totalPersonas.size < 3) {
        issues.push({
          severity: 'error',
          category: 'persona_count',
          message: `Only ${totalPersonas.size} personas found. Minimum: 3`,
        });
      } else if (totalPersonas.size > 5) {
        issues.push({
          severity: 'warning',
          category: 'persona_count',
          message: `${totalPersonas.size} personas found. Consider consolidating (max 5 recommended)`,
        });
      }
    }

    // Check 3: Persona specificity (not generic)
    const genericPersonas = ['developer', 'user', 'admin', 'customer', 'visitor', 'guest', 'member'];
    const personaContent = artifacts['personas.md'] || '';
    for (const generic of genericPersonas) {
      // Check if a persona is named exactly "User", "Developer", etc. without specific modifiers
      const genericHeaderRegex = new RegExp(`^##?\\s+${generic}$`, 'im');
      if (genericHeaderRegex.test(personaContent)) {
        issues.push({
          severity: 'warning',
          category: 'persona_specificity',
          message: `Generic persona found: "${generic}". Consider using a more specific name like "Senior Developer" or "Power User"`,
        });
      }
    }

    // Check 4: Constitution principles (now in constitution.md instead of guiding-principles.md)
    const constitutionContent = artifacts['constitution.md'] || '';
    if (constitutionContent) {
      // Count principles by looking for numbered lists, bullet points with headers, or section headers
      const principlePatterns = [
        /\d+\.\s+\*\*[^*]+\*\*/g,  // 1. **Principle Name**
        /##?\s+[Pp]rinciple/g,     // ## Principle or # Principle
        /^\s*[-*]\s+\*\*[^*]+\*\*/gm, // - **Principle**
      ];
      
      let totalPrinciples = 0;
      for (const pattern of principlePatterns) {
        const matches = constitutionContent.match(pattern) || [];
        totalPrinciples = Math.max(totalPrinciples, matches.length);
      }
      
      if (totalPrinciples < 5) {
        issues.push({
          severity: 'error',
          category: 'principles_count',
          message: `Only ${totalPrinciples} guiding principles found. Minimum: 5`,
        });
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * PHASE 3 (SPEC_PM) - validatePMSpecQuality
   * Validates the SPEC_PM phase quality checklist:
   * - PRD.md has 15+ requirements (REQ-XXX format)
   * - Each REQ-XXX references a persona by name
   * - Acceptance criteria have Given/When/Then format (Gherkin)
   * - All artifacts present (PRD.md, user-stories.md, acceptance-criteria.md)
   */
  public validatePMSpecQuality(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    // Check 1: Required artifacts presence
    const requiredFiles = ['PRD.md', 'user-stories.md', 'acceptance-criteria.md'];
    for (const file of requiredFiles) {
      if (!artifacts[file] || artifacts[file].length === 0) {
        issues.push({
          severity: 'error',
          category: 'missing_file',
          message: `Required file missing or empty: ${file}`,
        });
      }
    }

    const prdContent = artifacts['PRD.md'] || '';
    const userStoriesContent = artifacts['user-stories.md'] || '';
    const acceptanceCriteriaContent = artifacts['acceptance-criteria.md'] || '';

    // Check 2: REQ-XXX count (15+)
    if (prdContent) {
      // Match REQ-XXX or REQ-CATEGORY-XXX format
      // Use separate patterns to avoid regex overlap issues
      const reqMatches = prdContent.match(/REQ-[A-Z0-9]+/g) || [];
      const uniqueReqs = Array.from(new Set(reqMatches));

      if (uniqueReqs.length < 15) {
        issues.push({
          severity: 'error',
          category: 'requirement_count',
          message: `Only ${uniqueReqs.length} requirements found (REQ-XXX format). Minimum: 15`,
        });
      }
    }

    // Check 3: Each REQ-XXX references a persona
    if (prdContent) {
      const reqMatches = prdContent.match(/REQ-[A-Z]+-\d{3}/g) || [];
      const uniqueReqs = [...new Set(reqMatches)];
      
      // Extract persona names from PRD or personas file
      const personaNames = artifacts['personas.md']
        ? this.extractPersonaNames(artifacts['personas.md'])
        : [];
      
      // Common persona patterns to look for in PRD
      const commonPersonas = ['Admin', 'User', 'Developer', 'Manager', 'Customer'];
      const allPersonas = [...new Set([...personaNames, ...commonPersonas])];

      const reqsWithoutPersona: string[] = [];
      for (const req of uniqueReqs) {
        // Find context around the requirement
        const reqIndex = prdContent.indexOf(req);
        if (reqIndex === -1) continue;
        
        const contextEnd = Math.min(prdContent.length, reqIndex + 400);
        const context = prdContent.slice(reqIndex, contextEnd);
        
        // Check if any persona is mentioned in the context
        const hasPersonaRef = allPersonas.some(p => 
          new RegExp(`\\b${p}\\b`, 'i').test(context)
        );
        
        if (!hasPersonaRef) {
          reqsWithoutPersona.push(req);
        }
      }

      if (reqsWithoutPersona.length > 0) {
        issues.push({
          severity: 'warning',
          category: 'requirement_persona_reference',
          message: `${reqsWithoutPersona.length} requirements may not reference a persona: ${reqsWithoutPersona.slice(0, 3).join(', ')}`,
        });
      }
    }

    // Check 4: Gherkin format (Given/When/Then) in acceptance criteria
    if (acceptanceCriteriaContent) {
      const hasGherkin = /GIVEN\s+/i.test(acceptanceCriteriaContent) &&
                        /WHEN\s+/i.test(acceptanceCriteriaContent) &&
                        /THEN\s+/i.test(acceptanceCriteriaContent);
      
      if (!hasGherkin) {
        issues.push({
          severity: 'warning',
          category: 'gherkin_format',
          message: 'Acceptance criteria may not follow Gherkin format (GIVEN/WHEN/THEN)',
        });
      }
    }

    // Check 5: User stories have proper format (As a..., I want..., So that...)
    if (userStoriesContent) {
      const storyPattern = /As\s+a\s+\w+/i;
      const wantPattern = /I\s+want\s+to?/i;
      const soThatPattern = /so\s+that/i;
      
      const stories = userStoriesContent.split(/^##?\s+|^\d+\.\s+/m).filter(s => s.trim().length > 50);
      
      if (stories.length > 0) {
        const wellFormedCount = stories.slice(0, 10).filter(story => 
          storyPattern.test(story) && wantPattern.test(story) && soThatPattern.test(story)
        ).length;
        
        // Warn if less than half of stories are well-formed
        if (wellFormedCount === 0 && stories.length > 0) {
          issues.push({
            severity: 'warning',
            category: 'user_story_format',
            message: 'User stories may not follow standard format (As a... I want... So that...)',
          });
        }
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * PHASE 6 (SPEC_DESIGN_COMPONENTS) - validateDesignQuality
   * Validates the SPEC_DESIGN_COMPONENTS phase quality checklist:
   * - Both component-mapping.md AND journey-maps.md exist
   * - journey-maps.md has 3+ user journeys
   * - journey-maps.md has error states documented
   * - journey-maps.md has empty states documented
   * - component-mapping.md references journey steps
   * - No placeholder code (// TODO, lorem ipsum, placeholder)
   */
  public validateDesignQuality(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const componentMapping = artifacts['component-mapping.md'] || '';
    const journeyMaps = artifacts['journey-maps.md'] || '';

    // Check 1: Both files exist
    if (!componentMapping || componentMapping.length < 500) {
      issues.push({
        severity: 'error',
        category: 'missing_file',
        message: 'component-mapping.md missing or incomplete (< 500 chars)',
      });
    }

    if (!journeyMaps || journeyMaps.length < 500) {
      issues.push({
        severity: 'error',
        category: 'missing_file',
        message: 'journey-maps.md missing or incomplete (< 500 chars)',
      });
    }

    if (journeyMaps) {
      // Check 2: 3+ user journeys
      const journeyPatterns = [
        /^##?\s*(?:User\s+)?[Jj]ourney\s*\d+/gm,
        /^##?\s*(?:User\s+)?[Jj]ourney\s*\d+\s*:/gm,  // Handle "Journey 1: Onboarding"
        /^###\s+Step\s+\d+/gm, // Journey steps
      ];
      
      let journeyCount = 0;
      for (const pattern of journeyPatterns) {
        const matches = journeyMaps.match(pattern) || [];
        journeyCount = Math.max(journeyCount, matches.length);
      }
      
      // Also check for any "Journey" mentions in headers
      const allJourneyHeaders = journeyMaps.match(/^##+\s+.*[Jj]ourney.*$/gm) || [];
      if (allJourneyHeaders.length > journeyCount) {
        journeyCount = allJourneyHeaders.length;
      }
      
      if (journeyCount < 3) {
        issues.push({
          severity: 'error',
          category: 'journey_count',
          message: `Only ${journeyCount} user journeys found. Minimum: 3`,
        });
      }

      // Check 3: Error states documented
      const hasErrorStates = /error\s+state/i.test(journeyMaps) || 
                            /error\s+handling/i.test(journeyMaps) ||
                            /failure\s+state/i.test(journeyMaps);
      if (!hasErrorStates) {
        issues.push({
          severity: 'warning',
          category: 'error_states',
          message: 'journey-maps.md missing error states documentation',
        });
      }

      // Check 4: Empty states documented
      const hasEmptyStates = /empty\s+state/i.test(journeyMaps) || 
                            /no\s+data\s+state/i.test(journeyMaps) ||
                            /blank\s+state/i.test(journeyMaps);
      if (!hasEmptyStates) {
        issues.push({
          severity: 'warning',
          category: 'empty_states',
          message: 'journey-maps.md missing empty states documentation',
        });
      }
    }

    if (componentMapping && journeyMaps) {
      // Check 5: Component mapping references journey steps
      const hasComponentRefs = /COMP-\d+|COMPONENT-\d+|\[\s*STEP\s*\d+\s*\]/i.test(componentMapping);
      if (!hasComponentRefs) {
        issues.push({
          severity: 'warning',
          category: 'component_references',
          message: 'component-mapping.md should reference journey steps (e.g., COMP-001, STEP-1)',
        });
      }
    }

    // Check 6: No placeholders in either file
    const placeholderPatterns = [
      /\/\/\s*TODO/i,
      /\/\/\s*FIXME/i,
      /TODO[:\s]/i,
      /FIXME[:\s]/i,
      /lorem\s+ipsum/i,
      /placeholder/i,
    ];

    for (const [filename, content] of Object.entries({ 'component-mapping.md': componentMapping, 'journey-maps.md': journeyMaps })) {
      if (content) {
        for (const pattern of placeholderPatterns) {
          if (pattern.test(content)) {
            issues.push({
              severity: 'error',
              category: 'placeholder',
              message: `${filename} contains placeholder code (TODO, lorem ipsum, etc.)`,
            });
            break; // Only report once per file
          }
        }
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Anti-AI-Slop blocking validator for design tokens and components.
   * Detects forbidden AI-generated design patterns and blocks progression if found.
   * This is used by inline validation to enforce blocking behavior for anti-slop checks.
   */
  public validateAntiAISlopBlocking(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    for (const [filename, content] of Object.entries(artifacts)) {
      if (!content) continue;

      const errors = detectForbiddenPatterns(content);
      for (const error of errors) {
        issues.push({
          severity: 'error',  // Make these blocking!
          category: 'anti_slop',
          message: `${filename}: ${error}`,
        });
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,  // BLOCK if any found
      issues,
    };
  }

  /**
   * PHASE 9 (SOLUTIONING) - validateSolutionQuality
   * Validates the SOLUTIONING phase quality checklist:
   * - tasks.md has 15+ tasks
   * - Test specifications come BEFORE implementation notes
   * - Each task has time estimate
   * - Each task has file paths
   * - No circular dependencies in task graph
   */
  public validateSolutionQuality(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const tasksContent = artifacts['tasks.md'] || '';
    const architectureContent = artifacts['architecture.md'] || '';
    const epicsContent = artifacts['epics.md'] || '';

    if (!tasksContent || tasksContent.length < 100) {
      issues.push({
        severity: 'error',
        category: 'missing_file',
        message: 'tasks.md missing or incomplete (< 100 chars)',
      });
      return {
        canProceed: issues.filter(i => i.severity === 'error').length === 0,
        issues,
      };
    }

    // Check 1: Task count (15+)
    const taskPatterns = [
      /#{1,3}\s+TASK-[A-Z0-9]+(?:-[0-9]+)?/g,  // TASK-XXX or TASK-XXX-YYY
      /#{1,3}\s+Task\s+\d+/gi,
      /##?\s*\d+\.\s+Task/g,
    ];
    
    let taskCount = 0;
    for (const pattern of taskPatterns) {
      const matches = tasksContent.match(pattern) || [];
      taskCount = Math.max(taskCount, matches.length);
    }
    
    if (taskCount < 15) {
      issues.push({
        severity: 'error',
        category: 'task_count',
        message: `Only ${taskCount} tasks found. Minimum: 15`,
      });
    }

    // Check 2: Test specifications come BEFORE implementation notes
    // Match TASK-XXX or TASK-XXX-YYY format
    const taskBlocks = tasksContent.split(/#{1,3}\s+TASK-[A-Z0-9]+(?:-[0-9]+)?:/g);
    let wrongOrderCount = 0;
    
    for (let i = 1; i < taskBlocks.length; i++) { // Skip first (before first task header)
      const block = taskBlocks[i];
      
      const testIndex = block.search(/#{1,3}\s+(?:Test\s+)?[Ss]pecifications?\b/i);
      const implIndex = block.search(/#{1,3}\s+[Ii]mplementation\s+[Nn]otes\b/i);
      
      if (testIndex !== -1 && implIndex !== -1 && testIndex > implIndex) {
        wrongOrderCount++;
      }
    }
    
    if (wrongOrderCount > 0) {
      issues.push({
        severity: 'error',
        category: 'test_order',
        message: `${wrongOrderCount} task(s) have implementation notes before test specifications (violates Article 2)`,
      });
    }

    // Check 3: Time estimates
    const timeEstimatePattern = /(?:Estimate|Time|Complexity|Story\s*Points?)[:\s]*\d+/i;
    const tasksWithTimeEstimates = (tasksContent.match(timeEstimatePattern) || []).length;
    const totalTasks = taskCount || 15;
    
    if (tasksWithTimeEstimates < totalTasks * 0.5) {
      issues.push({
        severity: 'warning',
        category: 'time_estimates',
        message: `Only ${tasksWithTimeEstimates} tasks have time estimates. All tasks should have estimates.`,
      });
    }

    // Check 4: File paths
    const filePathPatterns = [
      /src\//g,
      /components\//g,
      /lib\//g,
      /app\//g,
      /\.tsx?/g,
      /\.json/g,
    ];
    
    let hasFilePaths = false;
    for (const pattern of filePathPatterns) {
      if (pattern.test(tasksContent)) {
        hasFilePaths = true;
        break;
      }
    }
    
    if (!hasFilePaths) {
      issues.push({
        severity: 'warning',
        category: 'file_paths',
        message: 'tasks.md may not reference specific file paths for implementation',
      });
    }

    // Check 5: Circular dependencies
    const taskDependencies = this.parseTaskDependencies(tasksContent);
    const circularDeps = this.detectCircularDependencies(taskDependencies);
    
    if (circularDeps.length > 0) {
      for (const cycle of circularDeps) {
        issues.push({
          severity: 'error',
          category: 'circular_dependencies',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
        });
      }
    }

    // Check 6: Architecture references approved stack
    if (architectureContent) {
      const stackContent = artifacts['stack-decision.md'] || artifacts['stack.json'] || '';
      if (stackContent) {
        // Extract stack info
        const stackName = stackContent.includes('Next.js') ? 'Next.js' :
                         stackContent.includes('React') ? 'React' :
                         stackContent.includes('Express') ? 'Express' : null;
        
        if (stackName && !architectureContent.toLowerCase().includes(stackName.toLowerCase())) {
          issues.push({
            severity: 'warning',
            category: 'stack_consistency',
            message: 'architecture.md may not reference the approved stack from stack-decision.md',
          });
        }
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Helper: Extract persona names from personas.md content
   */
  public extractPersonaNames(content: string): string[] {
    const names: string[] = [];
    
    // Match markdown headers like "## Sarah - Marketing Manager" or "## Persona: Admin"
    // Use [ \t]+ instead of \s+ to avoid matching across newlines
    const headerMatches = content.match(/^##?[ \t]+(?:Persona[ \t]*:?[ \t]*)?([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)*)/gm) || [];
    for (const match of headerMatches) {
      const name = match.replace(/^##?[ \t]+(?:Persona[ \t]*:?[ \t]*)?/i, '').trim();
      if (name.length > 2 && !name.includes('\n')) names.push(name);
    }
    
    // Match YAML frontmatter
    const frontmatterMatches = content.match(/^-?[ \t]*name:[ \t]*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)*)/gim) || [];
    for (const match of frontmatterMatches) {
      const name = match.replace(/^-?[ \t]*name:[ \t]*/i, '').trim();
      if (name.length > 2 && !name.includes('\n')) names.push(name);
    }
    
    return [...new Set(names)];
  }

  private getMarkdownFilesForPhase(phase: string): string[] {
    return this.getRequiredFilesForPhase(phase).filter((file) =>
      file.endsWith('.md')
    );
  }

  private getArtifactContent(
    projectId: string,
    artifactName: string,
    phase?: string
  ): string {
    // Extract phase from artifactName if provided in format "PHASE/artifact.md"
    let targetPhase = phase;
    let targetName = artifactName;

    if (artifactName.includes('/')) {
      const [phaseFromName, ...rest] = artifactName.split('/');
      targetPhase = phaseFromName;
      targetName = rest.join('/');
    }

    // Prefer cache (R2/DB-aware) if available
    if (this.artifactCache) {
      if (targetPhase) {
        const cached = this.artifactCache.get(`${targetPhase}/${targetName}`);
        if (cached !== undefined) return cached;
      } else {
        for (const phaseCandidate of ORCHESTRATOR_PHASES) {
          const cached = this.artifactCache.get(
            `${phaseCandidate}/${targetName}`
          );
          if (cached !== undefined) return cached;
        }
      }
    }

    // Fallback: filesystem only
    const artifactPath = resolve(
      this.projectsBasePath,
      projectId,
      'specs',
      targetPhase || 'ANALYSIS',
      'v1',
      targetName
    );
    try {
      if (!existsSync(artifactPath)) return '';
      return readFileSync(artifactPath, 'utf8');
    } catch (error) {
      logger.warn(
        `Error reading artifact ${artifactName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          artifact: artifactName,
          path: artifactPath,
        }
      );
      return '';
    }
  }

  /**
   * Find all files matching a pattern in the project directory
   * Simple glob-like matching for frontend component files
   */
  private findProjectFiles(
    projectId: string,
    phase: string,
    pattern: string
  ): string[] {
    const files: string[] = [];
    const basePath = resolve(
      this.projectsBasePath,
      projectId,
      'specs',
      phase,
      'v1'
    );

    if (!existsSync(basePath)) return [];

    // Convert glob-like pattern to prefix
    // components/**/*.tsx -> starts with components/
    const prefix = pattern.split('**')[0].replace(/\/$/, '');
    const targetExt = pattern.includes('.tsx') ? '.tsx' : 
                      pattern.includes('.ts') ? '.ts' : null;

    const searchDir = targetExt 
      ? resolve(basePath, prefix || '.')
      : resolve(basePath, prefix || '.');

    if (!existsSync(searchDir)) return [];

    const traverse = (dir: string, base: string) => {
      if (!existsSync(dir)) return;
      
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = resolve(dir, entry.name);
          if (entry.isDirectory()) {
            traverse(fullPath, base);
          } else if (entry.isFile()) {
            const relPath = resolve(base, entry.name);
            const ext = extname(entry.name);
            if (!targetExt || ext === targetExt) {
              files.push(relPath);
            }
          }
        }
      } catch {
        // Directory might not be readable, skip
      }
    };

    traverse(searchDir, searchDir);
    return files;
  }

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

  // Public test-facing methods for unit testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public validatePresence(
    artifacts: Record<string, string>,
    validator: any
  ): { passed: boolean; errors?: string[] } {
    const errors: string[] = [];
    const requiredFiles = validator.required_files || [];

    for (const file of requiredFiles) {
      if (!artifacts[file]) {
        errors.push(`Required file missing: ${file}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public validateMarkdownFrontmatter(artifacts: Record<string, string>): {
    passed: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];
    const requiredFields = ['title', 'owner', 'version', 'date', 'status'];

    for (const [filename, content] of Object.entries(artifacts)) {
      if (!filename.endsWith('.md')) continue;

      const frontmatter = this.extractFrontmatter(content);
      if (!frontmatter) {
        errors.push(`${filename} missing frontmatter`);
        continue;
      }

      for (const field of requiredFields) {
        if (!frontmatter[field]) {
          errors.push(`${filename} missing frontmatter field: ${field}`);
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public validateContentQuality(artifacts: Record<string, string>): {
    passed: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];
    const minLength = 100;

    for (const [filename, content] of Object.entries(artifacts)) {
      const cleanContent = content.replace(/\s/g, '');
      if (cleanContent.length < minLength) {
        errors.push(
          `${filename} content too short: ${cleanContent.length} chars (min ${minLength})`
        );
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public validateContentCoverage(
    artifacts: Record<string, string>,
    validator: any
  ): { passed: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (validator.type === 'SPEC') {
      const prdContent = artifacts['PRD.md'] || '';
      const reqMatches = prdContent.match(/REQ-[A-Z0-9_-]+/gi) || [];

      if (reqMatches.length < 5) {
        errors.push(
          `PRD.md has only ${reqMatches.length} requirements (min 5)`
        );
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public validateTaskDAG(artifacts: Record<string, string>): {
    passed: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];
    const tasksContent = artifacts['tasks.md'] || '';

    if (!tasksContent) {
      errors.push('tasks.md not found');
      return { passed: false, errors };
    }

    const taskDependencies = this.parseTaskDependencies(tasksContent);
    const circularDeps = this.detectCircularDependencies(taskDependencies);

    if (circularDeps.length > 0) {
      for (const cycle of circularDeps) {
        errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public validateAPIOpenAPI(artifacts: Record<string, string>): {
    passed: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];
    const apiSpec = artifacts['api-spec.json'] || '';

    try {
      const spec = JSON.parse(apiSpec);

      if (!spec.openapi || !spec.openapi.startsWith('3.')) {
        errors.push('Missing or invalid OpenAPI version');
      }
      if (!spec.info) {
        errors.push('Missing API info section');
      }
      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push('No API paths defined');
      }
    } catch (error) {
      errors.push(`Invalid JSON in api-spec.json: ${error}`);
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate that SPEC_DESIGN_COMPONENTS generated BOTH required files
   * This directly addresses the primary user complaint: journey-maps.md frequently missing
   */
  public async validateTwoFileDesignOutput(project: Project): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const componentMapping = await this.getArtifactContent(
      project.id,
      'component-mapping.md',
      'SPEC_DESIGN_COMPONENTS'
    );
    const journeyMaps = await this.getArtifactContent(
      project.id,
      'journey-maps.md',
      'SPEC_DESIGN_COMPONENTS'
    );

    // Check both files exist with minimum content
    const MIN_CONTENT_LENGTH = 500;
    const hasComponentMapping = componentMapping && componentMapping.length >= MIN_CONTENT_LENGTH;
    const hasJourneyMaps = journeyMaps && journeyMaps.length >= MIN_CONTENT_LENGTH;

    checks['component_mapping_exists'] = Boolean(hasComponentMapping);
    checks['journey_maps_exists'] = Boolean(hasJourneyMaps);

    if (!hasComponentMapping) {
      errors.push('component-mapping.md missing or incomplete (< 500 chars)');
    }
    if (!hasJourneyMaps) {
      errors.push(
        'journey-maps.md missing or incomplete (< 500 chars) - ' +
        'THIS IS THE PRIMARY USER COMPLAINT - LLM must output both files!'
      );
    }

    // Additional quality checks if both files exist
    if (hasComponentMapping && hasJourneyMaps) {
      // Check journey-maps.md has actual journey content
      const journeyCount = (journeyMaps.match(/^##?\s*Journey\s*\d+/gim) || []).length;
      checks['journey_count'] = journeyCount >= 3;
      if (journeyCount < 3) {
        warnings.push(`journey-maps.md has only ${journeyCount} journeys (min 3 recommended)`);
      }

      // Check for error states documentation
      const hasErrorStates = /error\s*state/i.test(journeyMaps);
      const hasEmptyStates = /empty\s*state/i.test(journeyMaps);
      checks['has_error_states'] = hasErrorStates;
      checks['has_empty_states'] = hasEmptyStates;

      if (!hasErrorStates) {
        warnings.push('journey-maps.md missing error states documentation');
      }
      if (!hasEmptyStates) {
        warnings.push('journey-maps.md missing empty states documentation');
      }

      // Check that journey maps reference component mapping
      const hasComponentRefs = /\b(COMP|COMPONENT)-?\d+/i.test(journeyMaps);
      checks['has_component_references'] = hasComponentRefs;
      if (!hasComponentRefs) {
        warnings.push('journey-maps.md should reference components from component-mapping.md');
      }
    }

    const status = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';

    return {
      status,
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate no console.log or debugger statements in frontend components
   * From frontend-developer integration spec - Quality Gate #2
   */
  public async validateNoConsoleLogs(project: Project): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const componentFiles = this.findProjectFiles(project.id, 'FRONTEND_BUILD', 'components/**/*.tsx');
    
    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf8');
      
      const consolePatterns = [
        /console\.(log|debug|info|warn|error)\s*\(/g,
        /debugger/g,
      ];
      
      for (const pattern of consolePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          errors.push(`${file}: Contains ${matches.length} console/debugger statement(s)`);
        }
      }
    }

    checks['no_console_logs'] = errors.length === 0;
    
    const status = errors.length > 0 ? 'fail' : 'pass';

    return {
      status,
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate accessibility patterns in frontend components
   * From frontend-developer integration spec - WCAG 2.1 AA compliance
   */
  public async validateAccessibility(project: Project): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const componentFiles = this.findProjectFiles(project.id, 'FRONTEND_BUILD', 'components/**/*.tsx');
    
    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf8');
      
      // Check for useReducedMotion accessibility
      const hasReducedMotion = /prefers-reduced-motion|useReducedMotion/i.test(content);
      checks[`${file}:has_useReducedMotion`] = hasReducedMotion;
      if (!hasReducedMotion) {
        warnings.push(`${file}: Missing useReducedMotion accessibility check`);
      }
      
      // Check for interactive elements without ARIA
      const hasInteractive = /<(button|a|input|select|textarea)/.test(content);
      const hasAria = /aria-/.test(content);
      if (hasInteractive && !hasAria) {
        errors.push(`${file}: Interactive elements may lack ARIA attributes`);
      }
      
      // Check for button elements without type attribute
      const buttonWithoutType = /<button(?![^>]*type=)[^>]*>/gi;
      const buttonMatches = content.match(buttonWithoutType);
      if (buttonMatches && buttonMatches.length > 0) {
        warnings.push(`${file}: ${buttonMatches.length} button(s) missing type attribute`);
      }
    }

    checks['accessibility_compliant'] = errors.length === 0 && warnings.length === 0;
    
    const status = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';

    return {
      status,
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate no placeholder code (TODO, lorem ipsum, etc.)
   * From frontend-developer integration spec - Quality Gate #1
   */
  public async validateNoPlaceholders(project: Project): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const componentFiles = this.findProjectFiles(project.id, 'FRONTEND_BUILD', 'components/**/*.tsx');
    
    const placeholderPatterns = [
      /TODO[:\s]/i,
      /FIXME[:\s]/i,
      /placeholder/i,
      /lorem ipsum/i,
      /\/\/\s*.*implement/i,
      /\/\/\s*.*todo/i,
      /XXX[^\n]*/g,
    ];
    
    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf8');
      
      for (const pattern of placeholderPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          errors.push(`${file}: Contains placeholder: "${matches[0].slice(0, 50)}"`);
        }
      }
    }

    checks['no_placeholders'] = errors.length === 0;
    
    const status = errors.length > 0 ? 'fail' : 'pass';

    return {
      status,
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate minimum character length for an artifact
   * Prevents empty or nearly-empty files to ensure content quality
   */
  public validateMinimumLength(
    content: string,
    artifactName: string,
    minLength: number
  ): { passed: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (content.length < minLength) {
      errors.push(
        `${artifactName} is too short (${content.length} chars). Minimum: ${minLength} chars.`
      );
    }
    
    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate minimum length for all artifacts based on type-specific standards
   * Maps artifact names to their minimum character counts
   */
  public validateArtifactLengths(
    artifacts: Record<string, string>
  ): { passed: boolean; errors?: string[]; checks: Record<string, boolean> } {
    const errors: string[] = [];
    const checks: Record<string, boolean> = {};
    
    // Minimum length standards per artifact type
    const minLengths: Record<string, number> = {
      'project-classification.json': 500,
      'constitution.md': 1000,
      'project-brief.md': 1500,
      'personas.md': 1500,
      'stack.json': 500,
      'stack-analysis.md': 1500,
      'PRD.md': 3000,
      'api-spec.json': 1000,
      'data-model.md': 1500,
      'design-tokens.json': 500,
      'component-mapping.md': 2000,
      'journey-maps.md': 2000,
      'dependencies.json': 500,
      'tasks.md': 2000,
    };

    for (const [artifactName, content] of Object.entries(artifacts)) {
      const minLength = minLengths[artifactName];
      if (minLength !== undefined) {
        const result = this.validateMinimumLength(content, artifactName, minLength);
        checks[artifactName] = result.passed;
        if (!result.passed && result.errors) {
          errors.push(...result.errors);
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      checks,
    };
  }

  // ============================================================================
  // TRACEABILITY VALIDATORS (Task 11)
  // These validators ensure artifacts are consistent across phases
  // ============================================================================

  /**
   * Validate that requirements reference personas
   * PHASE 3 (SPEC_PM) - Ensures each REQ-XXX in PRD.md references a persona
   */
  public validatePersonaTraceability(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const prdContent = artifacts['PRD.md'] || '';
    const personasContent = artifacts['personas.md'] || '';

    if (!prdContent) {
      return {
        canProceed: false,
        issues: [{
          severity: 'error',
          category: 'missing_file',
          message: 'PRD.md missing - cannot validate persona traceability',
        }],
      };
    }

    // Extract persona names from personas.md
    const personaNames = this.extractPersonaNames(personasContent);

    // Add common persona patterns that might appear in PRD
    const commonPersonas = ['Admin', 'User', 'Developer', 'Manager', 'Customer', 'Guest', 'Member'];
    const allPersonas = [...new Set([...personaNames, ...commonPersonas])];

    // Find all unique REQ-XXX requirements in PRD
    const reqMatches = prdContent.match(/REQ-[A-Z]+-\d{3}/g) || [];
    const uniqueReqs = [...new Set(reqMatches)];

    if (uniqueReqs.length === 0) {
      return {
        canProceed: true,
        issues: [{
          severity: 'warning',
          category: 'no_requirements',
          message: 'No REQ-XXX requirements found in PRD.md',
        }],
      };
    }

    // For each requirement, check if it references a persona
    const reqsWithoutPersona: string[] = [];
    const reqPattern = /##?\s*(REQ-[A-Z]+-\d{3})[^\n]*\n([\s\S]*?)(?=##?\s*REQ-|##?\s+#|$)/g;
    let match;

    while ((match = reqPattern.exec(prdContent)) !== null) {
      const reqId = match[1];
      const reqContent = match[2];

      // Check if any persona is mentioned in the requirement content
      const hasPersonaRef = allPersonas.some(p => 
        new RegExp(`\\b${p}\\b`, 'i').test(reqContent)
      );

      if (!hasPersonaRef) {
        reqsWithoutPersona.push(reqId);
      }
    }

    if (reqsWithoutPersona.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'persona_traceability',
        message: `${reqsWithoutPersona.length} requirement(s) do not reference any persona: ${reqsWithoutPersona.slice(0, 5).join(', ')}${reqsWithoutPersona.length > 5 ? '...' : ''}`,
      });
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validate that acceptance criteria use Gherkin format (Given/When/Then)
   * PHASE 3 (SPEC_PM) - Ensures acceptance criteria follow Gherkin syntax
   */
  public validateGherkinStructure(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const acceptanceCriteriaContent = artifacts['acceptance-criteria.md'] || '';

    if (!acceptanceCriteriaContent) {
      return {
        canProceed: false,
        issues: [{
          severity: 'error',
          category: 'missing_file',
          message: 'acceptance-criteria.md missing - cannot validate Gherkin structure',
        }],
      };
    }

    // Check for Gherkin keywords (case-insensitive)
    const hasGiven = /GIVEN\s+/i.test(acceptanceCriteriaContent);
    const hasWhen = /WHEN\s+/i.test(acceptanceCriteriaContent);
    const hasThen = /THEN\s+/i.test(acceptanceCriteriaContent);

    // Check for generic "As a user" style criteria (not proper Gherkin)
    const genericCriteriaPattern = /as\s+a\s+\w+\s*,?\s*i\s+want\s+to?/i;
    const hasGenericCriteria = genericCriteriaPattern.test(acceptanceCriteriaContent);

    const checks: Record<string, boolean> = {
      has_given: hasGiven,
      has_when: hasWhen,
      has_then: hasThen,
      has_gherkin_format: hasGiven && hasWhen && hasThen,
      is_generic_format: hasGenericCriteria,
    };

    // If no Gherkin format found
    if (!checks.has_gherkin_format) {
      // Check if it's using generic user story format instead
      if (hasGenericCriteria) {
        issues.push({
          severity: 'warning',
          category: 'gherkin_format',
          message: 'Acceptance criteria use generic user story format (As a... I want...) instead of Gherkin (Given/When/Then)',
        });
      } else {
        issues.push({
          severity: 'warning',
          category: 'gherkin_format',
          message: 'Acceptance criteria do not appear to follow Gherkin format (missing GIVEN/WHEN/THEN keywords)',
        });
      }
    }

    // Check for scenario count
    const scenarioCount = (acceptanceCriteriaContent.match(/^#{0,3}\s*(?:Scenario|Given|When|Then|And|But)/gim) || []).length;
    if (scenarioCount < 3) {
      issues.push({
        severity: 'warning',
        category: 'scenario_count',
        message: `Only ${scenarioCount} scenario(s) found in acceptance criteria. Minimum 3 recommended.`,
      });
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validate that tasks map to requirements
   * PHASE 9 (SOLUTIONING) - Ensures each TASK-XXX references at least one REQ-XXX
   */
  public validateRequirementToTaskMapping(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const prdContent = artifacts['PRD.md'] || '';
    const tasksContent = artifacts['tasks.md'] || '';

    if (!tasksContent) {
      return {
        canProceed: false,
        issues: [{
          severity: 'error',
          category: 'missing_file',
          message: 'tasks.md missing - cannot validate requirement-to-task mapping',
        }],
      };
    }

    // Extract all REQ-XXX requirements from PRD
    const prdReqs = this.extractRequirementReferences(prdContent);

    // Extract all TASK-XXX tasks from tasks.md
    const taskIds = this.extractTaskReferences(tasksContent);

    if (taskIds.length === 0) {
      return {
        canProceed: true,
        issues: [{
          severity: 'warning',
          category: 'no_tasks',
          message: 'No TASK-XXX references found in tasks.md',
        }],
      };
    }

    // For each task, check if it references any requirement
    const orphanTasks: string[] = [];

    // Parse task blocks to check requirement references within each task
    const taskBlocks = tasksContent.split(/#{1,3}\s+TASK-[A-Z0-9]+(?:-[0-9]+)?:/g);
    
    for (let i = 1; i < taskBlocks.length; i++) { // Skip first (before first task header)
      const taskBlock = taskBlocks[i];
      const taskReqs = this.extractRequirementReferences(taskBlock);
      
      if (taskReqs.length === 0) {
        // Find the task ID from the previous match
        const taskPattern = /#{1,3}\s+TASK-[A-Z0-9]+(?:-[0-9]+)?:/g;
        // Reset and find the i-th match
        const matches = [...taskBlocks[i-1].matchAll(taskPattern)];
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const taskId = lastMatch[0].replace(/^#{1,3}\s+/, '').replace(/:$/, '');
          orphanTasks.push(taskId);
        }
      }
    }

    // Also check for tasks that reference requirements not in PRD
    const invalidReqRefs: string[] = [];
    const allTaskReqs = this.extractRequirementReferences(tasksContent);
    for (const req of allTaskReqs) {
      if (!prdReqs.includes(req)) {
        if (!invalidReqRefs.includes(req)) {
          invalidReqRefs.push(req);
        }
      }
    }

    if (orphanTasks.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'orphan_tasks',
        message: `${orphanTasks.length} task(s) do not reference any requirement (REQ-XXX): ${orphanTasks.slice(0, 5).join(', ')}${orphanTasks.length > 5 ? '...' : ''}`,
      });
    }

    if (invalidReqRefs.length > 0) {
      issues.push({
        severity: 'error',
        category: 'invalid_requirement_refs',
        message: `${invalidReqRefs.length} task(s) reference requirements not in PRD.md: ${invalidReqRefs.join(', ')}`,
      });
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  // ============================================================================
  // HELPER FUNCTIONS FOR TRACEABILITY VALIDATORS
  // Made public for testing purposes
  // ============================================================================

  /**
   * Split content by REQ-XXX headers and return map of requirement ID to content
   */
  public splitByRequirement(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    // Match REQ-XXX followed by content until next REQ or end
    const reqPattern = /#{0,3}\s*(REQ-[A-Z]+-\d{3})[^\n]*\n([\s\S]*?)(?=#{0,3}\s*REQ-[A-Z]+-\d{3}|#{0,3}\s*#{1,3}\s*[^#]|$)/g;
    let match;

    while ((match = reqPattern.exec(content)) !== null) {
      const reqId = match[1];
      const reqContent = match[2].trim();
      result[reqId] = reqContent;
    }

    return result;
  }

  /**
   * Extract all TASK-XXX references from content
   */
  public extractTaskReferences(content: string): string[] {
    const matches = content.match(/TASK-[A-Z0-9]+(?:-[0-9]+)?/g) || [];
    return [...new Set(matches)];
  }

  /**
   * Extract all REQ-XXX references from content
   */
  public extractRequirementReferences(content: string): string[] {
    const matches = content.match(/REQ-[A-Z]+-\d{3}/g) || [];
    return [...new Set(matches)];
  }

  // ============================================================================
  // CONSTITUTIONAL COMPLIANCE VALIDATORS (Task 12)
  // Implements validation for all 5 Constitutional Articles from constitution.md
  // ============================================================================

  /**
   * Article 1: Semantic Goal Locking
   * Validates that all phases reference and honor constitution.md + project-classification.json
   */
  public validateSemanticGoalLocking(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const constitutionContent = artifacts['constitution.md'] || '';
    const classificationContent = artifacts['project-classification.json'] || '';
    const prdContent = artifacts['PRD.md'] || '';
    const architectureContent = artifacts['architecture.md'] || '';

    // Check 1: constitution.md exists
    if (!constitutionContent || constitutionContent.length < 100) {
      issues.push({
        severity: 'error',
        category: 'article_1',
        message: 'constitution.md missing or too short - Semantic Goal Locking cannot be enforced',
      });
      return { canProceed: false, issues };
    }

    // Check 2: project-classification.json exists and is valid JSON
    if (!classificationContent) {
      issues.push({
        severity: 'error',
        category: 'article_1',
        message: 'project-classification.json missing - cannot validate project classification',
      });
    } else {
      try {
        const classification = JSON.parse(classificationContent);
        if (!classification.project_type && !classification.scale_tier) {
          issues.push({
            severity: 'warning',
            category: 'article_1',
            message: 'project-classification.json missing key fields (project_type, scale_tier)',
          });
        }
      } catch {
        issues.push({
          severity: 'error',
          category: 'article_1',
          message: 'project-classification.json is not valid JSON',
        });
      }
    }

    // Check 3: PRD.md references constitution principles
    if (prdContent) {
      const hasGuidingPrinciplesRef = /guiding\s+principles?|constitution/i.test(prdContent) ||
                                     /article\s+\d/i.test(prdContent);
      if (!hasGuidingPrinciplesRef) {
        issues.push({
          severity: 'warning',
          category: 'article_1',
          message: 'PRD.md does not reference constitution.md or guiding principles',
        });
      }
    }

    // Check 4: architecture.md references project classification
    if (architectureContent && classificationContent) {
      try {
        const classification = JSON.parse(classificationContent);
        const projectType = classification.project_type || '';
        const scaleTier = classification.scale_tier || '';

        if (projectType && !architectureContent.toLowerCase().includes(projectType.toLowerCase())) {
          issues.push({
            severity: 'warning',
            category: 'article_1',
            message: `architecture.md does not reference project type: ${projectType}`,
          });
        }

        if (scaleTier && !architectureContent.toLowerCase().includes(scaleTier.toLowerCase())) {
          issues.push({
            severity: 'warning',
            category: 'article_1',
            message: `architecture.md does not reference scale tier: ${scaleTier}`,
          });
        }
      } catch {
        // JSON parsing already handled above
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Article 2: Test-First Compliance (Task 12 implementation)
   * Validates that tests are specified BEFORE implementation in tasks.md
   * Pattern: "Test:" section should appear before "Implement:" section
   * This is the public version for direct invocation (Article 2 specific)
   */
  public validateTestFirstComplianceArt2(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const tasksContent = artifacts['tasks.md'] || '';

    if (!tasksContent || tasksContent.length < 100) {
      return {
        canProceed: true,
        issues: [{
          severity: 'warning',
          category: 'article_2',
          message: 'tasks.md missing or too short - skipping test-first validation',
        }],
      };
    }

    // Parse TASK-XXX sections
    const taskSections = tasksContent.split(/#{1,3}\s+TASK-[A-Z0-9]+(?:-[0-9]+)?:/g);

    for (let i = 1; i < taskSections.length; i++) {
      const section = taskSections[i];
      const taskId = `TASK-${i.toString().padStart(3, '0')}`;

      // Find "Test:" section - handle multiple formats
      const testPatterns = [
        /(?:^|\n)#{1,3}\s*Test[:\s]/im,
        /(?:^|\n)Test[:\s]/im,
        /(?:^|\n)#{1,3}\s*Test\s+Specifications/im,
        /(?:^|\n)#{1,3}\s*Test\s+Specification/im,
      ];

      // Find "Implement:" section - handle multiple formats
      const implPatterns = [
        /(?:^|\n)#{1,3}\s*Implement[:\s]/im,
        /(?:^|\n)Implement[:\s]/im,
        /(?:^|\n)#{1,3}\s*Implementation\s+Notes/im,
        /(?:^|\n)#{1,3}\s*Implementation\s+Note/im,
      ];

      let testMatch: RegExpMatchArray | null = null;
      let implMatch: RegExpMatchArray | null = null;

      // Find test section
      for (const pattern of testPatterns) {
        const matches = section.match(pattern);
        if (matches && matches.length > 0) {
          testMatch = matches;
          break;
        }
      }

      // Find implementation section
      for (const pattern of implPatterns) {
        const matches = section.match(pattern);
        if (matches && matches.length > 0) {
          implMatch = matches;
          break;
        }
      }

      // Check order
      if (implMatch && testMatch) {
        const testPos = section.indexOf(testMatch[0]);
        const implPos = section.indexOf(implMatch[0]);

        if (implPos < testPos) {
          issues.push({
            severity: 'error',
            category: 'article_2',
            message: `${taskId}: Implementation appears BEFORE test specification (Article 2 violation)`,
          });
        }
      }
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Article 3: Bite-Sized Execution
   * Validates that tasks are 15-30 minute chunks with verification commands
   */
  public validateBiteSizedTasks(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const tasksContent = artifacts['tasks.md'] || '';

    if (!tasksContent || tasksContent.length < 100) {
      return {
        canProceed: true,
        issues: [{
          severity: 'warning',
          category: 'article_3',
          message: 'tasks.md missing or too short - skipping bite-sized validation',
        }],
      };
    }

    // Parse TASK-XXX sections
    const taskSections = tasksContent.split(/#{1,3}\s+TASK-[A-Z0-9]+(?:-[0-9]+)?:/g);

    let tasksWithoutTimeEstimate = 0;
    let tasksWithoutVerification = 0;

    for (let i = 1; i < taskSections.length; i++) {
      const section = taskSections[i];
      const taskId = `TASK-${i.toString().padStart(3, '0')}`;

      // Check for time estimate (15min, 30 minutes, 1 hour, etc.)
      const timePatterns = [
        /Estimate[:\s]*\d+\s*(?:min|minute|hour|hr)s?/i,
        /Time[:\s]*\d+\s*(?:min|minute|hour|hr)s?/i,
        /\d+\s*(?:min|minute|hour|hr)s?\s*(?:estimate|time)/i,
        /Complexity[:\s]*(?:\d+|Small|Medium|Large)/i,
      ];

      const hasTimeEstimate = timePatterns.some(pattern => pattern.test(section));

      if (!hasTimeEstimate) {
        tasksWithoutTimeEstimate++;
      }

      // Check for verification command (npm test, curl -f, etc.)
      const verificationPatterns = [
        /npm\s+(?:run\s+)?test/i,
        /npm\s+(?:run\s+)?build/i,
        /curl\s+.*-f/i,
        /verify[:\s]*(?:npm|curl|docker)/i,
        /Run[:\s]*(?:npm|test|build)/i,
        /Check[:\s]*(?:status|output|result)/i,
        /Verification[:\s]*(?:command|step)/i,
      ];

      const hasVerification = verificationPatterns.some(pattern => pattern.test(section));

      if (!hasVerification) {
        tasksWithoutVerification++;
      }
    }

    const totalTasks = taskSections.length - 1;

    if (tasksWithoutTimeEstimate > 0) {
      issues.push({
        severity: tasksWithoutTimeEstimate === totalTasks ? 'error' : 'warning',
        category: 'article_3',
        message: `${tasksWithoutTimeEstimate}/${totalTasks} tasks lack time estimate (15-30min expected)`,
      });
    }

    if (tasksWithoutVerification > 0) {
      issues.push({
        severity: tasksWithoutVerification === totalTasks ? 'error' : 'warning',
        category: 'article_3',
        message: `${tasksWithoutVerification}/${totalTasks} tasks lack verification command`,
      });
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Article 5: Constitutional Review
   * Validates final handoff has all requirements met
   */
  public validateConstitutionalReview(
    artifacts: Record<string, string>
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    const handoffContent = artifacts['HANDOFF.md'] || '';
    const tasksContent = artifacts['tasks.md'] || '';
    const architectureContent = artifacts['architecture.md'] || '';
    const prdContent = artifacts['PRD.md'] || '';

    // Check 1: HANDOFF.md exists
    if (!handoffContent || handoffContent.length < 200) {
      return {
        canProceed: false,
        issues: [{
          severity: 'error',
          category: 'article_5',
          message: 'HANDOFF.md missing or incomplete - Constitutional Review cannot proceed',
        }],
      };
    }

    // Check 2: Required artifacts are present (all phases completed)
    const requiredArtifacts = [
      { name: 'tasks.md', content: tasksContent, minLength: 100 },
      { name: 'architecture.md', content: architectureContent, minLength: 100 },
      { name: 'PRD.md', content: prdContent, minLength: 500 },
    ];

    for (const artifact of requiredArtifacts) {
      if (!artifact.content || artifact.content.length < artifact.minLength) {
        issues.push({
          severity: 'error',
          category: 'article_5',
          message: `${artifact.name} missing or incomplete for handoff`,
        });
      }
    }

    // Check 3: No placeholder content in HANDOFF.md
    const placeholderPatterns = [
      /TODO:/i,
      /FIXME:/i,
      /\[?[Aa]ssumptions?\s*placeholders?\]?/i,
      /\[?[Tt]o\s+be\s+determined?\]?/i,
      /lorem\s+ipsum/i,
      /placeholder/i,
    ];

    const hasPlaceholders = placeholderPatterns.some(pattern => pattern.test(handoffContent));

    if (hasPlaceholders) {
      issues.push({
        severity: 'error',
        category: 'article_5',
        message: 'HANDOFF.md contains placeholder content - must be complete for handoff',
      });
    }

    // Check 4: HANDOFF.md has required sections
    const requiredSections = [
      /Summary/i,
      /Key\s+Decisions/i,
      /Next\s+Steps/i,
      /Known\s+Issues/i,
    ];

    const missingSections = requiredSections.filter(pattern => !pattern.test(handoffContent));

    if (missingSections.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'article_5',
        message: `HANDOFF.md missing sections: ${missingSections.map(p => p.source).join(', ')}`,
      });
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Main Constitutional Compliance Validator (Task 12 implementation)
   * Validates all applicable Constitutional Articles based on phase
   * This is the public version for direct invocation
   */
  public validateConstitutionalComplianceArt(
    artifacts: Record<string, string>,
    phase: string
  ): { canProceed: boolean; issues: Array<{ severity: string; category: string; message: string }> } {
    const issues: Array<{ severity: string; category: string; message: string }> = [];

    // Article 1: Semantic Goal Locking - Check constitution reference
    const article1 = this.validateSemanticGoalLocking(artifacts);
    issues.push(...article1.issues);

    // Article 2: Test-First Compliance - Check task order
    if (artifacts['tasks.md']) {
      const article2 = this.validateTestFirstComplianceArt2(artifacts);
      issues.push(...article2.issues);
    }

    // Article 3: Bite-Sized Execution - Check task structure
    if (artifacts['tasks.md']) {
      const article3 = this.validateBiteSizedTasks(artifacts);
      issues.push(...article3.issues);
    }

    // Article 5: Constitutional Review - Check handoff completeness
    if (artifacts['HANDOFF.md'] || phase === 'DONE') {
      const article5 = this.validateConstitutionalReview(artifacts);
      issues.push(...article5.issues);
    }

    return {
      canProceed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }
}
