/**
 * Centralized configuration for application constants
 * Allows easy changes to paths, versions, and other settings
 */

import path from 'path';

/**
 * Artifact storage configuration
 */
export const ARTIFACT_CONFIG = {
  // Base directory for projects
  baseDir: process.env.ARTIFACT_BASE_DIR || path.join(process.cwd(), 'projects'),

  // Subdirectories
  specsSubdir: 'specs',
  artifactsSubdir: 'artifacts',
  versionsSubdir: 'versions',

  // Current artifact version
  currentVersion: process.env.ARTIFACT_VERSION || 'v1',

  // S3 configuration (for future migration)
  s3Enabled: process.env.USE_S3_STORAGE === 'true',
  s3Bucket: process.env.S3_BUCKET || 'spec-driven-artifacts',
  s3Region: process.env.AWS_REGION || 'us-east-1',
  s3Prefix: process.env.S3_PREFIX || 'artifacts',
} as const;

/**
 * Phase configuration
 */
export const PHASE_CONFIG = {
  phases: [
    'ANALYSIS',
    'STACK_SELECTION',
    'SPEC_PM',
    'SPEC_ARCHITECT',
    'SPEC_DESIGN_TOKENS',
    'SPEC_DESIGN_COMPONENTS',
    'FRONTEND_BUILD',
    'DEPENDENCIES',
    'SOLUTIONING',
    'VALIDATE',
    'AUTO_REMEDY',
    'DONE'
  ] as const,

  // Files required for each phase
  requiredFiles: {
    ANALYSIS: ['constitution.md', 'project-brief.md', 'project-classification.json', 'personas.md'],
    STACK_SELECTION: ['stack-analysis.md', 'stack-decision.md', 'stack-rationale.md', 'stack.json'],
    SPEC_PM: ['PRD.md'],
    SPEC_ARCHITECT: ['data-model.md', 'api-spec.json'],
    SPEC_DESIGN_TOKENS: ['design-tokens.md'],
    SPEC_DESIGN_COMPONENTS: ['component-inventory.md', 'user-journey-maps.md'],
    FRONTEND_BUILD: ['frontend-components.md'],
    DEPENDENCIES: ['DEPENDENCIES.md', 'dependencies.json'],
    SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
    VALIDATE: ['validation-report.md', 'coverage-matrix.md'],
    AUTO_REMEDY: ['remediation-report.md'],
    DONE: ['README.md', 'HANDOFF.md'],
  },
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  // General API rate limits
  general: {
    points: parseInt(process.env.RATE_LIMIT_GENERAL_POINTS || '100', 10),
    duration: parseInt(process.env.RATE_LIMIT_GENERAL_DURATION || '60', 10), // per minute
  },

  // LLM-specific rate limits (expensive operations)
  llm: {
    points: parseInt(process.env.RATE_LIMIT_LLM_POINTS || '10', 10),
    duration: parseInt(process.env.RATE_LIMIT_LLM_DURATION || '60', 10), // per minute
    blockDuration: parseInt(process.env.RATE_LIMIT_LLM_BLOCK || '300', 10), // 5 minutes
  },

  // Authentication rate limits
  auth: {
    points: parseInt(process.env.RATE_LIMIT_AUTH_POINTS || '5', 10),
    duration: parseInt(process.env.RATE_LIMIT_AUTH_DURATION || '60', 10),
    blockDuration: parseInt(process.env.RATE_LIMIT_AUTH_BLOCK || '900', 10), // 15 minutes
  },
} as const;

/**
 * Logging configuration
 */
export const LOGGING_CONFIG = {
  // Log level
  level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',

  // External log aggregation
  aggregation: {
    enabled: process.env.LOG_AGGREGATION_ENABLED === 'true',
    provider: process.env.LOG_AGGREGATION_PROVIDER || 'vercel', // 'vercel', 'datadog', 'logrocket', etc.
    endpoint: process.env.LOG_AGGREGATION_ENDPOINT,
    apiKey: process.env.LOG_AGGREGATION_API_KEY,
  },

  // Pretty print in development
  prettyPrint: process.env.NODE_ENV === 'development',
} as const;

/**
 * LLM configuration
 */
export const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'gemini',
  apiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL || 'gemini-1.5-pro',
  timeout: parseInt(process.env.LLM_TIMEOUT || '300000', 10), // 5 minutes
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
} as const;

/**
 * Database configuration
 */
export const DB_CONFIG = {
  url: process.env.DATABASE_URL,
  poolSize: parseInt(process.env.DB_POOL_SIZE || '5', 10),
  timeout: parseInt(process.env.DB_TIMEOUT || '30000', 10), // 30 seconds
} as const;

/**
 * Build artifact paths using config
 */
export function getArtifactPath(
  projectId: string,
  phase: string,
  filename: string,
  version?: string
): string {
  const { baseDir, specsSubdir, currentVersion } = ARTIFACT_CONFIG;
  const v = version || currentVersion;
  return path.join(baseDir, projectId, specsSubdir, phase, v, filename);
}

export function getProjectPath(projectId: string): string {
  return path.join(ARTIFACT_CONFIG.baseDir, projectId);
}

export function getPhasePath(projectId: string, phase: string, version?: string): string {
  const { baseDir, specsSubdir, currentVersion } = ARTIFACT_CONFIG;
  const v = version || currentVersion;
  return path.join(baseDir, projectId, specsSubdir, phase, v);
}

/**
 * Type-safe phase checking
 */
export function isValidPhase(phase: string): phase is (typeof PHASE_CONFIG.phases)[number] {
  return (PHASE_CONFIG.phases as readonly (typeof PHASE_CONFIG.phases)[number][]).includes(phase as (typeof PHASE_CONFIG.phases)[number]);
}

/**
 * Get required files for a phase
 */
export function getRequiredFilesForPhase(
  phase: (typeof PHASE_CONFIG.phases)[number]
): string[] {
  return [...(PHASE_CONFIG.requiredFiles[phase] || [])];
}
