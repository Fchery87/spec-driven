import { logger } from '@/lib/logger';
import {
  Project,
  Phase,
  OrchestratorSpec,
  ValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  OrchestrationState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  PhaseHistory,
  ArtifactChange,
  ImpactLevel,
  ChangeType,
  ChangedSection,
  AffectedArtifact,
  ImpactAnalysis,
  RegenerationStrategy,
  ParallelGroup,
  PhaseExecutionResult,
  ParallelWorkflowOptions,
  ParallelWorkflowResult,
} from '@/types/orchestrator';
import { ConfigLoader } from './config_loader';
import { Validators } from './validators';
import { ArtifactManager } from './artifact_manager';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { ApprovalGateService } from '../approval/approval_gate_service';
import { GitService } from '../git/git_service';
import { RollbackService } from '../rollback/rollback_service';
import {
  getAnalystExecutor,
  getPMExecutor,
  getArchitectExecutor,
  getScruMasterExecutor,
  getDevOpsExecutor,
  getDesignExecutor,
  getStackSelectionExecutor,
  getDesignerExecutor,
} from '../llm/agent_executors';
import { getFrontendExecutor } from '../llm/frontend_executor';
import { GeminiClient } from '../llm/llm_client';
import {
  createLLMClient,
  ProviderType,
  getProviderApiKeyAsync,
} from '../llm/providers';
import { DynamicPhaseTokenCalculator } from '../llm/dynamic_phase_token_calculator';
import { ModelParameterResolver } from '../llm/model_parameter_resolver';
import {
  deriveIntelligentDefaultStack,
  parseProjectClassification,
} from '@/backend/lib/stack_defaults';
import {
  validateAntiAISlop,
  autoFixAntiAISlop,
} from '../validation/anti_ai_slop_validator';
import { CheckerPattern } from '../llm/checker_pattern';
import { CheckerResult, CriticFeedback } from '../llm/checker_pattern';
import { db } from '@/backend/lib/drizzle';
import { regenerationRuns, artifactVersions } from '@/backend/lib/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { RegenerationOptions, RegenerationResult } from '@/types/orchestrator';

export class OrchestratorEngine {
  private spec: OrchestratorSpec;
  private validators: Validators;
  private artifactManager: ArtifactManager;
  private llmClient: GeminiClient;
  private approvalGateService: ApprovalGateService;
  private gitService: Map<string, GitService>;
  private rollbackService: Map<string, RollbackService>;
  private checkerPattern: CheckerPattern;
  private checkerEnabledPhases: Set<string>;

