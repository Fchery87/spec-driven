import { OrchestratorSpec } from '@/types/orchestrator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';
import { logger } from '@/lib/logger';

// Global singleton to prevent multiple spec loads
let globalSpec: OrchestratorSpec | null = null;
let lastLoadTime: number = 0;
const RELOAD_INTERVAL = 5000; // Reload spec every 5 seconds in development

export class ConfigLoader {
  private spec: OrchestratorSpec | null = null;

  /**
   * Load orchestrator specification from YAML file
   */
  loadSpec(): OrchestratorSpec {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const now = Date.now();

    // Use global singleton as primary cache
    if (globalSpec && !isDevelopment) {
      return globalSpec;
    }

    // In development, reload only if enough time has passed to avoid thrashing
    if (isDevelopment && globalSpec && now - lastLoadTime < RELOAD_INTERVAL) {
      return globalSpec;
    }

    try {
      const specPath = resolve(process.cwd(), 'orchestrator_spec.yml');
      const fileContent = readFileSync(specPath, 'utf8');

      // Parse YAML using js-yaml library
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedYaml = yaml.load(fileContent) as Record<string, any>;
      this.spec = this.normalizeSpec(parsedYaml);

      // Update global singleton and instance
      globalSpec = this.spec;
      lastLoadTime = now;

      return this.spec;
    } catch (error) {
      logger.error('Failed to load orchestrator spec:', error instanceof Error ? error : new Error(String(error)));
      // Fallback to defaults if YAML parsing fails
      const defaultSpec = this.getDefaultSpec();
      globalSpec = defaultSpec;
      return defaultSpec;
    }
  }

