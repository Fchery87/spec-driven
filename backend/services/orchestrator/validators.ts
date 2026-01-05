import { Validator, ValidationResult, Project } from '@/types/orchestrator';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { logger } from '@/lib/logger';
import {
  buildArtifactCacheForProject,
  ORCHESTRATOR_PHASES,
} from './artifact_access';

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

    const content =
      this.getArtifactContent(
        project.id,
        'design-system.md',
        'SPEC_DESIGN_TOKENS'
      ) || this.getArtifactContent(project.id, 'design-system.md', 'SPEC'); // Legacy fallback
    if (!content) {
      return {
        status: 'warn',
        checks: { design_system_exists: false },
        warnings: [
          'design-system.md not found - skipping design system compliance validation',
        ],
      };
    }

    const hasOKLCH = /oklch\(/i.test(content) || /\bOKLCH\b/i.test(content);
    checks['oklch_color_format'] = hasOKLCH;
    if (!hasOKLCH) {
      errors.push('design-system.md does not appear to use OKLCH color format');
    }

    const forbiddenColorMatch = content.match(
      /\b(primary|accent)\b[^\n]{0,120}\b(purple|indigo|violet)\b/i
    );
    checks['no_purple_primary'] = !forbiddenColorMatch;
    if (forbiddenColorMatch) {
      errors.push(
        'design-system.md appears to use purple/indigo/violet for primary/accent tokens'
      );
    }

    const hasReducedMotion =
      /useReducedMotion/i.test(content) || /reduced\s+motion/i.test(content);
    checks['reduced_motion_support'] = hasReducedMotion;
    if (!hasReducedMotion) {
      warnings.push(
        'design-system.md does not mention reduced motion support (useReducedMotion)'
      );
    }

    const hasAnimationTokens =
      /duration/i.test(content) && /spring/i.test(content);
    checks['has_animation_tokens'] = hasAnimationTokens;
    if (!hasAnimationTokens) {
      warnings.push(
        'design-system.md does not clearly define animation tokens (durations + springs)'
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
    // Expected format: # T-001: Task Name\nDependencies: T-002, T-003
    const taskRegex = /#{1,3}\s+([T\w-]+):\s+(.+?)(?=#{1,3}\s+[T\w-]+:|$)/gs;
    let match;

    while ((match = taskRegex.exec(tasksContent)) !== null) {
      const taskId = match[1].trim();
      const taskBlock = match[2];

      // Find dependencies section
      const depsRegex = /(?:depends\s+on|dependencies?):\s*(.+?)(?:\n\n|$)/i;
      const depsMatch = depsRegex.exec(taskBlock);

      if (depsMatch) {
        const depsText = depsMatch[1];
        // Extract task IDs from comma/space-separated list
        const depIds = depsText
          .split(/[,\s]+/)
          .map((id) => id.trim())
          .filter((id) => id.match(/^[T\w-]+$/));

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
      SPEC_DESIGN_COMPONENTS: ['component-inventory.md', 'user-flows.md'],
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
}
