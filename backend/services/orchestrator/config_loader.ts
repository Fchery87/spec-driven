import { OrchestratorSpec } from '@/types/orchestrator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';

export class ConfigLoader {
  private spec: OrchestratorSpec | null = null;

  /**
   * Load orchestrator specification from YAML file
   */
  loadSpec(): OrchestratorSpec {
    if (this.spec) {
      return this.spec;
    }

    try {
      const specPath = resolve(process.cwd(), 'orchestrator_spec.yml');
      const fileContent = readFileSync(specPath, 'utf8');

      // Parse YAML using js-yaml library
      const parsedYaml = yaml.load(fileContent) as Record<string, any>;
      this.spec = this.normalizeSpec(parsedYaml);

      return this.spec;
    } catch (error) {
      console.error('Failed to load orchestrator spec:', error);
      // Fallback to defaults if YAML parsing fails
      return this.getDefaultSpec();
    }
  }

  /**
   * Normalize parsed YAML into OrchestratorSpec type
   */
  private normalizeSpec(parsed: Record<string, any>): OrchestratorSpec {
    return {
      phases: {
        ANALYSIS: {
          name: 'ANALYSIS',
          description: 'Clarify requirements through guided Q&A',
          owner: 'analyst',
          duration_minutes: 30,
          inputs: ['user_idea'],
          outputs: ['constitution.md', 'project-brief.md', 'personas.md'],
          next_phase: 'STACK_SELECTION',
          validators: ['presence', 'markdown_frontmatter', 'content_quality']
        },
        STACK_SELECTION: {
          name: 'STACK_SELECTION',
          description: 'Select and approve technology stack',
          owner: 'architect',
          duration_minutes: 20,
          inputs: ['project-brief.md', 'personas.md'],
          outputs: ['plan.md', 'README.md'],
          depends_on: ['ANALYSIS'],
          gates: ['stack_approved'],
          next_phase: 'SPEC',
          validators: ['presence', 'stack_approved']
        },
        SPEC: {
          name: 'SPEC',
          description: 'Generate detailed specifications',
          owner: ['pm', 'architect'],
          duration_minutes: 45,
          inputs: ['project-brief.md', 'personas.md', 'approved_stack'],
          outputs: ['PRD.md', 'data-model.md', 'api-spec.json'],
          depends_on: ['ANALYSIS', 'STACK_SELECTION'],
          next_phase: 'DEPENDENCIES',
          validators: ['markdown_frontmatter', 'api_openapi', 'presence', 'content_coverage']
        },
        DEPENDENCIES: {
          name: 'DEPENDENCIES',
          description: 'Define and approve project dependencies',
          owner: 'devops',
          duration_minutes: 30,
          inputs: ['PRD.md', 'approved_stack'],
          outputs: ['DEPENDENCIES.md', 'dependency-proposal.md'],
          depends_on: ['SPEC'],
          gates: ['dependencies_approved'],
          next_phase: 'SOLUTIONING',
          validators: ['presence', 'dependencies_approved', 'policy_check']
        },
        SOLUTIONING: {
          name: 'SOLUTIONING',
          description: 'Create architecture and task breakdown',
          owner: ['architect', 'scrummaster'],
          duration_minutes: 60,
          inputs: ['PRD.md', 'data-model.md', 'api-spec.json', 'DEPENDENCIES.md'],
          outputs: ['architecture.md', 'epics.md', 'tasks.md'],
          depends_on: ['SPEC', 'DEPENDENCIES'],
          next_phase: 'DONE',
          validators: ['markdown_frontmatter', 'tasks_dag', 'presence', 'content_coverage']
        },
        DONE: {
          name: 'DONE',
          description: 'Generate handoff and ZIP package',
          owner: 'orchestrator',
          duration_minutes: 10,
          inputs: ['all_previous_artifacts'],
          outputs: ['HANDOFF.md', 'project.zip'],
          depends_on: ['SOLUTIONING'],
          next_phase: 'DONE',
          validators: ['handoff_complete', 'zip_created']
        }
      },
      stacks: {
        nextjs_only_expo: {
          id: 'nextjs_only_expo',
          name: 'Next.js-Only + Expo',
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
          name: 'Hybrid Next.js + FastAPI + Expo',
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
        dependencies_approved: {
          description: 'Check if dependencies have been approved by user',
          implementation: 'database_field_check',
          field: 'dependencies_approved',
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
        model: 'gemini-2.0-flash-exp',
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
        dependencies_approved: false,
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