  /**
   * Normalize parsed YAML into OrchestratorSpec type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeSpec(parsed: Record<string, any>): OrchestratorSpec {
    // If parsed data exists, use it directly (it's already in the correct format from YAML)
    if (parsed && Object.keys(parsed).length > 0) {
      logger.info('[ConfigLoader] Successfully parsed YAML with keys: ' + Object.keys(parsed).join(', '));
      const spec = parsed as OrchestratorSpec;
      // Validate that phases exist
      if (!spec.phases) {
        logger.warn('[ConfigLoader] Warning: Parsed YAML does not have phases object');
        return this.getDefaultSpec();
      }

      // Validate and normalize phases: ensure each phase has a name field
      if (typeof spec.phases === 'object' && spec.phases !== null) {
        for (const [phaseName, phase] of Object.entries(spec.phases)) {
          if (phase && typeof phase === 'object') {
            // Auto-populate missing name field with phase key
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const phaseObj = phase as any;
            if (!phaseObj.name) {
              logger.info(`[ConfigLoader] Auto-populating missing name field for phase: ${phaseName}`);
              phaseObj.name = phaseName;
            }
          }
        }
      }

      logger.info('[ConfigLoader] Found phases: ' + Object.keys(spec.phases).join(', '));
      return spec;
    }

    logger.info('[ConfigLoader] Parsed YAML is empty, using defaults');
    // Otherwise return hardcoded defaults as fallback
    return {
      phases: {
        ANALYSIS: {
          name: 'ANALYSIS',
          description: 'Clarify requirements through guided Q&A',
          owner: 'analyst',
          duration_minutes: 30,
          inputs: ['user_idea'],
          outputs: ['constitution.md', 'project-brief.md', 'project-classification.json', 'personas.md'],
          next_phase: 'STACK_SELECTION',
          validators: ['presence', 'markdown_frontmatter', 'content_quality']
        },
        STACK_SELECTION: {
          name: 'STACK_SELECTION',
          description: 'Select and approve technology stack',
          owner: 'architect',
          duration_minutes: 20,
          inputs: ['project-brief.md', 'project-classification.json', 'personas.md', 'constitution.md'],
          outputs: ['stack-analysis.md', 'stack-decision.md', 'stack-rationale.md', 'stack.json'],
          depends_on: ['ANALYSIS'],
          gates: ['stack_approved'],
          next_phase: 'SPEC_PM',
          validators: ['presence', 'stack_approved']
        },
        SPEC_PM: {
          name: 'SPEC_PM',
          description: 'Generate Product Requirements Document (PRD)',
          owner: 'pm',
          duration_minutes: 30,
          inputs: ['project-brief.md', 'personas.md', 'approved_stack'],
          outputs: ['PRD.md'],
          depends_on: ['ANALYSIS', 'STACK_SELECTION'],
          next_phase: 'SPEC_ARCHITECT',
          validators: ['presence', 'markdown_frontmatter']
        },
        SPEC_ARCHITECT: {
          name: 'SPEC_ARCHITECT',
          description: 'Generate data model and API specifications',
          owner: 'architect',
          duration_minutes: 30,
          inputs: ['project-brief.md', 'personas.md', 'approved_stack', 'PRD.md'],
          outputs: ['data-model.md', 'api-spec.json'],
          depends_on: ['SPEC_PM'],
          next_phase: 'SPEC_DESIGN_TOKENS',
          validators: ['presence', 'api_openapi', 'markdown_frontmatter']
        },
        SPEC_DESIGN_TOKENS: {
          name: 'SPEC_DESIGN_TOKENS',
          description: 'Generate stack-agnostic design tokens',
          owner: 'designer',
          duration_minutes: 30,
          inputs: ['project-brief.md', 'personas.md'],
          outputs: ['design-tokens.md'],
          depends_on: ['ANALYSIS'],
          next_phase: 'SPEC_DESIGN_COMPONENTS',
          validators: ['presence', 'markdown_frontmatter']
        },
        SPEC_DESIGN_COMPONENTS: {
          name: 'SPEC_DESIGN_COMPONENTS',
          description: 'Map design tokens to stack-specific components',
          owner: 'designer',
          duration_minutes: 45,
          inputs: ['design-tokens.md', 'approved_stack'],
          outputs: ['component-inventory.md', 'user-journey-maps.md'],
          depends_on: ['SPEC_DESIGN_TOKENS', 'STACK_SELECTION'],
          next_phase: 'FRONTEND_BUILD',
          validators: ['presence', 'markdown_frontmatter']
        },
        FRONTEND_BUILD: {
          name: 'FRONTEND_BUILD',
          description: 'Generate production-ready frontend components',
          owner: 'frontend_developer',
          duration_minutes: 60,
          inputs: ['component-inventory.md', 'design-tokens.md', 'approved_stack'],
          outputs: ['frontend-components.md', 'component-code.zip'],
          depends_on: ['SPEC_DESIGN_COMPONENTS'],
          next_phase: 'DEPENDENCIES',
          validators: ['presence']
        },
        DEPENDENCIES: {
          name: 'DEPENDENCIES',
          description: 'Auto-generate project dependencies from approved stack',
          owner: 'devops',
          duration_minutes: 30,
          inputs: ['PRD.md', 'approved_stack'],
          outputs: ['DEPENDENCIES.md', 'dependencies.json'],
          depends_on: ['SPEC_PM', 'SPEC_ARCHITECT'],
          next_phase: 'SOLUTIONING',
          validators: ['presence', 'dependencies_json_check']
        },
        SOLUTIONING: {
          name: 'SOLUTIONING',
          description: 'Create architecture and task breakdown',
          owner: ['architect', 'scrummaster'],
          duration_minutes: 60,
          inputs: ['PRD.md', 'data-model.md', 'api-spec.json', 'DEPENDENCIES.md'],
          outputs: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
          depends_on: ['SPEC_PM', 'SPEC_ARCHITECT', 'DEPENDENCIES'],
          next_phase: 'VALIDATE',
          validators: ['markdown_frontmatter', 'tasks_dag', 'presence', 'content_coverage']
        },
        VALIDATE: {
          name: 'VALIDATE',
          description: 'Cross-artifact consistency and coverage analysis',
          owner: 'validator',
          duration_minutes: 15,
          inputs: ['all_previous_artifacts'],
          outputs: ['validation-report.md', 'coverage-matrix.md'],
          depends_on: ['SOLUTIONING'],
          next_phase: 'AUTO_REMEDY',
          validators: ['cross_artifact_consistency', 'requirement_traceability']
        },
        AUTO_REMEDY: {
          name: 'AUTO_REMEDY',
          description: 'Automated remediation of validation failures',
          owner: 'orchestrator',
          duration_minutes: 30,
          inputs: ['validation-report.md', 'failed_artifacts'],
          outputs: ['remediation-report.md'],
          depends_on: ['VALIDATE'],
          next_phase: 'DONE',
          validators: ['presence']
        },
        DONE: {
          name: 'DONE',
          description: 'Generate handoff and ZIP package',
          owner: 'orchestrator',
          duration_minutes: 10,
          inputs: ['all_previous_artifacts'],
          outputs: ['README.md', 'HANDOFF.md', 'project.zip'],
          depends_on: ['AUTO_REMEDY'],
          next_phase: 'DONE',
          validators: ['handoff_complete', 'zip_created']
        }
      },
      stacks: {
        // New 3-option architecture patterns
        web_application: {
          id: 'web_application',
          name: 'Web Application',
          description: 'Single unified codebase with integrated API layer for browser-based apps',
          composition: {
            pattern: 'Monolithic Full-Stack',
            examples: 'Next.js + Drizzle, Django, React, Tanstack Start',
            backend: 'Integrated API layer',
            database: 'PostgreSQL/SQLite with ORM',
            deployment: 'Single target (Vercel, Railway)'
          },
          best_for: ['SaaS dashboards', 'admin panels', 'internal tools', 'content platforms', 'MVPs'],
          strengths: ['Single language ecosystem', 'unified codebase', 'fast iteration', 'low operational overhead'],
          tradeoffs: ['Less suitable for heavy background compute', 'tightly coupled frontend/backend'],
          scaling: 'Good for <10k DAU'
        },
        mobile_application: {
          id: 'mobile_application',
          name: 'Mobile Application',
          description: 'Cross-platform native apps with dedicated API backend',
          composition: {
            pattern: 'Mobile-First with API Backend',
            examples: 'React Native + Expo, Flutter + Firebase, Swift/Kotlin native',
            backend: 'Dedicated API service',
            database: 'Firebase/Supabase or custom API',
            deployment: 'App stores + cloud API'
          },
          best_for: ['Consumer apps', 'offline-first', 'push notifications', 'device features', 'location-based'],
          strengths: ['Native device access', 'offline support', 'push notifications', 'app store distribution'],
          tradeoffs: ['App store review process', 'iOS/Android considerations', 'device fragmentation'],
          scaling: 'Good for 100k+ users'
        },
        api_first_platform: {
          id: 'api_first_platform',
          name: 'API-First Platform',
          description: 'Headless architecture serving multiple clients and integrations',
          composition: {
            pattern: 'Headless/Multi-Client',
            examples: 'Node.js/Go/Rust API, GraphQL federation, Serverless',
            backend: 'Standalone API service',
            database: 'PostgreSQL with independent scaling',
            deployment: 'Independent service scaling'
          },
          best_for: ['Multi-platform products', 'developer APIs', 'B2B integrations', 'marketplaces', 'SDK/CLI tooling'],
          strengths: ['Single API for all clients', 'webhook integrations', 'multi-tenant ready', 'technology flexibility'],
          tradeoffs: ['Increased operational complexity', 'API contract management', 'higher initial setup cost'],
          scaling: 'Good for 100k+ DAU, B2B'
        },
        // Legacy support
        nextjs_only_expo: {
          id: 'nextjs_only_expo',
          name: 'Next.js-Only + Expo (Legacy)',
          description: 'Unified TypeScript codebase with Next.js App Router and Expo mobile',
          composition: {
            frontend: 'Next.js 14 (App Router)',
            mobile: 'Expo with React Native',
            backend: 'Next.js API routes / tRPC',
            database: 'PostgreSQL with Prisma',
            deployment: 'Vercel'
          },
          best_for: ['MVPs', 'dashboards', 'CRUD SaaS', 'low ops footprint'],
          strengths: ['Single language', 'unified codebase', 'fast iteration', 'integrated API'],
          tradeoffs: ['Less suitable for heavy backend compute', 'long-running jobs'],
          scaling: 'Good for <10k DAU, existing managed infra'
        },
        hybrid_nextjs_fastapi_expo: {
          id: 'hybrid_nextjs_fastapi_expo',
          name: 'Hybrid Next.js + FastAPI + Expo (Legacy)',
          description: 'Decoupled services with Python backend for heavy compute',
          composition: {
            frontend: 'Next.js 14',
            mobile: 'Expo with React Native',
            backend: 'FastAPI (Python)',
            database: 'PostgreSQL with SQLAlchemy',
            deployment: 'Separate infra'
          },
          best_for: ['AI/ETL/OCR', 'long-running jobs', 'heavier backend compute'],
          strengths: ['Decoupled services', 'Python for data science/ML', 'flexibility', 'async workers'],
          tradeoffs: ['More operational complexity', 'separate deployments'],
          scaling: 'Good for 10k-100k DAU, complex backend logic'
        }
      },
      agents: {
        analyst: {
          role: 'Business Analyst and Product Strategist',
          perspective: 'CEO/CPO',
          responsibilities: [
            'Ask clarifying questions to understand project vision',
            'Generate constitution, project brief, and personas'
          ],
          prompt_template: 'You are a Business Analyst and Product Strategist...'
        },
        pm: {
          role: 'Product Manager',
          perspective: 'CPO',
          responsibilities: [
            'Convert vision into concrete specifications',
            'Document requirements comprehensively',
            'Prioritize features and create PRD'
          ],
          prompt_template: 'You are a Product Manager...'
        },
        architect: {
          role: 'Chief Architect',
          perspective: 'CTO',
          responsibilities: [
            'Design system architecture',
            'Make technology choices',
            'Create data models and API specs'
          ],
          prompt_template: 'You are a Chief Architect...'
        },
        scrummaster: {
          role: 'Scrum Master and Project Manager',
          perspective: 'VP Engineering',
          responsibilities: [
            'Break requirements into executable tasks',
            'Plan execution and ensure nothing falls through cracks',
            'Create epics and task breakdown'
          ],
          prompt_template: 'You are a Scrum Master...'
        },
        devops: {
          role: 'DevOps Engineer',
          perspective: 'Infrastructure & SRE',
          responsibilities: [
            'Ensure project is deployment-ready',
            'Define dependencies and security policies',
            'Create deployment and monitoring setup'
          ],
          prompt_template: 'You are a DevOps Engineer...'
        }
      },
      validators: {
        presence: {
          description: 'Check if all required files exist',
          implementation: 'file_exists_check'
        },
        markdown_frontmatter: {
          description: 'Ensure markdown files have required frontmatter',
          required_fields: ['title', 'owner', 'version', 'date', 'status'],
          implementation: 'frontmatter_parser'
        },
        content_quality: {
          description: 'Check content is not empty or obviously incomplete',
          min_length: 100,
          implementation: 'content_length_check'
        },
        content_coverage: {
          description: 'Ensure sufficient content coverage',
          requirements: {
            'PRD.md': 'at_least_5_requirements',
            'data-model.md': 'has_tables',
            'api-spec.json': 'has_endpoints',
            'tasks.md': 'at_least_10_tasks'
          },
          implementation: 'coverage_analysis'
        },
        api_openapi: {
          description: 'Validate OpenAPI specification',
          version: '3.0',
          implementation: 'openapi_validator'
        },
        stack_approved: {
          description: 'Check if stack has been approved by user',
          implementation: 'database_field_check',
          field: 'stack_approved',
          expected_value: true
        },
        policy_check: {
          description: 'Run dependency policy scripts',
          scripts: ['npm_audit', 'pip_audit', 'no_deprecated', 'no_outdated'],
          implementation: 'script_execution'
        },
        tasks_dag: {
          description: 'Ensure no circular dependencies in task list',
          implementation: 'dependency_graph_analysis'
        },
        handoff_complete: {
          description: 'Check HANDOFF.md is generated and complete',
          required_sections: ['project_context', 'reading_order', 'llm_prompt'],
          implementation: 'handoff_validator'
        },
        zip_created: {
          description: 'Verify ZIP archive is created and contains all files',
          required_files: ['HANDOFF.md', 'constitution.md', 'PRD.md', 'architecture.md'],
          implementation: 'zip_validation'
        }
      },
      security_baseline: {
        authentication: [
          'All passwords hashed with bcrypt (cost 10+)',
          'JWT tokens with 1-hour expiry',
          'HTTPS only (no HTTP)'
        ],
        data_protection: [
          'Sensitive data encrypted at rest (AES-256)',
          'TLS 1.2+ for transit'
        ],
        compliance: [
          'GDPR-ready user data handling',
          'Audit logs for sensitive operations',
          'PII never in logs'
        ],
        scanning: [
          'npm audit (zero HIGH/CRITICAL)',
          'pip-audit (zero HIGH/CRITICAL)',
          'SAST scanning (SonarQube or Snyk)'
        ],
        testing: [
          'Unit test coverage >80%',
          'E2E tests for critical flows',
          'Security-focused test cases'
        ]
      },
      file_structure: {
        project_directory: '/projects/{slug}/',
        specs_directory: '/projects/{slug}/specs/',
        artifact_versioning: 'v{version}/'
      },
      llm_config: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        max_tokens: 8192,
        temperature: 0.7,
        timeout_seconds: 120,
        rate_limit: {
          requests_per_minute: 60,
          tokens_per_hour: 100000
        },
        cost_management: {
          max_cost_per_project: 50.0,
          token_cost_per_million: 0.5
        }
      },
      project_defaults: {
        current_phase: 'ANALYSIS',
        phases_completed: [],
        stack_choice: null,
        stack_approved: false,
        artifact_versions: {},
        zip_ready: false
      }
    };
  }

  /**
   * Reload specification from file
   */
  reloadSpec(): OrchestratorSpec {
    this.spec = null;
    return this.loadSpec();
  }

  /**
   * Get specific section of the specification
   */
  getSection<T extends keyof OrchestratorSpec>(section: T): OrchestratorSpec[T] {
    const spec = this.loadSpec();
    return spec[section];
  }

  /**
   * Get default specification as fallback
   * This mirrors the normalizeSpec method but serves as fallback when YAML loading fails
   */
  private getDefaultSpec(): OrchestratorSpec {
    // Return the same structure as normalizeSpec since it's the default hardcoded values
    return this.normalizeSpec({});
  }
}