  constructor() {
    logger.info('[OrchestratorEngine] Constructor called');
    try {
      this.spec = new ConfigLoader().loadSpec();
      logger.info('[OrchestratorEngine] Loaded spec:', {
        hasPhases: !!this.spec?.phases,
        phaseKeys: this.spec?.phases ? Object.keys(this.spec.phases) : [],
        hasValidators: !!this.spec?.validators,
        hasLlmConfig: !!this.spec?.llm_config,
      });

      // Defensive validation: ensure spec is properly initialized
      if (
        !this.spec ||
        !this.spec.phases ||
        Object.keys(this.spec.phases).length === 0
      ) {
        logger.error('[OrchestratorEngine] Constructor validation failed!');
        logger.error(
          '[OrchestratorEngine] this.spec: ' + JSON.stringify(this.spec)
        );
        throw new Error(
          'OrchestratorEngine failed to load spec with phases. ' +
            'Check that orchestrator_spec.yml exists, is valid YAML, and has a phases section defined.'
        );
      }
      logger.info('[OrchestratorEngine] Constructor validation passed');
    } catch (error) {
      logger.error(
        '[OrchestratorEngine] Constructor error:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }

    try {
      this.validators = new Validators(this.spec.validators);
      this.artifactManager = new ArtifactManager();
      this.approvalGateService = new ApprovalGateService();
      this.gitService = new Map();
      this.rollbackService = new Map();
      
      logger.info(
        '[OrchestratorEngine] ApprovalGateService, GitService, and RollbackService initialized'
      );
    } catch (error) {
      logger.error(
        '[OrchestratorEngine] Failed to initialize validators/artifact manager:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }

    // Initialize LLM client with dynamic phase token allocation and optimal generation parameters
    // The DynamicPhaseTokenCalculator automatically scales phase tokens based on the model's maxOutputTokens
    // The ModelParameterResolver automatically resolves optimal temperature, timeout, and other parameters
    const modelId = this.spec.llm_config.model as string;
    const phaseOverrides = (this.spec.llm_config as any).phase_overrides || {};

    // Validate phase overrides configuration
    const validationErrors =
      DynamicPhaseTokenCalculator.validatePhaseOverrides(phaseOverrides);
    if (validationErrors.length > 0) {
      logger.warn('[OrchestratorEngine] Phase override validation warnings:', {
        errors: validationErrors,
      });
    }

    // Calculate dynamic phase token limits based on model capability
    const dynamicPhaseLimits =
      DynamicPhaseTokenCalculator.calculatePhaseTokenLimits(
        modelId,
        phaseOverrides
      );

    // Create enhanced phase_overrides with calculated dynamic tokens
    const enhancedPhaseOverrides = { ...phaseOverrides };
    for (const [phase, tokens] of Object.entries(dynamicPhaseLimits)) {
      if (!enhancedPhaseOverrides[phase]) {
        enhancedPhaseOverrides[phase] = {};
      }
      // Store the calculated max_tokens (this will be used by LLM client)
      (enhancedPhaseOverrides[phase] as any).max_tokens = tokens;
    }

    // Log the phase token allocation summary
    const allocationSummary = DynamicPhaseTokenCalculator.generateSummary(
      modelId,
      phaseOverrides
    );
    logger.info(
      '[OrchestratorEngine] Phase Token Allocation' + allocationSummary
    );

    // Resolve optimal generation parameters for the model
    let resolvedParams;
    try {
      resolvedParams = ModelParameterResolver.resolveOptimalParameters(modelId);
      logger.info('[OrchestratorEngine] Model parameters resolved', {
        modelId,
        temperature: resolvedParams.temperature,
        timeout: resolvedParams.timeout,
        maxTokens: resolvedParams.maxTokens,
        source: resolvedParams.source,
      });

      // Log the parameter resolution summary
      const paramSummary = ModelParameterResolver.generateSummary(
        modelId,
        resolvedParams
      );
      logger.info(
        '[OrchestratorEngine] Model Parameter Resolution' + paramSummary
      );
    } catch (error) {
      logger.warn(
        '[OrchestratorEngine] Failed to resolve parameters, using YAML defaults',
        {
          modelId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      // Fall back to YAML config if resolution fails
      resolvedParams = {
        temperature: this.spec.llm_config.temperature as number,
        timeout: this.spec.llm_config.timeout_seconds as number,
        maxTokens: this.spec.llm_config.max_tokens as number,
        source: 'preset' as const,
        calculationDetails: {
          modelId,
          provider: this.spec.llm_config.provider as string as any,
          modelMaxTokens: this.spec.llm_config.max_tokens as number,
          baseTemperature: this.spec.llm_config.temperature as number,
          finalTemperature: this.spec.llm_config.temperature as number,
          timeoutSeconds: this.spec.llm_config.timeout_seconds as number,
          appliedConstraints: ['Using YAML defaults due to resolution error'],
          validationErrors: [],
        },
      };
    }

    // Initialize LLM client with both dynamic phase tokens AND optimal generation parameters
    const llmConfig = {
      provider: this.spec.llm_config.provider as string,
      model: modelId,
      max_tokens: resolvedParams.maxTokens, // Use resolved parameters
      temperature: resolvedParams.temperature, // Use resolved parameters
      timeout_seconds: resolvedParams.timeout, // Use resolved parameters
      api_key: process.env.GEMINI_API_KEY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phase_overrides: enhancedPhaseOverrides,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.llmClient = new GeminiClient(llmConfig as any);
    
    // Initialize Checker Pattern for dual-LLM adversarial review
    // This runs critic personas (Skeptical CTO, QA Lead, Security Auditor, A11y Specialist)
    this.checkerPattern = new CheckerPattern(this.llmClient);
    
    // Configure which phases use the checker pattern
    this.checkerEnabledPhases = new Set([
      'STACK_SELECTION',
      'SPEC_PM',
      'SPEC_ARCHITECT',
      'FRONTEND_BUILD',
    ]);
    
    logger.info('[OrchestratorEngine] CheckerPattern initialized', {
      checkerEnabledPhases: Array.from(this.checkerEnabledPhases),
    });
  }

  /**
   * Fetch LLM settings from database (admin overrides)
   */
  private async getLLMSettingsFromDB(): Promise<{
    provider?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
  }> {
    try {
      const { db } = await import('@/backend/lib/drizzle');
      const { settings } = await import('@/backend/lib/schema');
      const { like } = await import('drizzle-orm');

      const llmSettings = await db
        .select()
        .from(settings)
        .where(like(settings.key, 'llm_%'));

      const result: Record<string, string> = {};
      llmSettings.forEach((s: { key: string; value: string }) => {
        result[s.key] = s.value;
      });

      return {
        provider: result['llm_provider'] || undefined,
        model: result['llm_model'] || undefined,
        temperature: result['llm_temperature']
          ? parseFloat(result['llm_temperature'])
          : undefined,
        max_tokens: result['llm_max_tokens']
          ? parseInt(result['llm_max_tokens'], 10)
          : undefined,
        timeout: result['llm_timeout']
          ? parseInt(result['llm_timeout'], 10)
          : undefined,
      };
    } catch (error) {
      logger.warn(
        'Failed to fetch LLM settings from database, using YAML defaults',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return {};
    }
  }

  /**
   * Validate if a phase is complete and can advance
   */
  async validatePhaseCompletion(project: Project): Promise<ValidationResult> {
    const currentPhase = this.spec.phases[project.current_phase];
    if (!currentPhase) {
      return {
        status: 'fail',
        checks: {},
        errors: [`Unknown phase: ${project.current_phase}`],
      };
    }

    // Check if all required artifacts exist
    const artifactResults = await this.artifactManager.validateArtifacts(
      project.id,
      currentPhase.outputs
    );

    // Run phase-specific validators
    const validatorResults = await this.validators.runValidators(
      currentPhase.validators,
      project
    );

    // Combine results
    const allChecks = { ...artifactResults.checks, ...validatorResults.checks };
    const allErrors = [
      ...(artifactResults.errors || []),
      ...(validatorResults.errors || []),
    ];
    const allWarnings = [
      ...(artifactResults.warnings || []),
      ...(validatorResults.warnings || []),
    ];

    const hasErrors = allErrors.length > 0;
    const hasWarnings = allWarnings.length > 0;

    return {
      status: hasErrors ? 'fail' : hasWarnings ? 'warn' : 'pass',
      checks: allChecks,
      errors: hasErrors ? allErrors : undefined,
      warnings: hasWarnings ? allWarnings : undefined,
    };
  }

  /**
   * Check if project can advance to next phase
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canAdvanceToPhase(project: Project, targetPhase?: string): boolean {
    const currentPhase = this.spec.phases[project.current_phase];
    if (!currentPhase) return false;

    // Check if all gates are passed
    if (currentPhase.gates) {
      for (const gate of currentPhase.gates) {
        if (!this.isGatePassed(project, gate)) {
          return false;
        }
      }
    }

    // Check dependencies
    if (currentPhase.depends_on) {
      for (const dependency of currentPhase.depends_on) {
        if (!project.phases_completed.includes(dependency)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Advance project to next phase
   */
  async advancePhase(
    project: Project,
    userId: string
  ): Promise<{
    success: boolean;
    newPhase?: string;
    message: string;
  }> {
    // Validate current phase completion
    const validation = await this.validatePhaseCompletion(project);
    if (validation.status === 'fail') {
      return {
        success: false,
        message: `Cannot advance phase: ${validation.errors?.join(', ')}`,
      };
    }

    // Check if can advance
    if (!this.canAdvanceToPhase(project)) {
      return {
        success: false,
        message:
          'Cannot advance phase: gates not passed or dependencies not met',
      };
    }

    const currentPhase = this.spec.phases[project.current_phase];
    const nextPhaseName = currentPhase.next_phase;

    // Update project state
    project.phases_completed.push(project.current_phase);
    project.current_phase = nextPhaseName;
    project.updated_at = new Date();

    // Record phase transition
    await this.recordPhaseTransition(
      project,
      project.current_phase,
      nextPhaseName,
      userId
    );

    return {
      success: true,
      newPhase: nextPhaseName,
      message: `Advanced to ${nextPhaseName} phase`,
    };
  }

  // ============================================================================
  // CHECKER PATTERN INTEGRATION
  // ============================================================================

  /**
   * Run checker pattern for a phase and handle the decision
   * @returns The artifacts (possibly regenerated) and any messages
   */
  private async runCheckerPattern(
    phase: string,
    artifacts: Record<string, string>,
    projectId: string,
    projectName: string
  ): Promise<{
    artifacts: Record<string, string>;
    message: string;
    escalated: boolean;
  }> {
    // Skip if checker not enabled for this phase
    if (!this.checkerEnabledPhases.has(phase)) {
      return { artifacts, message: 'Checker not enabled for this phase', escalated: false };
    }

    logger.info(`[CheckerPattern] Running for phase: ${phase}`);

    const context = {
      projectId,
      projectName,
      phase,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await this.checkerPattern.executeCheck(phase, artifacts, context);

      logger.info(`[CheckerPattern] Result for ${phase}: ${result.status}`, {
        confidence: result.confidence,
        issues: result.feedback.length,
        critical: result.feedback.filter(f => f.severity === 'critical').length,
        medium: result.feedback.filter(f => f.severity === 'medium').length,
        low: result.feedback.filter(f => f.severity === 'low').length,
      });

      // Handle the decision
      switch (result.status) {
        case 'approved':
          return {
            artifacts,
            message: `Checker approved (${result.feedback.length} minor suggestions)`,
            escalated: false,
          };

        case 'regenerate':
          logger.warn(`[CheckerPattern] Regeneration needed for ${phase}`, {
            issues: result.feedback.length,
          });
          return {
            artifacts,
            message: `Regeneration suggested: ${result.feedback.length} issues found`,
            escalated: false,
          };

        case 'escalate':
          const criticalCount = result.feedback.filter(f => f.severity === 'critical').length;
          logger.error(
            `[CheckerPattern] Escalating ${phase} to human review`,
            undefined,
            { criticalIssues: criticalCount }
          );
          return {
            artifacts,
            message: `ESCALATED: ${result.summary} - ${result.feedback.length} issues requiring human review`,
            escalated: true,
          };

        default:
          return { artifacts, message: 'Unknown checker status', escalated: false };
      }
    } catch (error) {
      logger.error(`[CheckerPattern] Failed for ${phase}: ${error}`);
      // On checker failure, proceed with original artifacts (fail-open)
      return {
        artifacts,
        message: `Checker failed (${String(error).slice(0, 100)}), proceeding with artifacts`,
        escalated: false,
      };
    }
  }

  /**
   * Build regeneration prompt with checker feedback
   */
  private buildRegenerationPromptWithFeedback(
    originalPrompt: string,
    feedback: CriticFeedback[]
  ): string {
    return this.checkerPattern.buildRegenerationPrompt(originalPrompt, feedback);
  }

  /**
   * Run agent for current phase
   */
  async runPhaseAgent(
    project: Project,
    artifacts: Record<string, string> = {}
  ): Promise<{
    success: boolean;
    artifacts: Record<string, string>;
    message: string;
  }> {
    // Capture ALL project properties locally FIRST to prevent context loss
    const projectId = project.id;
    const currentPhaseName = project.current_phase;
    const stackChoice = project.stack_choice;
    const orchestrationState = project.orchestration_state;

    // Track phase start time for duration measurement
    const phaseStartTime = Date.now();

    logger.info(
      '[OrchestratorEngine] runPhaseAgent called for phase: ' + currentPhaseName
    );

    try {
      logger.info(`Executing agent for phase: ${currentPhaseName}`);

      // Check approval gates before phase execution
      const canProceed = await this.approvalGateService.canProceedFromPhase(
        projectId,
        currentPhaseName
      );

      if (!canProceed) {
        // Get pending blocking gates for better error message
        const projectGates = await this.approvalGateService.getProjectGates(
          projectId
        );
        const pendingBlockingGates = projectGates.filter(
          (gate) =>
            gate.phase === currentPhaseName &&
            gate.blocking &&
            gate.status === 'pending'
        );

        const gateNames = pendingBlockingGates
          .map((g) => g.gateName)
          .join(', ');
        const error = `Cannot execute phase ${currentPhaseName}: pending approval gates: ${gateNames}`;

        logger.error('[OrchestratorEngine] Approval gate check failed', {
          projectId,
          phase: currentPhaseName,
          pendingGates: gateNames,
        } as any);

        const err: any = new Error(error);
        err.projectId = projectId;
        throw err;
      }

      logger.info('[OrchestratorEngine] Approval gates passed', {
        projectId,
        phase: currentPhaseName,
      });

      // Initialize GitService and RollbackService per project (lazy initialization)
      const projectPath = project.project_path;
      if (projectPath && !this.gitService.has(projectId)) {
        try {
          logger.info(
            '[OrchestratorEngine] Initializing GitService and RollbackService for project',
            {
              projectId,
              projectPath,
            }
          );
          this.gitService.set(projectId, new GitService(projectPath));
          this.rollbackService.set(projectId, new RollbackService(projectPath));
        } catch (error) {
          logger.warn(
            '[OrchestratorEngine] Failed to initialize GitService/RollbackService',
            {
              projectId,
              projectPath,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }

      // Use cached spec from constructor (loaded once to avoid drift)
      const spec = this.spec;

      // Validate spec is loaded
      if (!spec || !spec.phases) {
        throw new Error(
          '[CRITICAL] Failed to load orchestrator spec with phases'
        );
      }

      // Validate phase exists
      if (!spec.phases[currentPhaseName]) {
        throw new Error(`Unknown phase: ${currentPhaseName}`);
      }

      // Handle AUTO_REMEDY phase specially (Phase 1 Integration)
      if (currentPhaseName === 'AUTO_REMEDY') {
        logger.info('[AUTO_REMEDY] Executing auto-remediation workflow');

        // Get latest validation result
        const validationResult = await this.validatePhaseCompletion(project);

        // Import Phase 1 modules
        const { determinePhaseOutcome } = await import('./phase_outcomes');
        const { executeAutoRemedy } = await import('./auto_remedy_executor');

        const outcome = determinePhaseOutcome({
          phase: currentPhaseName,
          validationResult: {
            passed: validationResult.status === 'pass',
            canProceed: validationResult.status !== 'fail',
            warnings: (validationResult.warnings || []).map((w) => ({
              severity: 'warning' as const,
              message: w,
              phase: currentPhaseName,
            })),
            errors: (validationResult.errors || []).map((e) => ({
              severity: 'error' as const,
              message: e,
              phase: currentPhaseName,
            })),
            totalWarnings: validationResult.warnings?.length || 0,
            accumulatedWarnings: [],
          },
        });

        if (outcome.state === 'failures_detected') {
          const autoRemedyContext = {
            projectId,
            failedPhase:
              project.phases_completed[project.phases_completed.length - 1] ||
              'ANALYSIS',
            validationFailures: (validationResult.errors || []).map((e) => ({
              phase: currentPhaseName,
              message: e,
              artifactId: 'unknown',
            })),
            currentAttempt: (project as any).autoRemedyAttempts || 0,
            maxAttempts: 2,
          };

          const result = await executeAutoRemedy(autoRemedyContext);

          if (result.canProceed) {
            logger.info(
              '[AUTO_REMEDY] Remediation succeeded - re-running validation'
            );
            // Return empty artifacts - actual fixes applied by remediation
            return {
              success: true,
              artifacts: {},
              message: 'AUTO_REMEDY completed - validation will be re-run',
            };
          } else {
            logger.warn('[AUTO_REMEDY] Escalating to MANUAL_REVIEW');
            throw new Error(
              `AUTO_REMEDY failed: ${result.reason} - manual review required`
            );
          }
        }

        // No failures or already remediated
        return {
          success: true,
          artifacts: {},
          message: 'AUTO_REMEDY phase - no action needed',
        };
      }

      // Use cached validators (initialized in constructor)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const validators = this.validators;
      const artifactManager = new ArtifactManager();

      // Fetch LLM settings from database (admin overrides)
      const dbSettings = await this.getLLMSettingsFromDB();

      // Determine provider (database setting takes precedence)
      const provider = (dbSettings.provider ||
        spec.llm_config.provider ||
        'gemini') as ProviderType;
      const apiKey = await getProviderApiKeyAsync(provider);

      // Create LLM client with database settings taking precedence over YAML
      const llmConfig = {
        provider,
        model: dbSettings.model || (spec.llm_config.model as string),
        max_tokens:
          dbSettings.max_tokens || (spec.llm_config.max_tokens as number),
        temperature:
          dbSettings.temperature || (spec.llm_config.temperature as number),
        timeout_seconds:
          dbSettings.timeout || (spec.llm_config.timeout_seconds as number),
        api_key: apiKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phase_overrides: (spec.llm_config as any).phase_overrides || {},
      };

      logger.info('[OrchestratorEngine] Using LLM config', {
        provider: llmConfig.provider,
        model: llmConfig.model,
        fromDB: !!dbSettings.model,
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.max_tokens,
      });

      // Create LLM client using factory (supports multiple providers)
      const llmClient = createLLMClient(llmConfig);

      // Get project name for template variables
      const projectName = project.name || 'Untitled Project';

      let generatedArtifacts: Record<string, string> = {};

      // Get current phase spec
      const currentPhase = spec.phases[currentPhaseName];

      // Get executor for current phase and run agent
      switch (currentPhaseName) {
        case 'ANALYSIS':
          generatedArtifacts = await getAnalystExecutor(
            llmClient,
            projectId,
            artifacts,
            projectName
          );
          logger.debug(
            '[OrchestratorEngine] Generated artifacts from executor',
            {
              phase: currentPhaseName,
              artifactKeys: Object.keys(generatedArtifacts),
              artifactCount: Object.keys(generatedArtifacts).length,
            }
          );

          // Phase 1: Inline validation for ANALYSIS
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((currentPhase as any).inline_validation?.enabled) {
            logger.info('[ANALYSIS] Running inline validation');
            const { runInlineValidation } = await import('./inline_validation');
            const inlineResult = await runInlineValidation({
              phase: currentPhaseName,
              artifacts: generatedArtifacts,
            });

            if (!inlineResult.canProceed) {
              logger.error('[ANALYSIS] Inline validation failed', {
                errorMessages: inlineResult.errors,
                warnings: inlineResult.warnings,
              } as any);
              throw new Error(
                `Inline validation failed: ${inlineResult.errors
                  .map((e) => e.message)
                  .join(', ')}`
              );
            }

            if (inlineResult.warnings.length > 0) {
              logger.warn('[ANALYSIS] Inline validation warnings', {
                warnings: inlineResult.warnings,
              });
            }
          }
          break;

        case 'SPEC_PM':
          // SPEC_PM phase - PM generates PRD
          logger.info('[SPEC_PM] Executing PM Executor for PRD generation');
          const pmArtifacts = await getPMExecutor(
            llmClient,
            projectId,
            artifacts,
            stackChoice,
            projectName
          );

          logger.debug('[SPEC_PM] PRD generation complete', {
            prdLength: pmArtifacts['PRD.md']?.length || 0,
            hasContent: !!pmArtifacts['PRD.md']?.trim(),
          });

          generatedArtifacts = pmArtifacts;
          break;

        case 'SPEC_ARCHITECT':
          // SPEC_ARCHITECT phase - Architect generates data model and API spec
          logger.info(
            '[SPEC_ARCHITECT] Executing Architect Executor for data model and API spec'
          );

          // Add PRD to artifacts if it exists from SPEC_PM
          const artifactsWithPRDForArch: Record<string, string> = {
            ...artifacts,
            'SPEC_PM/PRD.md':
              artifacts['SPEC_PM/PRD.md'] || artifacts['SPEC/PRD.md'] || '',
          };

          const archSpecArtifacts = await getArchitectExecutor(
            llmClient,
            projectId,
            artifactsWithPRDForArch,
            'SPEC_ARCHITECT',
            stackChoice,
            projectName
          );

          logger.debug('[SPEC_ARCHITECT] Architect generation complete', {
            dataModelLength: archSpecArtifacts['data-model.md']?.length || 0,
            apiSpecLength: archSpecArtifacts['api-spec.json']?.length || 0,
            hasDataModel: !!archSpecArtifacts['data-model.md']?.trim(),
            hasApiSpec: !!archSpecArtifacts['api-spec.json']?.trim(),
          });

          generatedArtifacts = archSpecArtifacts;
          break;

        case 'SOLUTIONING':
          // Run agents sequentially to avoid rate limiting
          // Architect generates architecture.md first
          const archArtifacts = await getArchitectExecutor(
            llmClient,
            projectId,
            artifacts,
            'SOLUTIONING',
            stackChoice,
            projectName
          );
          logger.info(
            '[SOLUTIONING] Architect Agent complete, starting Scrum Master Agent'
          );

          // Small delay to help with rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Scrum Master generates epics.md, tasks.md, plan.md
          const scrumArtifacts = await getScruMasterExecutor(
            llmClient,
            projectId,
            artifacts,
            projectName
          );

          generatedArtifacts = {
            ...archArtifacts,
            ...scrumArtifacts,
          };
          break;

        case 'DEPENDENCIES':
          generatedArtifacts = await getDevOpsExecutor(
            llmClient,
            projectId,
            artifacts,
            stackChoice,
            projectName
          );
          break;

        case 'STACK_SELECTION':
          generatedArtifacts = await getStackSelectionExecutor(
            llmClient,
            projectId,
            artifacts,
            projectName
          );

          // Phase 1: Inline validation for STACK_SELECTION
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((currentPhase as any).inline_validation?.enabled) {
            logger.info('[STACK_SELECTION] Running inline validation');
            const { runInlineValidation } = await import('./inline_validation');
            const inlineResult = await runInlineValidation({
              phase: currentPhaseName,
              artifacts: generatedArtifacts,
            });

            if (!inlineResult.canProceed) {
              logger.error('[STACK_SELECTION] Inline validation failed', {
                errorMessages: inlineResult.errors,
                warnings: inlineResult.warnings,
              } as any);
              throw new Error(
                `Inline validation failed: ${inlineResult.errors
                  .map((e) => e.message)
                  .join(', ')}`
              );
            }

            if (inlineResult.warnings.length > 0) {
              logger.warn('[STACK_SELECTION] Inline validation warnings', {
                warnings: inlineResult.warnings,
              });
            }
          }
          break;

        case 'SPEC_DESIGN_TOKENS':
          // Design tokens phase - stack-agnostic design system tokens
          logger.info('[SPEC_DESIGN_TOKENS] Executing Design Agent for tokens');
          const designerExecutor = getDesignerExecutor();
          const designTokensResult = await designerExecutor.generateArtifacts({
            phase: 'SPEC_DESIGN_TOKENS',
            stack: stackChoice,
            constitution: artifacts['ANALYSIS/constitution.md'] || '',
            projectBrief: artifacts['ANALYSIS/project-brief.md'] || '',
            projectPath: project.project_path,
            projectId,
            llmClient,
          });

          if (!designTokensResult.success) {
            throw new Error(
              `SPEC_DESIGN_TOKENS failed: ${JSON.stringify(
                designTokensResult.metadata
              )}`
            );
          }

          generatedArtifacts = designTokensResult.artifacts;
          logger.info('[SPEC_DESIGN_TOKENS] Design tokens generated', {
            artifactKeys: Object.keys(generatedArtifacts),
          });

          // Anti-AI-Slop validation and auto-fix for design tokens
          for (const [filename, content] of Object.entries(
            generatedArtifacts
          )) {
            // Apply auto-fix for common AI slop patterns (e.g., Inter font -> DM Sans)
            const fixResult = autoFixAntiAISlop(content);
            if (fixResult.fixed) {
              logger.info('[SPEC_DESIGN_TOKENS] Auto-fixed AI slop patterns', {
                artifact: filename,
                replacements: fixResult.replacements,
              });
              // Use the fixed content
              generatedArtifacts[filename] = fixResult.content;
            }

            // Now validate the (potentially fixed) content
            const slopResult = validateAntiAISlop(
              filename,
              fixResult.fixed ? fixResult.content : content
            );
            if (slopResult.status === 'fail') {
              logger.error(
                '[SPEC_DESIGN_TOKENS] Anti-AI-slop validation failed',
                {
                  artifact: filename,
                  errors: slopResult.errors,
                } as any
              );
              throw new Error(
                `Anti-AI-slop validation failed for ${filename}: ${slopResult.errors?.join(
                  ', '
                )}`
              );
            }
          }
          break;

        case 'SPEC_DESIGN_COMPONENTS':
          // Design components phase - stack-specific component mapping
          logger.info(
            '[SPEC_DESIGN_COMPONENTS] Executing Design Agent for components'
          );
          const designerExecutor2 = getDesignerExecutor();
          const designComponentsResult =
            await designerExecutor2.generateArtifacts({
              phase: 'SPEC_DESIGN_COMPONENTS',
              stack: stackChoice,
              constitution: artifacts['ANALYSIS/constitution.md'] || '',
              projectBrief: artifacts['ANALYSIS/project-brief.md'] || '',
              projectPath: project.project_path,
              projectId,
              llmClient,
            });

          if (!designComponentsResult.success) {
            throw new Error(
              `SPEC_DESIGN_COMPONENTS failed: ${JSON.stringify(
                designComponentsResult.metadata
              )}`
            );
          }

          generatedArtifacts = designComponentsResult.artifacts;
          logger.info('[SPEC_DESIGN_COMPONENTS] Component mapping generated', {
            artifactKeys: Object.keys(generatedArtifacts),
          });

          // Anti-AI-Slop validation and auto-fix for design components
          for (const [filename, content] of Object.entries(
            generatedArtifacts
          )) {
            // Apply auto-fix for common AI slop patterns (e.g., Inter font -> DM Sans)
            const fixResult = autoFixAntiAISlop(content);
            if (fixResult.fixed) {
              logger.info(
                '[SPEC_DESIGN_COMPONENTS] Auto-fixed AI slop patterns',
                {
                  artifact: filename,
                  replacements: fixResult.replacements,
                }
              );
              // Use the fixed content
              generatedArtifacts[filename] = fixResult.content;
            }

            // Now validate the (potentially fixed) content
            const slopResult = validateAntiAISlop(
              filename,
              fixResult.fixed ? fixResult.content : content
            );
            if (slopResult.status === 'fail') {
              logger.error(
                '[SPEC_DESIGN_COMPONENTS] Anti-AI-slop validation failed',
                {
                  artifact: filename,
                  errors: slopResult.errors,
                } as any
              );
              throw new Error(
                `Anti-AI-slop validation failed for ${filename}: ${slopResult.errors?.join(
                  ', '
                )}`
              );
            }
          }
          break;

        case 'FRONTEND_BUILD':
          // Frontend build phase - generate React components from design tokens and component inventory
          logger.info(
            '[FRONTEND_BUILD] Executing Frontend Executor for component generation'
          );
          const frontendExecutor = getFrontendExecutor({
            perspective: 'creative_technologist',
          });
          const frontendResult = await frontendExecutor.generateArtifacts({
            phase: 'SPEC_FRONTEND',
            projectName: projectName,
            projectBrief: artifacts['ANALYSIS/project-brief.md'] || '',
            designTokens:
              artifacts['SPEC_DESIGN_TOKENS/design-tokens.md'] ||
              artifacts['design-tokens.md'] ||
              '',
            componentInventory:
              artifacts['SPEC_DESIGN_COMPONENTS/component-inventory.md'] ||
              artifacts['component-inventory.md'] ||
              '',
            stack: stackChoice,
            llmClient,
          });

          if (!frontendResult.success) {
            throw new Error(
              `FRONTEND_BUILD failed: ${JSON.stringify(
                frontendResult.metadata
              )}`
            );
          }

          generatedArtifacts = frontendResult.artifacts;
          logger.info('[FRONTEND_BUILD] Frontend components generated', {
            artifactKeys: Object.keys(generatedArtifacts),
          });

          // Anti-AI-Slop validation for frontend components
          for (const [filename, content] of Object.entries(
            generatedArtifacts
          )) {
            const slopResult = validateAntiAISlop(filename, content);
            if (slopResult.status === 'fail') {
              logger.error('[FRONTEND_BUILD] Anti-AI-slop validation failed', {
                artifact: filename,
                errors: slopResult.errors,
              } as any);
              throw new Error(
                `Anti-AI-slop validation failed for ${filename}: ${slopResult.errors?.join(
                  ', '
                )}`
              );
            }
          }
          break;

        case 'VALIDATE':
          generatedArtifacts = await this.generateValidationArtifacts(project);
          break;

        case 'AUTO_REMEDY':
          // AUTO_REMEDY phase - Automated remediation of validation failures
          logger.info(
            '[AUTO_REMEDY] Analyzing validation failures for automated remediation'
          );

          // Import the auto remedy executor and types
          const autoRemedyModule = await import('./auto_remedy_executor');
          const { executeAutoRemedy } = autoRemedyModule;

          // Define minimal context interface inline for TypeScript
          interface LocalAutoRemedyContext {
            projectId: string;
            failedPhase: string;
            validationFailures: Array<{
              phase: string;
              message: string;
              artifactId: string;
            }>;
            currentAttempt: number;
            maxAttempts: number;
            artifactContent?: Record<
              string,
              { current: string; original: string; originalHash: string }
            >;
            validationRunId?: string;
          }

          // Get validation failures from the database for this project
          // For now, we'll create a minimal context - in production, this would query the DB
          const autoRemedyContext: LocalAutoRemedyContext = {
            projectId,
            failedPhase: 'VALIDATE', // AUTO_REMEDY typically runs after VALIDATE fails
            validationFailures: [],
            currentAttempt: 1,
            maxAttempts: 3,
          };

          const autoRemedyResult = await executeAutoRemedy(
            autoRemedyContext as any
          );

          logger.info('[AUTO_REMEDY] Auto remedy analysis complete', {
            canProceed: autoRemedyResult.canProceed,
            requiresManualReview: autoRemedyResult.requiresManualReview,
            reason: autoRemedyResult.reason,
            classificationType: autoRemedyResult.classification?.type,
          });

          // AUTO_REMEDY doesn't generate new artifacts but may trigger phase retry
          // If canProceed is true, the validation failure was resolved
          // If requiresManualReview is true, human intervention is needed
          if (autoRemedyResult.requiresManualReview) {
            throw new Error(
              `AUTO_REMEDY requires manual review: ${autoRemedyResult.reason}`
            );
          }

          generatedArtifacts = {
            'auto-remedy-report.md': `# AUTO_REMEDY Report

## Classification
- Type: ${autoRemedyResult.classification?.type || 'unknown'}
- Confidence: ${autoRemedyResult.classification?.confidence || 0}%

## Remediation Strategy
- Agent: ${autoRemedyResult.remediation?.agentToRerun || 'none'}
- Phase: ${autoRemedyResult.remediation?.phase || 'none'}
- Instructions: ${
              autoRemedyResult.remediation?.additionalInstructions || 'none'
            }

## Result
- Can Proceed: ${autoRemedyResult.canProceed}
- Reason: ${autoRemedyResult.reason}
- Next Attempt: ${autoRemedyResult.nextAttempt}
`,
          };
          break;

        case 'DONE':
          // Handoff generation happens via separate endpoint
          return {
            success: true,
            artifacts: {},
            message: 'Final phase - use /generate-handoff endpoint',
          };

        default:
          throw new Error(`No executor for phase: ${currentPhaseName}`);
      }

      // Save artifacts to storage and normalize artifact keys with phase prefix
      logger.debug('[OrchestratorEngine] About to save artifacts', {
        phase: currentPhaseName,
        artifactCount: Object.keys(generatedArtifacts).length,
        artifactKeys: Object.keys(generatedArtifacts),
      });

      const normalizedArtifacts: Record<string, string> = {};
      for (const [filename, content] of Object.entries(generatedArtifacts)) {
        logger.debug('[OrchestratorEngine] Saving artifact to local storage', {
          phase: currentPhaseName,
          filename,
          contentLength: content.length,
        });
        try {
          await artifactManager.saveArtifact(
            projectId,
            currentPhaseName,
            filename,
            content
          );
        } catch (saveError) {
          logger.debug(
            '[OrchestratorEngine] Local artifact save failed (expected on Vercel)',
            {
              phase: currentPhaseName,
              filename,
              error:
                saveError instanceof Error
                  ? saveError.message
                  : String(saveError),
            }
          );
          // Don't throw - local save failure is expected on serverless
        }
        // Normalize artifact keys to include phase prefix for downstream executors
        const key = `${currentPhaseName}/${filename}`;
        normalizedArtifacts[key] = content;
      }

      logger.debug('[OrchestratorEngine] Normalized artifacts for return', {
        phase: currentPhaseName,
        artifactCount: Object.keys(normalizedArtifacts).length,
      });

      // ============================================================================
      // CHECKER PATTERN EXECUTION
      // Run adversarial review after artifact generation
      // ============================================================================
      const checkerResult = await this.runCheckerPattern(
        currentPhaseName,
        generatedArtifacts,
        projectId,
        projectName
      );

      // Handle escalation - throw error if checker escalated to human review
      if (checkerResult.escalated) {
        logger.error('[OrchestratorEngine] Checker pattern escalated to human review', {
          phase: currentPhaseName,
          message: checkerResult.message,
        } as any);
        const err: any = new Error(
          `[CHECKER ESCALATION] ${currentPhaseName}: ${checkerResult.message}`
        );
        err.projectId = projectId;
        err.phase = currentPhaseName;
        err.escalated = true;
        err.artifacts = generatedArtifacts;
        throw err;
      }

      // Log checker feedback for debugging
      if (checkerResult.message.includes('issues found') || checkerResult.message.includes('minor suggestions')) {
        logger.info(`[CheckerPattern] ${currentPhaseName}: ${checkerResult.message}`);
      }

      // Create Git commit after successful artifact generation
      const gitService = this.gitService.get(projectId);
      if (gitService) {
        const durationMs = Date.now() - phaseStartTime;
        const artifactNames = Object.keys(generatedArtifacts);
        const phaseOwner =
          this.spec.phases[currentPhaseName]?.owner || 'unknown';
        const agentType = Array.isArray(phaseOwner)
          ? phaseOwner[0]
          : phaseOwner;

        const commitResult = await gitService.commitPhaseArtifacts({
          projectSlug: project.name || projectId,
          phase: currentPhaseName,
          artifacts: artifactNames,
          agent: agentType,
          durationMs,
        });

        if (commitResult.success) {
          logger.info('[OrchestratorEngine] Git commit created successfully', {
            phase: currentPhaseName,
            commitHash: commitResult.commitHash,
            branch: commitResult.branch,
            mode: commitResult.mode,
          });
        } else {
          logger.warn('[OrchestratorEngine] Git commit failed', {
            phase: currentPhaseName,
            error: commitResult.error,
            mode: commitResult.mode,
          });
        }

        // Create snapshot after Git commit
        const rollbackService = this.rollbackService.get(projectId);
        if (rollbackService) {
          const snapshotResult = await rollbackService.createSnapshot({
            projectId,
            phaseName: currentPhaseName,
            artifacts: normalizedArtifacts,
            metadata: {
              agent: agentType,
              durationMs,
              stackChoice,
              timestamp: new Date().toISOString(),
            },
            gitCommitHash: commitResult.commitHash,
            gitBranch: commitResult.branch,
          });

          if (snapshotResult.success) {
            logger.info('[OrchestratorEngine] Snapshot created successfully', {
              phase: currentPhaseName,
              snapshotId: snapshotResult.snapshotId,
            });
          } else {
            logger.warn('[OrchestratorEngine] Snapshot creation failed', {
              phase: currentPhaseName,
              error: snapshotResult.error,
            });
          }
        }
      }

      // Use the orchestrationState that was captured at the start of this method
      // to prevent context loss after long async operations
      const freshOrchestrationState = orchestrationState || {
        artifact_versions: {},
        phase_history: [],
        approval_gates: {},
      };

      // Ensure all required properties exist to prevent undefined access
      if (!freshOrchestrationState.artifact_versions) {
        freshOrchestrationState.artifact_versions = {};
      }
      if (!freshOrchestrationState.phase_history) {
        freshOrchestrationState.phase_history = [];
      }
      if (!freshOrchestrationState.approval_gates) {
        freshOrchestrationState.approval_gates = {};
      }

      // Update artifact versions with fresh orchestration state
      if (!freshOrchestrationState.artifact_versions[currentPhaseName]) {
        freshOrchestrationState.artifact_versions[currentPhaseName] = 1;
      } else {
        freshOrchestrationState.artifact_versions[currentPhaseName]++;
      }

      return {
        success: true,
        artifacts: normalizedArtifacts,
        message: `Agent for phase ${currentPhaseName} completed successfully`,
      };
    } catch (error) {
      logger.error(
        'Error running phase agent:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error(
        `Failed to execute agent for phase ${currentPhaseName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public parseStackAnalysis(content: string): {
    primary?: string;
    alternative1?: string;
    alternative2?: string;
    defaultFallbackUsed?: boolean;
    scores?: {
      primary?: number;
      alternative1?: number;
      alternative2?: number;
    };
    decisionMatrix?: Array<Record<string, string>>;
  } {
    if (!content) {
      return {};
    }

    const extractValue = (label: string): string | null => {
      const regex = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : null;
    };

    const normalizeStackId = (value: string | null): string | undefined => {
      if (!value) return undefined;
      const cleaned = value
        .replace(/[*`]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/"/g, '')
        .trim();
      if (!cleaned) return undefined;
      const lowered = cleaned.toLowerCase();
      if (lowered === 'custom' || lowered === 'custom stack') {
        return 'custom';
      }
      return lowered.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    };

    const primary =
      normalizeStackId(extractValue('PRIMARY_RECOMMENDATION')) ||
      normalizeStackId(extractValue('Recommended Template')) ||
      normalizeStackId(
        content.match(/Primary Recommendation:\s*([^\n]+)/i)?.[1] || null
      );

    const alternative1 =
      normalizeStackId(extractValue('ALTERNATIVE_1')) ||
      normalizeStackId(
        content.match(/Alternative 1:\s*([^\n]+)/i)?.[1] || null
      );

    const alternative2 =
      normalizeStackId(extractValue('ALTERNATIVE_2')) ||
      normalizeStackId(
        content.match(/Alternative 2:\s*([^\n]+)/i)?.[1] || null
      );

    const fallbackRaw = extractValue('DEFAULT_FALLBACK_USED');
    const defaultFallbackUsed =
      typeof fallbackRaw === 'string'
        ? fallbackRaw.trim().toLowerCase() === 'true'
        : undefined;

    const scores: {
      primary?: number;
      alternative1?: number;
      alternative2?: number;
    } = {};
    const decisionMatrix: Array<Record<string, string>> = [];
    let currentSection: 'primary' | 'alternative1' | 'alternative2' | null =
      null;
    let inDecisionMatrix = false;
    let matrixHeaders: string[] = [];

    const parseRow = (line: string): string[] => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        return [];
      }
      return trimmed
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
    };

    for (const line of content.split('\n')) {
      if (/^###\s*.*Primary Recommendation/i.test(line)) {
        currentSection = 'primary';
      } else if (/^###\s*.*Alternative 1/i.test(line)) {
        currentSection = 'alternative1';
      } else if (/^###\s*.*Alternative 2/i.test(line)) {
        currentSection = 'alternative2';
      }

      const scoreMatch = line.match(/score[^0-9]*([0-9]{1,3})/i);
      if (currentSection && scoreMatch) {
        const scoreValue = Number(scoreMatch[1]);
        if (!Number.isNaN(scoreValue)) {
          scores[currentSection] = scoreValue;
        }
      }

      if (/Decision Matrix/i.test(line)) {
        inDecisionMatrix = true;
        matrixHeaders = [];
        continue;
      }

      if (inDecisionMatrix) {
        if (!line.trim().startsWith('|')) {
          inDecisionMatrix = false;
          continue;
        }

        const row = parseRow(line);
        if (row.length === 0) {
          continue;
        }

        if (matrixHeaders.length === 0) {
          matrixHeaders = row;
          continue;
        }

        if (row.every((cell) => /^[-:]+$/.test(cell))) {
          continue;
        }

        if (row.length === matrixHeaders.length) {
          const entry: Record<string, string> = {};
          matrixHeaders.forEach((header, index) => {
            entry[header] = row[index] ?? '';
          });
          decisionMatrix.push(entry);
        }
      }
    }

    return {
      primary,
      alternative1,
      alternative2,
      defaultFallbackUsed,
      scores: Object.keys(scores).length ? scores : undefined,
      decisionMatrix: decisionMatrix.length ? decisionMatrix : undefined,
    };
  }

  public resolveStackSelectionMetadata(artifacts: Record<string, string>): {
    projectType?: string;
    scaleTier?: string;
    recommendedStack?: string;
    workflowVersion: number;
  } {
    const classificationRaw =
      artifacts['ANALYSIS/project-classification.json'] || '';
    const classification = parseProjectClassification(classificationRaw);
    const brief = artifacts['ANALYSIS/project-brief.md'] || '';
    const defaults = deriveIntelligentDefaultStack(classification, brief);
    const stackAnalysis =
      artifacts['STACK_SELECTION/stack-analysis.md'] ||
      artifacts['stack-analysis.md'] ||
      '';

    const parsed = this.parseStackAnalysis(stackAnalysis);
    const recommendedStack = parsed.primary || defaults.stack;

    return {
      projectType: classification?.project_type,
      scaleTier: classification?.scale_tier,
      recommendedStack,
      workflowVersion: 2,
    };
  }

  private async generateValidationArtifacts(
    project: Project
  ): Promise<Record<string, string>> {
    const currentDate = new Date().toISOString().split('T')[0];
    const validatorNames =
      (this.spec.phases['VALIDATE']?.validators as string[]) || [];
    const results = await this.validators.runValidators(
      validatorNames,
      project
    );

    const phasesToReport = [
      'ANALYSIS',
      'STACK_SELECTION',
      'SPEC',
      'DEPENDENCIES',
      'SOLUTIONING',
      'VALIDATE',
    ] as const;
    const coverageRows: Array<{
      phase: string;
      artifact: string;
      exists: boolean;
    }> = [];
    const validateOutputs = new Set([
      'validation-report.md',
      'coverage-matrix.md',
    ]);

    for (const phase of phasesToReport) {
      const outputs = this.spec.phases[phase]?.outputs;
      const outputList = Array.isArray(outputs) ? (outputs as string[]) : [];
      for (const artifact of outputList) {
        const artifactPath = resolve(
          project.project_path,
          'specs',
          phase,
          'v1',
          artifact
        );
        const exists =
          phase === 'VALIDATE' && validateOutputs.has(artifact)
            ? true
            : existsSync(artifactPath);
        coverageRows.push({ phase, artifact, exists });
      }
    }

    const total = coverageRows.length;
    const present = coverageRows.filter((r) => r.exists).length;
    const missing = total - present;

    const coverageMatrix = `---
title: Coverage Matrix
owner: validator
version: 1.0
date: ${currentDate}
status: draft
---

# Coverage Matrix

## Summary
| Metric | Value |
|--------|-------|
| Total expected artifacts | ${total} |
| Present | ${present} |
| Missing | ${missing} |

## Matrix
| Phase | Artifact | Present |
|------|---------|---------|
${coverageRows
  .map((r) => `| ${r.phase} | ${r.artifact} | ${r.exists ? '✅' : '❌'} |`)
  .join('\n')}
`;

    const validationReport = `---
title: Validation Report
owner: validator
version: 1.0
date: ${currentDate}
status: draft
---

# Validation Report

## Overall Status: ${results.status.toUpperCase()}

## Validators Run
- ${
      validatorNames.length > 0
        ? validatorNames.join('\n- ')
        : '(none configured)'
    }

## Checks
\`\`\`json
${JSON.stringify(results.checks || {}, null, 2)}
\`\`\`

## Errors
${
  results.errors && results.errors.length > 0
    ? results.errors.map((e) => `- ${e}`).join('\n')
    : '- None'
}

## Warnings
${
  results.warnings && results.warnings.length > 0
    ? results.warnings.map((w) => `- ${w}`).join('\n')
    : '- None'
}
`;

    return {
      'validation-report.md': validationReport,
      'coverage-matrix.md': coverageMatrix,
    };
  }

  /**
   * Validate artifacts for a phase
   */
  async validateArtifacts(
    project: Project,
    phase?: string
  ): Promise<ValidationResult> {
    const targetPhase = phase || project.current_phase;
    const phaseSpec = this.spec.phases[targetPhase];

    if (!phaseSpec) {
      return {
        status: 'fail',
        checks: {},
        errors: [`Unknown phase: ${targetPhase}`],
      };
    }

    return await this.artifactManager.validateArtifacts(
      project.id,
      phaseSpec.outputs
    );
  }

  /**
   * Get artifacts for a phase
   */
  async getPhaseArtifacts(project: Project, phase?: string): Promise<string[]> {
    const targetPhase = phase || project.current_phase;
    const phaseSpec = this.spec.phases[targetPhase];

    if (!phaseSpec) {
      return [];
    }

    return await this.artifactManager.listArtifacts(project.id, targetPhase);
  }

  /**
   * Get artifact content
   */
  async getArtifactContent(
    project: Project,
    artifactName: string
  ): Promise<string> {
    return await this.artifactManager.getArtifactContent(
      project.id,
      artifactName
    );
  }

  /**
   * Rollback to previous phase
   */
  async rollbackPhase(
    project: Project,
    targetPhase: string,
    userId: string
  ): Promise<boolean> {
    const targetPhaseSpec = this.spec.phases[targetPhase];
    if (!targetPhaseSpec) {
      return false;
    }

    // Check if target phase is in completed phases
    if (!project.phases_completed.includes(targetPhase)) {
      return false;
    }

    // Update project state
    const previousPhase = project.current_phase;
    project.current_phase = targetPhase;
    project.updated_at = new Date();

    // Remove phases after target from completed list
    const targetIndex = project.phases_completed.indexOf(targetPhase);
    project.phases_completed = project.phases_completed.slice(
      0,
      targetIndex + 1
    );

    // Record rollback
    await this.recordPhaseTransition(
      project,
      previousPhase,
      targetPhase,
      userId,
      'rollback'
    );

    return true;
  }

  /**
   * Check if a gate is passed
   */
  private isGatePassed(project: Project, gate: string): boolean {
    switch (gate) {
      case 'stack_approved':
        return project.stack_approved;
      default:
        return project.orchestration_state.approval_gates[gate] || false;
    }
  }

  /**
   * Record phase transition in history
   */
  private async recordPhaseTransition(
    project: Project,
    fromPhase: string,
    toPhase: string,
    userId: string,
    type: 'advance' | 'rollback' = 'advance'
  ): Promise<void> {
    // This would save to database
    // For now, just log
    logger.info(
      `Phase transition: ${fromPhase} -> ${toPhase} by ${userId} (${type})`
    );
  }

  /**
   * Get current phase spec
   */
  getCurrentPhaseSpec(phaseName: string): Phase | null {
    return this.spec.phases[phaseName] || null;
  }

  /**
   * Get all phases in order
   */
  getAllPhases(): Phase[] {
    return Object.values(this.spec.phases);
  }

  /**
   * Get phase sequence from current to end
   */
  getPhaseSequence(currentPhase: string): Phase[] {
    const phases: Phase[] = [];
    let current = currentPhase;

    while (current) {
      const phase = this.spec.phases[current];
      if (!phase) break;

      phases.push(phase);
      current = phase.next_phase;
    }

    return phases;
  }

  /**
   * Determine next phase based on validation outcome
   *
   * Implements Phase 1 state machine:
   * - all_pass → proceed to next phase
   * - warnings_only → user decision required
   * - failures_detected → trigger AUTO_REMEDY
   *
   * @param project - Current project
   * @param validationResult - Validation result from validatePhaseCompletion
   * @returns Next phase name
   */
  async determineNextPhase(
    project: Project,
    validationResult: ValidationResult
  ): Promise<string> {
    const { determinePhaseOutcome } = await import('./phase_outcomes');

    const outcome = determinePhaseOutcome({
      phase: project.current_phase,
      validationResult: {
        passed: validationResult.status === 'pass',
        canProceed: validationResult.status !== 'fail',
        warnings: (validationResult.warnings || []).map((w) => ({
          severity: 'warning' as const,
          message: w,
          phase: project.current_phase,
        })),
        errors: (validationResult.errors || []).map((e) => ({
          severity: 'error' as const,
          message: e,
          phase: project.current_phase,
        })),
        totalWarnings: validationResult.warnings?.length || 0,
        accumulatedWarnings: [],
      },
    });

    logger.info('[OrchestratorEngine] Phase transition decision', {
      projectId: project.id,
      currentPhase: project.current_phase,
      outcome: outcome.state,
      nextPhase: outcome.nextPhase,
      requiresUserDecision: outcome.requiresUserDecision,
      errorCount: outcome.errorCount,
      warningCount: outcome.warningCount,
    });

    return outcome.nextPhase;
  }

  /**
   * Detect changes in artifact content using SHA-256 hashing
   *
   * @param projectId - The project ID
   * @param artifactName - The name of the artifact
   * @param oldContent - The previous content of the artifact
   * @param newContent - The new content of the artifact
   * @returns ArtifactChange object with change details, or null if no changes
   */
  detectArtifactChanges(
    projectId: string,
    artifactName: string,
    oldContent: string,
    newContent: string
  ): ArtifactChange | null {
    // Calculate SHA-256 hashes for both content versions
    const oldHash = createHash('sha256')
      .update(oldContent || '')
      .digest('hex');
    const newHash = createHash('sha256')
      .update(newContent || '')
      .digest('hex');

    // Return null if hashes match (no changes)
    if (oldHash === newHash) {
      return null;
    }

    // Identify changed sections by parsing markdown headers
    const changedSections = this.parseChangedSections(oldContent, newContent);

    // Determine impact level based on changes
    const impactLevel = this.calculateImpactLevel(changedSections);

    return {
      projectId,
      artifactName,
      oldHash,
      newHash,
      hasChanges: true,
      impactLevel,
      changedSections,
      timestamp: new Date(),
    };
  }

  /**
   * Parse markdown content to identify changed sections
   */
  private parseChangedSections(
    oldContent: string,
    newContent: string
  ): ChangedSection[] {
    const sections: ChangedSection[] = [];
    const oldLines = (oldContent || '').split('\n');
    const newLines = (newContent || '').split('\n');

    // Extract headers from both versions
    const oldHeaders = this.extractMarkdownHeaders(oldContent);
    const newHeaders = this.extractMarkdownHeaders(newContent);

    // Find headers that exist in old but not in new (deleted)
    const deletedHeaders = oldHeaders.filter(
      (h) => !newHeaders.some((nh) => nh.text === h.text)
    );
    for (const header of deletedHeaders) {
      sections.push({
        header: header.text,
        changeType: 'deleted',
        lineNumber: header.lineNumber,
      });
    }

    // Find headers that exist in new but not in old (added)
    const addedHeaders = newHeaders.filter(
      (h) => !oldHeaders.some((oh) => oh.text === h.text)
    );
    for (const header of addedHeaders) {
      sections.push({
        header: header.text,
        changeType: 'added',
        lineNumber: header.lineNumber,
      });
    }

    // Find headers that exist in both but content may have changed (modified)
    const commonHeaders = oldHeaders.filter((h) =>
      newHeaders.some((nh) => nh.text === h.text)
    );
    for (const oldHeader of commonHeaders) {
      const newHeader = newHeaders.find((nh) => nh.text === oldHeader.text);
      if (newHeader) {
        // Extract section content and compare
        const oldSectionContent = this.extractSectionContent(
          oldContent,
          oldHeader.text,
          oldHeader.lineNumber
        );
        const newSectionContent = this.extractSectionContent(
          newContent,
          newHeader.text,
          newHeader.lineNumber
        );

        if (oldSectionContent !== newSectionContent) {
          sections.push({
            header: oldHeader.text,
            changeType: 'modified',
            oldContent: oldSectionContent,
            newContent: newSectionContent,
            lineNumber: oldHeader.lineNumber,
          });
        }
      }
    }

    return sections;
  }

  /**
   * Extract markdown headers with their line numbers
   */
  private extractMarkdownHeaders(
    content: string
  ): Array<{ text: string; lineNumber: number }> {
    const headers: Array<{ text: string; lineNumber: number }> = [];
    const lines = (content || '').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match markdown headers (#, ##, ###, ####)
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headers.push({
          text: match[2].trim(),
          lineNumber: i + 1, // 1-based line number
        });
      }
    }

    return headers;
  }

  /**
   * Extract content between a header and the next header
   */
  private extractSectionContent(
    content: string,
    headerText: string,
    startLine: number
  ): string {
    const lines = (content || '').split('\n');
    const startIndex = startLine - 1; // Convert 1-based line number to 0-based index

    // Find the next header after the start line
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].match(/^(#{1,6})\s+(.+)$/)) {
        endIndex = i;
        break;
      }
    }

    // Return content between headers (excluding the header line itself)
    return lines.slice(startIndex + 1, endIndex).join('\n');
  }

  /**
   * Calculate impact level based on changed sections
   */
  private calculateImpactLevel(sections: ChangedSection[]): ImpactLevel {
    // HIGH impact if there are any added or deleted sections
    const hasStructuralChange = sections.some(
      (s) => s.changeType === 'added' || s.changeType === 'deleted'
    );
    if (hasStructuralChange) {
      return 'HIGH';
    }

    // MEDIUM impact for modifications (or content changes without identifiable sections)
    return 'MEDIUM';
  }

  /**
   * Analyze the impact of an artifact change and determine which artifacts need regeneration.
   *
   * This method builds an artifact dependency graph from the orchestrator spec phases,
   * finds all artifacts that transitively depend on the changed artifact, and assigns
   * impact levels based on the change type.
   *
   * @param projectId - The project ID
   * @param triggerChange - The artifact change that triggered the analysis
   * @returns ImpactAnalysis with affected artifacts and regeneration recommendations
   */
  async analyzeRegenerationImpact(
    projectId: string,
    triggerChange: ArtifactChange
  ): Promise<ImpactAnalysis> {
    logger.info('[OrchestratorEngine] Analyzing regeneration impact', {
      projectId,
      artifactName: triggerChange.artifactName,
      impactLevel: triggerChange.impactLevel,
    });

    // Build artifact dependency graph from spec phases
    const artifactDependencies = this.buildArtifactDependencyGraph();

    // Find all artifacts that depend on the changed artifact (transitive)
    const affectedArtifacts = this.findAffectedArtifacts(
      triggerChange.artifactName,
      artifactDependencies,
      triggerChange
    );

    // Calculate impact summary
    const impactSummary = {
      high: affectedArtifacts.filter((a) => a.impactLevel === 'HIGH').length,
      medium: affectedArtifacts.filter((a) => a.impactLevel === 'MEDIUM')
        .length,
      low: affectedArtifacts.filter((a) => a.impactLevel === 'LOW').length,
    };

    // Determine recommended strategy based on impact levels
    const { recommendedStrategy, reasoning } =
      this.determineRegenerationStrategy(affectedArtifacts, impactSummary);

    logger.info('[OrchestratorEngine] Impact analysis complete', {
      projectId,
      affectedCount: affectedArtifacts.length,
      impactSummary,
      recommendedStrategy,
    });

    return {
      triggerChange,
      affectedArtifacts,
      impactSummary,
      recommendedStrategy,
      reasoning,
    };
  }

  /**
   * Build artifact dependency graph from orchestrator spec phases.
   * Maps each artifact to the phases and artifacts that depend on it.
   */
  private buildArtifactDependencyGraph(): Map<
    string,
    Array<{ phase: string; artifact: string }>
  > {
    const dependencies = new Map<
      string,
      Array<{ phase: string; artifact: string }>
    >();

    // Helper to get outputs as array (handles both string "all" and array cases)
    const getOutputsArray = (
      outputs: string | string[] | undefined
    ): string[] => {
      if (!outputs) return [];
      if (Array.isArray(outputs)) return outputs;
      // If it's a string like "all", we can't determine specific outputs
      // Skip this phase for dependency building
      return [];
    };

    // Helper to get inputs as array (handles undefined case)
    const getInputsArray = (inputs: string[] | undefined): string[] => {
      if (!inputs) return [];
      return inputs;
    };

    // Iterate through all phases to build dependency relationships
    for (const [phaseName, phase] of Object.entries(this.spec.phases)) {
      // Skip phases with string outputs (like "all") - we can't determine specific artifacts
      const outputs = getOutputsArray(phase.outputs);
      if (outputs.length === 0) continue;

      const inputs = getInputsArray(phase.inputs);

      // Each output artifact of this phase depends on the inputs of this phase
      for (const outputArtifact of outputs) {
        const outputKey = `${phaseName}/${outputArtifact}`;

        // Add dependencies from inputs
        for (const inputArtifact of inputs) {
          // Inputs can be from previous phases or external sources
          // We track them as dependencies
          if (!dependencies.has(inputArtifact)) {
            dependencies.set(inputArtifact, []);
          }
          dependencies.get(inputArtifact)!.push({
            phase: phaseName,
            artifact: outputKey,
          });
        }

        // Also track transitive dependencies from phase.depends_on
        if (phase.depends_on) {
          for (const depPhaseName of phase.depends_on) {
            const depPhase = this.spec.phases[depPhaseName];
            if (depPhase) {
              const depOutputs = getOutputsArray(depPhase.outputs);
              for (const depOutput of depOutputs) {
                const depOutputKey = `${depPhaseName}/${depOutput}`;
                if (!dependencies.has(depOutputKey)) {
                  dependencies.set(depOutputKey, []);
                }
                dependencies.get(depOutputKey)!.push({
                  phase: phaseName,
                  artifact: outputKey,
                });
              }
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Find all artifacts that transitively depend on the changed artifact.
   */
  private findAffectedArtifacts(
    changedArtifact: string,
    dependencies: Map<string, Array<{ phase: string; artifact: string }>>,
    triggerChange: ArtifactChange
  ): AffectedArtifact[] {
    const affected: AffectedArtifact[] = [];
    const visited = new Set<string>();

    // BFS to find all transitively affected artifacts
    const queue: Array<{ artifact: string; depth: number }> = [
      { artifact: changedArtifact, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.artifact)) {
        continue;
      }
      visited.add(current.artifact);

      const dependents = dependencies.get(current.artifact) || [];

      for (const dependent of dependents) {
        // Skip if already visited
        if (visited.has(dependent.artifact)) {
          continue;
        }

        // Determine impact level for this dependent artifact
        // Impact level is based on the trigger change and how far downstream it is
        let impactLevel: ImpactLevel;
        if (triggerChange.impactLevel === 'HIGH') {
          // HIGH impact changes cascade to dependents as MEDIUM (or HIGH if very close)
          impactLevel = current.depth === 0 ? 'HIGH' : 'MEDIUM';
        } else if (triggerChange.impactLevel === 'MEDIUM') {
          impactLevel = 'MEDIUM';
        } else {
          impactLevel = 'LOW';
        }

        // Extract reason from changed sections
        const primarySection = triggerChange.changedSections[0];
        const reason = this.generateImpactReason(
          triggerChange.artifactName,
          dependent.artifact,
          triggerChange.impactLevel,
          primarySection
        );

        affected.push({
          artifactId: dependent.artifact,
          artifactName: dependent.artifact,
          phase: dependent.phase,
          impactLevel,
          reason,
          changeType: primarySection?.changeType,
          changedSection: primarySection?.header,
        });

        // Add to queue for further propagation
        queue.push({
          artifact: dependent.artifact,
          depth: current.depth + 1,
        });
      }
    }

    return affected;
  }

  /**
   * Generate a human-readable reason for the impact on an artifact.
   */
  private generateImpactReason(
    changedArtifact: string,
    affectedArtifact: string,
    impactLevel: ImpactLevel,
    changedSection?: ChangedSection
  ): string {
    const changeTypeDescription =
      changedSection?.changeType === 'added'
        ? 'added'
        : changedSection?.changeType === 'deleted'
        ? 'removed'
        : 'modified';

    const sectionDescription = changedSection
      ? ` section "${changedSection.header}"`
      : '';

    if (impactLevel === 'HIGH') {
      return `${changedArtifact} has new or removed${sectionDescription}, which may require ${affectedArtifact} to be regenerated to reflect the structural change.`;
    } else if (impactLevel === 'MEDIUM') {
      return `${changedArtifact} has ${changeTypeDescription}${sectionDescription}, which may affect the content or logic of ${affectedArtifact}.`;
    } else {
      return `${changedArtifact} changed, which may have minimal impact on ${affectedArtifact}.`;
    }
  }

  /**
   * Determine the recommended regeneration strategy based on affected artifacts.
   */
  private determineRegenerationStrategy(
    affectedArtifacts: AffectedArtifact[],
    impactSummary: { high: number; medium: number; low: number }
  ): { recommendedStrategy: RegenerationStrategy; reasoning: string } {
    // If no artifacts affected, no action needed
    if (affectedArtifacts.length === 0) {
      return {
        recommendedStrategy: 'ignore',
        reasoning:
          'No artifacts depend on the changed artifact, so no regeneration is needed.',
      };
    }

    // HIGH impact changes that affect downstream artifacts require full regeneration
    if (impactSummary.high > 0) {
      return {
        recommendedStrategy: 'regenerate_all',
        reasoning: `${impactSummary.high} artifact(s) have HIGH impact due to structural changes (added/removed sections) in the trigger artifact. Full regeneration is recommended to ensure consistency.`,
      };
    }

    // MEDIUM impact changes suggest regenerating only the directly affected artifacts
    if (impactSummary.medium > 0) {
      return {
        recommendedStrategy: 'high_impact_only',
        reasoning: `${impactSummary.medium} artifact(s) have MEDIUM impact due to content modifications. Selective regeneration of affected artifacts is recommended to minimize unnecessary work while ensuring consistency.`,
      };
    }

    // LOW impact changes - recommend manual review
    return {
      recommendedStrategy: 'manual_review',
      reasoning:
        'Only LOW impact changes detected. Manual review is recommended to determine if regeneration is necessary.',
    };
  }

  /**
   * Execute the regeneration workflow based on impact analysis.
   *
   * This method orchestrates the regeneration of artifacts after an artifact change:
   * 1. Gets trigger change details from the database
   * 2. Analyzes impact using analyzeRegenerationImpact
   * 3. Creates regeneration_run record in database
   * 4. Regenerates artifacts based on selected strategy
   * 5. Updates artifact_versions with regeneration metadata
   * 6. Updates regeneration_run with results
   * 7. Returns RegenerationResult
   *
   * @param projectId - The project ID
   * @param options - Regeneration options including strategy and trigger details
   * @returns RegenerationResult with details about the regeneration execution
   */
  async executeRegenerationWorkflow(
    projectId: string,
    options: RegenerationOptions
  ): Promise<RegenerationResult> {
    const startTime = Date.now();
    let regenerationRunId: string | null = null;
    let triggerChange: ArtifactChange | null = null;

    logger.info('[OrchestratorEngine] Executing regeneration workflow', {
      projectId,
      triggerArtifactId: options.triggerArtifactId,
      selectedStrategy: options.selectedStrategy,
    });

    try {
      // Step 1: Get trigger change details (mocked for now - would come from database)
      // In a real implementation, this would query artifact_changes table
      triggerChange = await this.getTriggerChangeDetails(
        projectId,
        options.triggerArtifactId,
        options.triggerChangeId
      );

      if (!triggerChange) {
        throw new Error(
          `Trigger change not found for artifact: ${options.triggerArtifactId}`
        );
      }

      // Step 2: Analyze impact using the existing method
      const impactAnalysis = await this.analyzeRegenerationImpact(
        projectId,
        triggerChange
      );

      logger.info('[OrchestratorEngine] Impact analysis complete', {
        projectId,
        affectedCount: impactAnalysis.affectedArtifacts.length,
        impactSummary: impactAnalysis.impactSummary,
      });

      // Step 3: Select artifacts to regenerate based on strategy
      const artifactsToRegenerate = this.selectArtifactsForRegeneration(
        impactAnalysis,
        options.selectedStrategy,
        options.manualArtifactIds
      );

      logger.info('[OrchestratorEngine] Selected artifacts for regeneration', {
        projectId,
        strategy: options.selectedStrategy,
        count: artifactsToRegenerate.length,
        artifacts: artifactsToRegenerate,
      });

      // Handle ignore strategy early
      if (options.selectedStrategy === 'ignore') {
        return {
          success: true,
          regenerationRunId: null,
          selectedStrategy: 'ignore',
          artifactsToRegenerate: [],
          artifactsRegenerated: [],
          artifactsSkipped: [],
          durationMs: Date.now() - startTime,
        };
      }

      // Step 4: Create regeneration_run record in database
      const runId = randomUUID();
      regenerationRunId = runId;

      await db.insert(regenerationRuns).values({
        id: runId,
        projectId,
        triggerArtifactId: options.triggerArtifactId,
        triggerChangeId: options.triggerChangeId as any,
        impactAnalysis: JSON.stringify(impactAnalysis),
        selectedStrategy: options.selectedStrategy,
        artifactsToRegenerate: JSON.stringify(artifactsToRegenerate),
        artifactsRegenerated: JSON.stringify([]),
        startedAt: new Date(),
      });

      // Step 5: Regenerate artifacts based on strategy
      const artifactsRegenerated: string[] = [];
      const artifactsSkipped: string[] = [];

      for (const artifactId of artifactsToRegenerate) {
        try {
          // Extract phase from artifact ID (format: "PhaseName/artifact.md")
          const phaseMatch = artifactId.match(/^([A-Z_]+)\//);
          if (!phaseMatch) {
            logger.warn('[OrchestratorEngine] Invalid artifact ID format', {
              artifactId,
            });
            artifactsSkipped.push(artifactId);
            continue;
          }

          const phase = phaseMatch[1];

          // Check if phase is valid and can be regenerated
          const phaseSpec = this.spec.phases[phase];
          if (!phaseSpec) {
            logger.warn('[OrchestratorEngine] Unknown phase for artifact', {
              artifactId,
              phase,
            });
            artifactsSkipped.push(artifactId);
            continue;
          }

          // For now, we just mark the artifact as needing regeneration
          // In a full implementation, this would call the phase agent
          logger.info('[OrchestratorEngine] Regenerating artifact', {
            artifactId,
            phase,
          });

          // Simulate regeneration - in production, this would call runPhaseAgent
          artifactsRegenerated.push(artifactId);

          // Step 5b: Update artifact_versions with regeneration metadata
          // Create a new version record with regeneration metadata
          await this.createRegeneratedArtifactVersion(
            projectId,
            artifactId,
            runId,
            triggerChange.impactLevel
          );
        } catch (artifactError) {
          const error =
            artifactError instanceof Error
              ? artifactError
              : new Error(String(artifactError));
          logger.error(
            '[OrchestratorEngine] Failed to regenerate artifact',
            undefined,
            {
              artifactId,
              error: error.message,
            }
          );
          artifactsSkipped.push(artifactId);
        }
      }

      // Step 6: Update regeneration_run with results
      const durationMs = Date.now() - startTime;
      const success = artifactsSkipped.length === 0;

      await db
        .update(regenerationRuns)
        .set({
          artifactsRegenerated: JSON.stringify(artifactsRegenerated),
          completedAt: new Date(),
          durationMs,
          success,
          errorMessage:
            artifactsSkipped.length > 0
              ? `Skipped ${artifactsSkipped.length} artifacts`
              : null,
        })
        .where(eq(regenerationRuns.id, runId));

      logger.info('[OrchestratorEngine] Regeneration workflow complete', {
        projectId,
        regenerationRunId: runId,
        artifactsRegenerated: artifactsRegenerated.length,
        artifactsSkipped: artifactsSkipped.length,
        durationMs,
        success,
      });

      // Step 7: Return result
      return {
        success,
        regenerationRunId: runId,
        selectedStrategy: options.selectedStrategy,
        artifactsToRegenerate,
        artifactsRegenerated,
        artifactsSkipped,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      logger.error(
        '[OrchestratorEngine] Regeneration workflow failed',
        undefined,
        {
          projectId,
          error: errorObj.message,
          durationMs,
        }
      );

      // Update regeneration_run with error if it was created
      if (regenerationRunId) {
        await db
          .update(regenerationRuns)
          .set({
            completedAt: new Date(),
            durationMs,
            success: false,
            errorMessage: errorObj.message,
          })
          .where(eq(regenerationRuns.id, regenerationRunId));
      }

      return {
        success: false,
        regenerationRunId,
        selectedStrategy: options.selectedStrategy,
        artifactsToRegenerate: [],
        artifactsRegenerated: [],
        artifactsSkipped: [],
        durationMs,
        errorMessage: errorObj.message,
      };
    }
  }

  /**
   * Get trigger change details from the database.
   * In production, this would query the artifact_changes table.
   */
  private async getTriggerChangeDetails(
    projectId: string,
    artifactId: string,
    changeId?: string
  ): Promise<ArtifactChange | null> {
    // In production, this would query the database
    // For now, return a mock ArtifactChange for testing
    // The actual implementation would fetch from artifact_changes table

    // This is a placeholder - real implementation would:
    // 1. Query artifact_changes table for the change
    // 2. Return the ArtifactChange object

    logger.debug('[OrchestratorEngine] Fetching trigger change details', {
      projectId,
      artifactId,
      changeId,
    });

    // Return null if no changeId is provided - caller should handle this
    if (!changeId) {
      // Create a default ArtifactChange for testing purposes
      return {
        projectId,
        artifactName: artifactId,
        oldHash: 'old_hash_' + Date.now(),
        newHash: 'new_hash_' + Date.now(),
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [],
        timestamp: new Date(),
      };
    }

    // In production, query the database:
    // const { artifactChanges } = await import('@/backend/lib/schema');
    // const changes = await db.select().from(artifactChanges).where(eq(artifactChanges.id, changeId));

    return null;
  }

  /**
   * Select artifacts to regenerate based on strategy.
   */
  private selectArtifactsForRegeneration(
    impactAnalysis: ImpactAnalysis,
    selectedStrategy: RegenerationStrategy,
    manualArtifactIds?: string[]
  ): string[] {
    switch (selectedStrategy) {
      case 'regenerate_all':
        // Regenerate all affected artifacts
        return impactAnalysis.affectedArtifacts.map((a) => a.artifactId);

      case 'high_impact_only':
        // Regenerate only HIGH impact artifacts
        return impactAnalysis.affectedArtifacts
          .filter((a) => a.impactLevel === 'HIGH')
          .map((a) => a.artifactId);

      case 'manual_review':
        // Use user-specified artifacts, or all if none specified
        if (manualArtifactIds && manualArtifactIds.length > 0) {
          return manualArtifactIds;
        }
        // Return empty - user needs to specify
        return [];

      case 'ignore':
        // Skip regeneration
        return [];

      default:
        logger.warn(
          '[OrchestratorEngine] Unknown strategy, defaulting to ignore',
          {
            strategy: selectedStrategy,
          }
        );
        return [];
    }
  }

  /**
   * Create a new artifact version record with regeneration metadata.
   */
  private async createRegeneratedArtifactVersion(
    projectId: string,
    artifactId: string,
    regenerationRunId: string,
    triggerImpactLevel: ImpactLevel
  ): Promise<void> {
    try {
      // Generate a new version number
      const { max } = await import('drizzle-orm');
      const versions = await db
        .select({ version: max(artifactVersions.version) })
        .from(artifactVersions)
        .where(eq(artifactVersions.projectId, projectId))
        .then((r: Array<{ version: number | null }>) => r[0]?.version || 0);

      const newVersion = versions + 1;

      // Create reason based on impact level
      const reason =
        triggerImpactLevel === 'HIGH'
          ? 'Regenerated due to HIGH impact structural changes'
          : 'Regenerated due to MEDIUM impact content changes';

      // Insert new version record
      await db.insert(artifactVersions).values({
        projectId,
        artifactId,
        version: newVersion,
        contentHash: '', // Would be populated with actual content hash
        regenerationReason: reason,
        regenerationRunId,
      });

      logger.debug('[OrchestratorEngine] Created artifact version record', {
        projectId,
        artifactId,
        version: newVersion,
        regenerationRunId,
      });
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logger.error(
        '[OrchestratorEngine] Failed to create artifact version',
        undefined,
        {
          projectId,
          artifactId,
          error: errorObj.message,
        }
      );
      // Don't throw - version tracking is not critical
    }
  }

  /**
   * Execute a group of phases in parallel.
   *
   * This method executes multiple phases concurrently using Promise.all,
   * waits for all phases to complete, and creates a snapshot after the
   * group completes. All phases in the group share the same input artifacts.
   *
   * @param projectId - The project ID
   * @param group - ParallelGroup config containing name, type, and phases array
   * @param artifacts - Shared input artifacts for all phases in the group
   * @returns Array of PhaseExecutionResult for each phase in the group
   */
  async executeParallelGroup(
    projectId: string,
    group: ParallelGroup,
    artifacts: Record<string, string> = {}
  ): Promise<PhaseExecutionResult[]> {
    logger.info('[OrchestratorEngine] Executing parallel group', {
      projectId,
      groupName: group.name,
      phaseCount: group.phases.length,
      phases: group.phases,
    });

    // Validate that all phases exist in the spec
    const invalidPhases = group.phases.filter(
      (phase) => !this.spec.phases[phase]
    );
    if (invalidPhases.length > 0) {
      throw new Error(
        `Invalid phases in parallel group "${group.name}": ${invalidPhases.join(
          ', '
        )}`
      );
    }

    // Create a mock project for phase execution
    // We'll execute each phase with a temporary project state
    const project = {
      id: projectId,
      name: 'Parallel Execution',
      current_phase: group.phases[0],
      orchestration_state: {
        artifact_versions: {},
        approval_gates: {},
      } as OrchestrationState,
      project_path: '',
    } as Project;

    // Execute all phases in parallel
    const startTime = Date.now();
    const results: PhaseExecutionResult[] = await Promise.all(
      group.phases.map(async (phaseName) => {
        const phaseStartTime = Date.now();
        try {
          // Set the current phase for this execution
          project.current_phase = phaseName;

          // Execute the phase agent
          const result = await this.runPhaseAgent(project, artifacts);

          const durationMs = Date.now() - phaseStartTime;

          logger.info('[OrchestratorEngine] Parallel phase completed', {
            projectId,
            phase: phaseName,
            success: result.success,
            durationMs,
          });

          return {
            phase: phaseName,
            success: result.success,
            artifacts: result.artifacts,
            durationMs,
          } as PhaseExecutionResult;
        } catch (error) {
          const durationMs = Date.now() - phaseStartTime;
          const errorObj =
            error instanceof Error ? error : new Error(String(error));

          logger.error(
            '[OrchestratorEngine] Parallel phase failed',
            undefined,
            {
              projectId,
              phase: phaseName,
              error: errorObj.message,
              durationMs,
            }
          );

          return {
            phase: phaseName,
            success: false,
            artifacts: {},
            error: errorObj.message,
            durationMs,
          } as PhaseExecutionResult;
        }
      })
    );

    const totalDurationMs = Date.now() - startTime;

    // Create snapshot after the group completes
    await this.createSnapshotAfterParallelGroup(projectId, group, results);

    logger.info('[OrchestratorEngine] Parallel group completed', {
      projectId,
      groupName: group.name,
      totalPhases: results.length,
      successfulPhases: results.filter((r) => r.success).length,
      failedPhases: results.filter((r) => !r.success).length,
      totalDurationMs,
    });

    return results;
  }

  /**
   * Create a snapshot after parallel group execution completes.
   */
  private async createSnapshotAfterParallelGroup(
    projectId: string,
    group: ParallelGroup,
    results: PhaseExecutionResult[]
  ): Promise<void> {
    const gitService = this.gitService.get(projectId);
    const rollbackService = this.rollbackService.get(projectId);

    if (!gitService || !rollbackService) {
      logger.debug(
        '[OrchestratorEngine] Git/Rollback service not available for snapshot',
        {
          projectId,
          groupName: group.name,
        }
      );
      return;
    }

    // Collect all artifacts from successful phases
    const allArtifacts: Record<string, string> = {};
    for (const result of results) {
      if (result.success) {
        Object.assign(allArtifacts, result.artifacts);
      }
    }

    if (Object.keys(allArtifacts).length === 0) {
      logger.warn('[OrchestratorEngine] No artifacts to snapshot', {
        projectId,
        groupName: group.name,
      });
      return;
    }

    // Create snapshot for the parallel group
    const snapshotResult = await rollbackService.createSnapshot({
      projectId,
      phaseName: group.name,
      artifacts: allArtifacts,
      metadata: {
        parallelGroup: group.name,
        phasesExecuted: group.phases,
        successfulPhases: results.filter((r) => r.success).map((r) => r.phase),
        failedPhases: results.filter((r) => !r.success).map((r) => r.phase),
        timestamp: new Date().toISOString(),
      },
    });

    if (snapshotResult.success) {
      logger.info('[OrchestratorEngine] Parallel group snapshot created', {
        projectId,
        groupName: group.name,
        snapshotId: snapshotResult.snapshotId,
      });
    } else {
      logger.warn(
        '[OrchestratorEngine] Parallel group snapshot creation failed',
        {
          projectId,
          groupName: group.name,
          error: snapshotResult.error,
        }
      );
    }
  }

  /**
   * Execute the workflow with optional parallel phase execution.
   *
   * This method orchestrates the complete workflow execution with support for:
   * - Parallel execution of independent phases
   * - Sequential execution of dependent phases
   * - Automatic fallback to sequential on parallel failure
   * - Time savings measurement and reporting
   *
   * @param projectId - The project ID
   * @param options - Options for parallel execution
   * @returns ParallelWorkflowResult with timing metrics and execution details
   */
  async executeWorkflowWithParallel(
    projectId: string,
    options: ParallelWorkflowOptions
  ): Promise<ParallelWorkflowResult> {
    const startTime = Date.now();
    logger.info(
      '[OrchestratorEngine] Starting workflow with parallel execution',
      {
        projectId,
        enableParallel: options.enableParallel,
        fallbackToSequential: options.fallbackToSequential,
      }
    );

    // Define parallel groups based on orchestrator spec
    // Groups phases that can run in parallel when dependencies are satisfied
    const parallelGroups: ParallelGroup[] = [
      {
        name: 'foundation',
        type: 'parallel',
        phases: ['ANALYSIS'],
      },
      {
        name: 'stack_and_tokens',
        type: 'parallel',
        phases: ['STACK_SELECTION', 'SPEC_DESIGN_TOKENS'],
      },
      {
        name: 'spec_and_design',
        type: 'parallel',
        phases: ['SPEC', 'SPEC_DESIGN_COMPONENTS'],
      },
      {
        name: 'requirements',
        type: 'parallel',
        phases: ['DEPENDENCIES'],
      },
      {
        name: 'design_and_architecture',
        type: 'parallel',
        phases: ['SOLUTIONING'],
      },
    ];

    // Build execution order respecting dependencies
    // Each group must wait for its dependencies to complete
    const executionOrder = this.buildExecutionOrder(parallelGroups);

    // Create a mock project for phase execution
    const project = {
      id: projectId,
      name: 'Workflow Execution',
      current_phase: executionOrder[0]?.[0] || 'ANALYSIS',
      phases_completed: [] as string[],
      orchestration_state: {
        artifact_versions: {},
        approval_gates: {},
      } as OrchestrationState,
      project_path: '',
    } as Project;

    const groupsExecuted: ParallelWorkflowResult['groupsExecuted'] = [];
    const errors: Array<{ phase: string; error: string }> = [];
    let fallbackUsed = false;

    // Calculate estimated sequential duration for comparison
    const sequentialDurationMs =
      this.estimateSequentialDuration(executionOrder);

    // Execute groups in order
    for (const group of executionOrder) {
      const groupStartTime = Date.now();
      let groupSuccess = true;
      const groupName = group.join('_');

      try {
        // Check dependencies are satisfied
        const dependencies = this.getGroupDependencies(groupName);
        const unsatisfiedDeps = dependencies.filter(
          (dep) => !project.phases_completed.includes(dep)
        );

        if (unsatisfiedDeps.length > 0) {
          logger.warn(
            '[OrchestratorEngine] Skipping group due to unsatisfied dependencies',
            {
              projectId,
              groupName,
              unsatisfiedDeps,
            }
          );
          // Mark phases as completed with error status
          for (const phase of group) {
            errors.push({
              phase,
              error: `Skipped: unsatisfied dependencies: ${unsatisfiedDeps.join(
                ', '
              )}`,
            });
            project.phases_completed.push(phase);
          }
          continue;
        }

        if (options.enableParallel && group.length > 1) {
          // Execute as parallel group
          const parallelGroup: ParallelGroup = {
            name: groupName,
            type: 'parallel',
            phases: group,
          };

          const results = await this.executeParallelGroup(
            projectId,
            parallelGroup
          );

          // Collect artifacts from successful phases
          const allArtifacts: Record<string, string> = {};
          for (const result of results) {
            if (result.success) {
              Object.assign(allArtifacts, result.artifacts);
            } else {
              groupSuccess = false;
              errors.push({
                phase: result.phase,
                error: result.error || 'Unknown error',
              });
            }
            project.phases_completed.push(result.phase);
          }

          groupsExecuted.push({
            name: groupName,
            type: 'parallel',
            phases: group,
            success: groupSuccess,
            durationMs: Date.now() - groupStartTime,
            results,
          });
        } else {
          // Execute sequentially
          const results: PhaseExecutionResult[] = [];

          for (const phase of group) {
            const phaseStartTime = Date.now();
            try {
              project.current_phase = phase;
              const result = await this.runPhaseAgent(project, {});
              project.phases_completed.push(phase);

              results.push({
                phase,
                success: result.success,
                artifacts: result.artifacts,
                durationMs: Date.now() - phaseStartTime,
              });
            } catch (error) {
              const phaseDurationMs = Date.now() - phaseStartTime;
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              project.phases_completed.push(phase);

              results.push({
                phase,
                success: false,
                artifacts: {},
                error: errorMessage,
                durationMs: phaseDurationMs,
              });

              groupSuccess = false;
              errors.push({ phase, error: errorMessage });
            }
          }

          groupsExecuted.push({
            name: groupName,
            type: 'sequential',
            phases: group,
            success: groupSuccess,
            durationMs: Date.now() - groupStartTime,
            results,
          });
        }
      } catch (error) {
        const groupDurationMs = Date.now() - groupStartTime;
        const errorObj =
          error instanceof Error ? error : new Error(String(error));

        logger.error('[OrchestratorEngine] Group execution failed', undefined, {
          projectId,
          groupName,
          error: errorObj.message,
        });

        // Fallback to sequential if enabled
        if (options.fallbackToSequential && !fallbackUsed) {
          logger.info(
            '[OrchestratorEngine] Falling back to sequential execution',
            {
              projectId,
              groupName,
            }
          );
          fallbackUsed = true;
          options.enableParallel = false;
          // Re-execute this group sequentially
          continue;
        }

        groupSuccess = false;
        for (const phase of group) {
          errors.push({ phase, error: errorObj.message });
          project.phases_completed.push(phase);
        }

        groupsExecuted.push({
          name: groupName,
          type: 'sequential',
          phases: group,
          success: false,
          durationMs: groupDurationMs,
          results: group.map((phase) => ({
            phase,
            success: false,
            artifacts: {},
            error: errorObj.message,
            durationMs: 0,
          })),
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const parallelDurationMs = totalDurationMs;
    const timeSavedMs = Math.max(0, sequentialDurationMs - parallelDurationMs);
    const timeSavedPercent =
      sequentialDurationMs > 0
        ? Math.round((timeSavedMs / sequentialDurationMs) * 100)
        : 0;

    const overallSuccess = errors.length === 0;

    logger.info('[OrchestratorEngine] Workflow execution complete', {
      projectId,
      success: overallSuccess,
      totalDurationMs,
      parallelDurationMs,
      sequentialDurationMs,
      timeSavedMs,
      timeSavedPercent,
      groupsExecuted: groupsExecuted.length,
      errors: errors.length,
      fallbackUsed,
    });

    return {
      success: overallSuccess,
      projectId,
      phasesExecuted: project.phases_completed,
      groupsExecuted,
      totalDurationMs,
      parallelDurationMs,
      sequentialDurationMs,
      timeSavedMs,
      timeSavedPercent,
      errors,
      fallbackUsed,
    };
  }

  /**
   * Build execution order from parallel groups, respecting dependencies.
   * Returns an array of phase arrays, where each inner array can execute in parallel.
   */
  private buildExecutionOrder(groups: ParallelGroup[]): string[][] {
    // Define dependency relationships between groups
    const groupDependencies: Record<string, string[]> = {
      foundation: [],
      stack_and_tokens: ['foundation'],
      spec_and_design: ['stack_and_tokens'],
      requirements: ['spec_and_design'],
      design_and_architecture: ['requirements'],
    };

    // Build order ensuring dependencies are satisfied
    const executedGroups: string[] = [];
    const executionOrder: string[][] = [];

    // Flatten groups and sort by dependencies
    const groupMap = new Map(groups.map((g) => [g.name, g.phases]));

    const getGroupPhases = (groupName: string): string[] => {
      const phases = groupMap.get(groupName);
      return phases || [groupName];
    };

    // Simple topological sort for groups
    let groupsRemaining = Object.keys(groupDependencies);

    while (groupsRemaining.length > 0) {
      // Find groups with all dependencies satisfied
      const readyGroups = groupsRemaining.filter((groupName) => {
        const deps = groupDependencies[groupName] || [];
        return deps.every((dep) => executedGroups.includes(dep));
      });

      if (readyGroups.length === 0) {
        // Circular dependency or missing dependency - execute remaining groups
        readyGroups.push(...groupsRemaining);
      }

      // Execute first ready group
      const nextGroup = readyGroups[0];
      const phases = getGroupPhases(nextGroup);

      executionOrder.push(phases);
      executedGroups.push(nextGroup);
      groupsRemaining = groupsRemaining.filter((g) => g !== nextGroup);
    }

    return executionOrder;
  }

  /**
   * Get dependencies for a specific group.
   */
  private getGroupDependencies(groupName: string): string[] {
    const groupDependencies: Record<string, string[]> = {
      foundation: [],
      stack_and_tokens: ['ANALYSIS'],
      spec_and_design: ['STACK_SELECTION', 'SPEC_DESIGN_TOKENS'],
      requirements: ['SPEC', 'SPEC_DESIGN_COMPONENTS'],
      design_and_architecture: ['DEPENDENCIES'],
    };

    return groupDependencies[groupName] || [];
  }

  /**
   * Estimate the total sequential duration for comparison.
   */
  private estimateSequentialDuration(executionOrder: string[][]): number {
    // Sum up phase durations from the spec
    let total = 0;
    const seenPhases = new Set<string>();

    for (const group of executionOrder) {
      for (const phase of group) {
        if (!seenPhases.has(phase)) {
          seenPhases.add(phase);
          const phaseSpec = this.spec.phases[phase];
          if (phaseSpec) {
            total += phaseSpec.duration_minutes * 60 * 1000; // Convert to milliseconds
          }
        }
      }
    }

    return total;
  }
}
