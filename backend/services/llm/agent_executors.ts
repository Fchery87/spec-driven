import { LLMProvider } from './providers/base';
import { GeminiClient } from './llm_client';
import { ConfigLoader } from '../orchestrator/config_loader';
import { logger } from '@/lib/logger';
import { ValidationIssue } from '../orchestrator/inline_validation';
import {
  deriveIntelligentDefaultStack,
  parseProjectClassification,
} from '@/backend/lib/stack_defaults';
import {
  buildDependencyContract,
  detectFeaturesFromPRD,
  formatDependencyPresetForPrompt,
} from '@/backend/config/dependency-presets';
import { asString } from '@/backend/lib/artifact_utils';

// ============================================================================
// TYPE DEFINITIONS FOR AGENT EXECUTORS
// ============================================================================

export interface AgentConfig {
  // Configuration options for agent execution
  [key: string]: unknown;
}

export interface AgentExecutor {
  role: string;
  perspective: string;
  expertise: string[];
  generateArtifacts: (
    context: Record<string, unknown>
  ) => Promise<ArtifactGenerationResult>;
  validateArtifacts?: (
    artifacts: Record<string, string | Buffer>
  ) => ValidationResult;
}

export interface ArtifactGenerationResult {
  success: boolean;
  artifacts: Record<string, string | Buffer>;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  canProceed: boolean;
  issues: ValidationIssue[];
}

/**
 * PURE FUNCTION ARCHITECTURE
 *
 * All executor functions are pure functions that:
 * - Take all dependencies as parameters (no class instances)
 * - Have no side effects (except logging)
 * - Can be safely called across async boundaries in Next.js RSC
 *
 * This eliminates context loss issues in React Server Components
 */

// ============================================================================
// PROMPT BUILDING HELPERS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrompt(template: string, variables: Record<string, any>): string {
  let prompt = template;

  // Add standard variables that should always be available
  const standardVars = {
    currentDate: new Date().toISOString().split('T')[0],
    ...variables,
  };

  for (const [key, value] of Object.entries(standardVars)) {
    const placeholder = `{{${key}}}`;
    const replacement = value || '';
    prompt = prompt.replace(new RegExp(placeholder, 'g'), String(replacement));
  }

  return prompt;
}

// ============================================================================
// CHAIN-OF-THOUGHT REASONING EXTRACTION
// ============================================================================

/**
 * Extract reasoning block from LLM response content.
 * Looks for content wrapped in <reasoning>...</reasoning> tags.
 *
 * @param content - The raw LLM response content
 * @returns The extracted reasoning text, or null if not found
 */
export function extractReasoning(content: string): string | null {
  const match = content.match(/<reasoning>\s*([\s\S]*?)\s*<\/reasoning>/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract reasoning and artifacts from a response that contains both.
 * The reasoning should be in a <reasoning> block, and artifacts follow.
 *
 * @param content - The raw LLM response content
 * @returns Object containing reasoning (if present) and the cleaned content for artifact parsing
 */
export interface ReasoningExtractionResult {
  reasoning: string | null;
  cleanedContent: string;
}

/**
 * Extract reasoning block and remove it from content for artifact parsing.
 * Useful when LLM outputs reasoning followed by artifacts.
 */
export function extractReasoningAndClean(
  content: string
): ReasoningExtractionResult {
  const reasoning = extractReasoning(content);

  // Remove the reasoning block from content to get clean artifact content
  const cleanedContent = reasoning
    ? content.replace(/<reasoning>[\s\S]*?<\/reasoning>\s*/i, '').trim()
    : content;

  return {
    reasoning,
    cleanedContent,
  };
}

// ============================================================================
// ARTIFACT PARSING - FAIL-FAST ARCHITECTURE
// ============================================================================

interface ParseResult {
  success: boolean;
  artifacts: Record<string, string | Buffer>;
  parseMethod: 'structured' | 'markdown_strict' | 'failed';
  errors: string[];
}

/**
 * Parse artifacts with fail-fast behavior.
 *
 * OLD (PROBLEMATIC): 6-layer fallback chain with silent degradation
 * - Attempt 1: Markdown code blocks with filename markers
 * - Attempt 2: JSON extraction
 * - Attempt 3: Header-based parsing
 * - ...
 * - Attempt 5: DEGRADE - dump everything into first file ← BAD
 * - Attempt 6: SILENT FAILURE - empty strings ← WORSE
 *
 * NEW (ROBUST):
 * - PRIMARY: Structured output detection (JSON array with filename/content)
 * - FALLBACK: Strict markdown parsing (NO degradation!)
 * - FAILURE: Throw clear error instead of silent degradation
 */
function parseArtifacts(
  content: string,
  expectedFiles: string[],
  options: { allowMarkdownFallback?: boolean } = { allowMarkdownFallback: true }
): Record<string, string | Buffer> {
  const result = parseArtifactsInternal(content, expectedFiles, options);

  if (result.success) {
    return result.artifacts;
  }

  // For backward compatibility, return partial results but log warning
  // This maintains existing behavior while adding new validation path
  logger.warn('[ParseArtifacts] Parse failed, returning partial results', {
    expectedFiles,
    foundFiles: Object.keys(result.artifacts),
    errors: result.errors,
  });

  return result.artifacts;
}

/**
 * Internal parse function that returns full ParseResult
 */
function parseArtifactsInternal(
  content: string,
  expectedFiles: string[],
  options: { allowMarkdownFallback?: boolean } = { allowMarkdownFallback: true }
): ParseResult {
  const result: ParseResult = {
    success: false,
    artifacts: {},
    parseMethod: 'failed',
    errors: [],
  };

  // PRIMARY PATH: Try structured extraction first (JSON array pattern)
  const structuredArtifacts = extractStructuredArtifacts(content);
  if (structuredArtifacts) {
    result.artifacts = structuredArtifacts;
    result.parseMethod = 'structured';
    result.success = validateAllFilesPresent(result.artifacts, expectedFiles);
    if (result.success) {
      return result;
    }
    result.errors.push('Structured output missing required files');
  }

  // FALLBACK: Strict markdown code block parsing (NO degradation!)
  if (options.allowMarkdownFallback) {
    const markdownArtifacts = parseMarkdownBlocksStrict(content, expectedFiles);
    if (markdownArtifacts) {
      result.artifacts = markdownArtifacts;
      result.parseMethod = 'markdown_strict';
      result.success = validateAllFilesPresent(result.artifacts, expectedFiles);
      if (result.success) {
        return result;
      }
      result.errors.push('Markdown fallback missing required files');
    }
  }

  // NO DEGRADATION: Don't dump everything into first file
  // NO SILENT FAILURE: Don't fill with empty strings

  result.errors.push(
    `Parse failed. Expected files: ${expectedFiles.join(', ')}. ` +
      `Found files: ${Object.keys(result.artifacts).join(', ') || 'none'}. ` +
      `Parse method attempted: ${result.parseMethod}`
  );

  return result;
}

/**
 * Extract artifacts from structured JSON array format.
 * Looks for: [{"filename": "...", "content": "..."}]
 */
function extractStructuredArtifacts(
  content: string
): Record<string, string | Buffer> | null {
  // Try to find JSON array pattern
  const arrayMatch = content.match(/\[\s*\{\s*"filename"/);
  if (!arrayMatch) return null;

  try {
    // Find the JSON array boundaries
    const startIndex = content.indexOf('[');
    if (startIndex === -1) return null;

    let braceCount = 0;
    let endIndex = -1;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0 && content[i] === ']') {
        endIndex = i + 1;
        break;
      }
    }

    if (endIndex === -1) return null;

    const jsonContent = content.slice(startIndex, endIndex);
    const artifacts: Array<{ filename: string; content: string }> =
      JSON.parse(jsonContent);

    const result: Record<string, string | Buffer> = {};
    for (const artifact of artifacts) {
      if (artifact.filename && typeof artifact.content === 'string') {
        result[artifact.filename] = artifact.content;
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Strict markdown code block parsing - requires ALL files found.
 * Returns null if any expected file is missing (no partial results).
 */
function parseMarkdownBlocksStrict(
  content: string,
  expectedFiles: string[]
): Record<string, string | Buffer> | null {
  const fileRegex =
    /```(?:(\w+)[ \t]*)?\n?filename:\s*([^\n]+)\n([\s\S]*?)```/g;

  const artifacts: Record<string, string | Buffer> = {};
  let match;

  while ((match = fileRegex.exec(content)) !== null) {
    const [, language, filename, fileContent] = match;
    const normalizedName = filename.trim();

    // Only accept files that are in our expected list
    if (expectedFiles.includes(normalizedName)) {
      artifacts[normalizedName] = fileContent.trim();
    }
  }

  // Return null if not ALL files found (strict!)
  const allFound = expectedFiles.every((f) => artifacts[f]);
  return allFound ? artifacts : null;
}

/**
 * Validate all expected files are present
 */
function validateAllFilesPresent(
  artifacts: Record<string, string | Buffer>,
  expectedFiles: string[]
): boolean {
  return expectedFiles.every((f) => artifacts[f] && artifacts[f].length > 0);
}

/**
 * Parse with validation - REJECT on failure, RETRY with enhanced prompt.
 * This is the main entry point for artifact parsing.
 */
export async function parseArtifactsWithValidation(
  content: string,
  expectedFiles: string[],
  llmClient: LLMProvider,
  originalPrompt: string,
  phase: string,
  maxRetries: number = 2
): Promise<Record<string, string | Buffer>> {
  const parseResult = parseArtifactsInternal(content, expectedFiles);

  if (parseResult.success) {
    return parseResult.artifacts;
  }

  // Retry with enhanced prompt
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const enhancedPrompt = buildRetryPrompt(
      originalPrompt,
      expectedFiles,
      parseResult.errors,
      attempt
    );

    try {
      const response = await llmClient.generateCompletion(
        enhancedPrompt,
        undefined,
        1,
        phase
      );

      const retryResult = parseArtifactsInternal(
        response.content,
        expectedFiles
      );

      if (retryResult.success) {
        logger.info(`[ParseArtifacts] Retry ${attempt} succeeded`, {
          phase,
          parseMethod: retryResult.parseMethod,
        });
        return retryResult.artifacts;
      }
    } catch (retryError) {
      logger.warn(`[ParseArtifacts] Retry ${attempt} failed`, {
        phase,
        error: (retryError as Error).message,
      });
    }
  }

  // Final failure - don't degrade, throw clear error!
  throw new Error(
    `Artifact parsing failed after ${maxRetries} retries for phase ${phase}. ` +
      `Expected files: ${expectedFiles.join(', ')}. ` +
      `Errors: ${parseResult.errors.join('; ')}. ` +
      `Use structured output (JSON array with filename/content) to fix.`
  );
}

/**
 * Build retry prompt with explicit format instructions
 */
function buildRetryPrompt(
  originalPrompt: string,
  expectedFiles: string[],
  errors: string[],
  attempt: number
): string {
  return `
${originalPrompt}

---

## CRITICAL: OUTPUT FORMAT REQUIREMENTS (Retry #${attempt})

Previous attempt failed: ${errors.join('; ')}

You MUST output a JSON array with this EXACT format:
\`\`\`json
[
  {"filename": "${expectedFiles[0]}", "content": "..."}
  ${expectedFiles
    .slice(1)
    .map((f) => `, {"filename": "${f}", "content": "..."}`)
    .join('')}
]
\`\`\`

Rules:
1. Output ONLY the JSON array, wrapped in markdown code block with \`\`\`json
2. filename must match expected files EXACTLY: ${expectedFiles.join(', ')}
3. content must be the COMPLETE file (including frontmatter if applicable)
4. ALL ${expectedFiles.length} files must be present
5. NO extra files, NO partial files

Generate the output now with ALL files complete.
`;
}

// ============================================================================
// PURE EXECUTOR FUNCTIONS
// ============================================================================

/**
 * Execute Analyst Agent (ANALYSIS phase)
 * Generates: project-classification.json, guiding-principles.md, user-personas.md, user-journeys.md
 */
async function executeAnalystAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  projectIdea: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  logger.info('[ANALYSIS] Executing Analyst Agent');

  const agentConfig = configLoader.getSection('agents').analyst;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    projectIdea,
    projectName: projectName || 'Untitled Project',
  });

  // Use structured output for reliable JSON artifact generation
  // Must match orchestrator_spec.yml ANALYSIS phase outputs
  const expectedFiles = [
    'constitution.md',
    'project-brief.md',
    'project-classification.json',
    'personas.md',
  ];

  // Type assertion to access GeminiClient's structured output method
  const structuredArtifacts = await (
    llmClient as unknown as {
      generateStructuredArtifacts: (
        prompt: string,
        expectedFiles: string[],
        phase?: string,
        options?: {
          temperature?: number;
          maxOutputTokens?: number;
          retries?: number;
        }
      ) => Promise<Record<string, string | Buffer>>;
    }
  ).generateStructuredArtifacts(prompt, expectedFiles, 'ANALYSIS', {
    temperature: 0.3,
    maxOutputTokens: 8192,
    retries: 2,
  });

  logger.info('[ANALYSIS] Agent completed', {
    artifacts: Object.keys(structuredArtifacts),
  });
  return structuredArtifacts;
}

/**
 * Execute PM Agent (SPEC phase - PRD generation)
 * Generates: PRD.md
 */
async function executePMAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  projectBrief: string,
  personas: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  logger.info('[SPEC] Executing PM Agent for PRD generation');

  const agentConfig = configLoader.getSection('agents').pm;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    brief: projectBrief,
    personas: personas,
    projectName: projectName || 'Untitled Project',
  });

  const response = await llmClient.generateCompletion(
    prompt,
    undefined,
    3,
    'SPEC'
  );
  const artifacts = await parseArtifactsWithValidation(
    response.content,
    ['PRD.md'],
    llmClient,
    prompt,
    'SPEC',
    2
  );

  logger.info('[SPEC] PM Agent completed', {
    artifacts: Object.keys(artifacts),
  });
  return artifacts;
}

/**
 * Execute Architect Agent
 * Can generate different outputs based on phase:
 * - STACK_SELECTION phase: stack-analysis.md, stack-decision.md, stack-rationale.md, stack.json
 * - SPEC phase: data-model.md, api-spec.json
 * - SOLUTIONING phase: architecture.md
 */
async function executeArchitectAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  phase: 'STACK_SELECTION' | 'SPEC' | 'SPEC_ARCHITECT' | 'SOLUTIONING',
  projectBrief: string,
  personas: string,
  constitution: string,
  prd: string = '',
  stackChoice?: string,
  projectName?: string,
  projectClassification?: string,
  defaultStack?: string,
  defaultStackReason?: string
): Promise<Record<string, string | Buffer>> {
  logger.info(`[${phase}] Executing Architect Agent`, {
    briefLength: projectBrief?.length || 0,
    personasLength: personas?.length || 0,
    constitutionLength: constitution?.length || 0,
    prdLength: prd?.length || 0,
    stackChoice,
    projectName,
  });

  const agentConfig = configLoader.getSection('agents').architect;

  let expectedFiles: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let variables: Record<string, any> | undefined;

  if (phase === 'STACK_SELECTION') {
    expectedFiles = [
      'stack.json',
      'stack-analysis.md',
      'stack-decision.md',
      'stack-rationale.md',
    ];
    variables = {
      brief: projectBrief,
      personas,
      constitution,
      prd: '',
      phase: 'STACK_SELECTION',
      stackChoice: stackChoice || 'web_application',
      projectName: projectName || 'Untitled Project',
      classification: projectClassification || '',
      defaultStack: defaultStack || 'nextjs_web_app',
      defaultStackReason:
        defaultStackReason || 'Fallback default for web applications',
    };

    const prompt = buildPrompt(agentConfig.prompt_template, variables);

    // Use structured output for reliable JSON artifact generation
    const structuredArtifacts = await (
      llmClient as unknown as {
        generateStructuredArtifacts: (
          prompt: string,
          expectedFiles: string[],
          phase?: string,
          options?: {
            temperature?: number;
            maxOutputTokens?: number;
            retries?: number;
          }
        ) => Promise<Record<string, string | Buffer>>;
      }
    ).generateStructuredArtifacts(prompt, expectedFiles, 'STACK_SELECTION', {
      temperature: 0.3,
      maxOutputTokens: 8192,
      retries: 2,
    });

    logger.info('[STACK_SELECTION] Architect Agent completed', {
      artifacts: Object.keys(structuredArtifacts),
    });
    return structuredArtifacts;
  } else if (phase === 'SPEC' || phase === 'SPEC_ARCHITECT') {
    // SPEC and SPEC_ARCHITECT both generate data-model.md, api-spec.json, architecture-decisions.md
    expectedFiles = [
      'data-model.md',
      'api-spec.json',
      'architecture-decisions.md',
    ];
    variables = {
      brief: projectBrief,
      personas,
      constitution,
      prd: prd,
      phase: 'SPEC',
      stackChoice: stackChoice || 'web_application',
      projectName: projectName || 'Untitled Project',
    };

    const prompt = buildPrompt(agentConfig.prompt_template, variables);

    // Use structured output for reliable JSON artifact generation
    const structuredArtifacts = await (
      llmClient as unknown as {
        generateStructuredArtifacts: (
          prompt: string,
          expectedFiles: string[],
          phase?: string,
          options?: {
            temperature?: number;
            maxOutputTokens?: number;
            retries?: number;
          }
        ) => Promise<Record<string, string | Buffer>>;
      }
    ).generateStructuredArtifacts(prompt, expectedFiles, 'SPEC', {
      temperature: 0.3,
      maxOutputTokens: 8192,
      retries: 2,
    });

    logger.info('[SPEC] Architect Agent completed', {
      artifacts: Object.keys(structuredArtifacts),
    });
    return structuredArtifacts;
  } else if (phase === 'SOLUTIONING') {
    expectedFiles = ['architecture.md'];
    // Use a dedicated, shorter prompt for SOLUTIONING architecture generation
    // Increased limits to provide more context while staying within 1M token context window
    // Supporting Gemini 3.0 Flash's 64K output capability
    const truncatedBrief = projectBrief.slice(0, 50000);
    const truncatedPrd = prd.slice(0, 100000);
    const currentDate = new Date().toISOString().split('T')[0];
    const name = projectName || 'Untitled Project';

    logger.info(`[${phase}] Using dedicated architecture prompt`, {
      originalBriefLength: projectBrief.length,
      truncatedBriefLength: truncatedBrief.length,
      originalPrdLength: prd.length,
      truncatedPrdLength: truncatedPrd.length,
    });

    // Dedicated architecture prompt - much shorter than the full template
    // Get stack template details for consistency
    const stackTemplates: Record<string, string | Buffer> = {
      nextjs_fullstack_expo: 'Next.js 14 + TypeScript + Expo for mobile',
      nextjs_web_only: 'Next.js 14 + TypeScript (web only, no mobile)',
      nextjs_web_app: 'Next.js 14 + TypeScript (web application)',
      hybrid_nextjs_fastapi: 'Next.js frontend + FastAPI Python backend',
      react_express: 'React SPA + Express.js backend',
      vue_nuxt: 'Vue 3 + Nuxt 3',
      svelte_kit: 'SvelteKit fullstack',
      django_htmx: 'Django + HTMX hypermedia',
      go_react: 'Go backend + React frontend',
    };
    const chosenStack = stackChoice || 'nextjs_web_only';
    const stackDescription =
      stackTemplates[chosenStack] || `Custom stack: ${chosenStack}`;

    const architecturePrompt = `You are a Chief Architect designing the system architecture for "${name}".

## Project Brief (Summary)
${truncatedBrief}

## PRD Key Requirements (Summary)
${truncatedPrd}

## APPROVED STACK (from stack-decision.md)
**Stack Template:** ${chosenStack}
**Stack Description:** ${stackDescription}

CRITICAL: Your architecture MUST use the approved stack. Do NOT deviate from this selection.

## Your Task
Generate a comprehensive architecture.md document. CRITICAL REQUIREMENTS:

1. **Explicitly reference the approved stack** (${chosenStack}) in the document
2. **All technologies must match** the approved stack template
3. **Include the stack template name** in the Technology Stack section
4. Map architecture components to PRD requirements where applicable

    ## Sections to Include:
    1. **System Overview** - High-level architecture diagram (Mermaid)
    2. **Technology Stack** - MUST match approved stack: ${chosenStack}
    3. **Component Design** - Major components with requirement mappings
    4. **Frontend Architecture** - Per the ${chosenStack} template
    5. **Backend Architecture** - Per the ${chosenStack} template
    6. **Database Design** - Schema overview, indexes, relationships
    7. **Security Architecture** - Auth flow, authorization, OWASP mitigations
    8. **Performance & Scalability** - Caching, CDN, scaling strategy
    9. **Deployment Architecture** - Environments, CI/CD, infrastructure
    10. **Observability & Operations** - Logging, metrics, tracing, alerting, runbooks

## Output Format
Output a single fenced code block:
\`\`\`
filename: architecture.md
---
title: System Architecture
owner: architect
version: 1.0
date: ${currentDate}
status: draft
approved_stack: ${chosenStack}
---

# System Architecture for ${name}

## Approved Stack
This architecture implements the **${chosenStack}** stack template as approved in stack-decision.md.
Stack: ${stackDescription}

## 1. System Overview
\`\`\`mermaid
graph TB
    Client[Web Client] --> API[API Gateway]
    API --> Auth[Auth Service]
    API --> App[App Service]
    App --> DB[(Database)]
    App --> Cache[(Cache)]
\`\`\`

## 2. Technology Stack (${chosenStack})
| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Stack Template | ${chosenStack} | - | Approved in stack-decision.md |
| Frontend | Next.js | 14.x | App Router, RSC (per ${chosenStack}) |
| ... | ... | ... | ... |

(continue with all sections - reference ${chosenStack} where relevant)
\`\`\`

Generate the complete architecture.md now:`;

    const response = await llmClient.generateCompletion(
      architecturePrompt,
      undefined,
      3,
      phase
    );
    const artifacts = await parseArtifactsWithValidation(
      response.content,
      expectedFiles,
      llmClient,
      architecturePrompt,
      phase,
      2
    );

    // If parsing failed, use raw response
    if (
      !artifacts['architecture.md'] ||
      asString(artifacts['architecture.md']).trim().length < 500
    ) {
      logger.warn(
        '[SOLUTIONING] architecture.md parsing failed, using raw response'
      );
      artifacts['architecture.md'] = response.content;
    }

    logger.info(`[${phase}] Architect Agent completed`, {
      artifacts: Object.keys(artifacts),
      architectureLength: artifacts['architecture.md']?.length || 0,
    });
    return artifacts;
  } else {
    // This should never happen with valid phases
    throw new Error(`Unhandled architect phase: ${phase}`);
  }
}

/**
 * Execute Scrum Master Agent (SOLUTIONING phase)
 * Generates: epics.md, tasks.md, plan.md
 *
 * Leveraging automatic multi-turn continuation in GeminiClient for maximum output.
 */
async function executeScrumMasterAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  prd: string,
  dataModel: string,
  apiSpec: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  logger.info(
    '[SOLUTIONING] Executing Scrum Master Agent (single comprehensive prompt)'
  );

  const currentDate = new Date().toISOString().split('T')[0];
  const name = projectName || 'Untitled Project';

  // Truncate context to fit within 1M token context window while providing comprehensive context
  // Supporting Gemini 3.0 Flash's 64K output capability (multi-turn) for detailed epics, tasks, and planning
  const prdContext = prd.slice(0, 100000);
  const dataModelContext = dataModel.slice(0, 40000);
  const apiSpecContext = apiSpec.slice(0, 40000);

  // Extract requirement IDs from FULL PRD
  const requirementIds = prd.match(/REQ-[A-Z]+-\d+/g) || [];
  const uniqueReqs = Array.from(new Set(requirementIds));

  logger.info('[SOLUTIONING] Extracted requirements from PRD', {
    totalRequirements: uniqueReqs.length,
    requirements: uniqueReqs.join(', '),
  });

  const comprehensivePrompt = `You are an expert Scrum Master designing the project plan for "${name}".

## Context
PRD Summary:
${prdContext}

Data Model & API Spec Context:
${dataModelContext}
${apiSpecContext}

## PRD Requirements to Cover (${uniqueReqs.length} total)
The following requirements MUST be mapped to epics and tasks:
${uniqueReqs.join(', ') || 'Extract REQ-XXX-YYY from PRD above'}

## Your Task
Generate three comprehensive artifacts: epics.md, tasks.md, and plan.md.

### 1. epics.md
- Create 4-8 epics covering the full MVP scope.
- **Each epic MUST list the PRD requirements it addresses** (REQ-XXX-YYY).
- Include clear acceptance criteria in Gherkin format.

### 2. tasks.md
- Break down epics into concrete development tasks.
- **Each task MUST reference specific REQ-XXX-YYY IDs.**
- Include test specifications (Gherkin) for every task.
- Ensure EVERY requirement has at least one implementing task.

### 3. plan.md
- Provide a timeline, MVP scope summary, and risk assessment.
- Define success metrics tied to specific requirements.

## Output Format
Output each file in a separate fenced code block with the "filename: [name]" marker.

\`\`\`
filename: epics.md
...
\`\`\`

\`\`\`
filename: tasks.md
...
\`\`\`

\`\`\`
filename: plan.md
...
\`\`\`

Generate all three artifacts now. If the output is long, continue until complete:`;

  const response = await llmClient.generateCompletion(
    comprehensivePrompt,
    undefined,
    3,
    'SOLUTIONING'
  );
  const artifacts = await parseArtifactsWithValidation(
    response.content,
    ['epics.md', 'tasks.md', 'plan.md'],
    llmClient,
    comprehensivePrompt,
    'SOLUTIONING',
    2
  );

  logger.info('[SOLUTIONING] Scrum Master Agent completed', {
    artifacts: Object.keys(artifacts),
    totalLength: response.content.length,
    epicsLength: artifacts['epics.md']?.length || 0,
    tasksLength: artifacts['tasks.md']?.length || 0,
    planLength: artifacts['plan.md']?.length || 0,
  });

  return artifacts;
}

/**
 * Execute DevOps Agent (DEPENDENCIES phase)
 * Generates: dependencies.json, deployment-config.md
 */
async function executeDevOpsAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  prd: string,
  stackChoice: string = 'nextjs_web_app',
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  logger.info('[DEPENDENCIES] Executing DevOps Agent');

  const agentConfig = configLoader.getSection('agents').devops;
  const dependencyContract = buildDependencyContract({
    templateId: stackChoice,
    prdContent: prd,
    packageManager: 'pnpm',
  });
  const detectedFeatures = detectFeaturesFromPRD(prd, stackChoice);
  const dependencyPreset = formatDependencyPresetForPrompt({
    templateId: stackChoice,
    contract: dependencyContract,
    detectedFeatures,
  });

  const prompt = buildPrompt(agentConfig.prompt_template, {
    prd: prd,
    stackChoice: stackChoice,
    projectName: projectName || 'Untitled Project',
    dependencyPreset,
    detectedFeatures: detectedFeatures.length
      ? detectedFeatures.join(', ')
      : 'None',
  });

  // Use structured output for reliable JSON artifact generation
  const expectedFiles = ['dependencies.json', 'DEPENDENCIES.md'];

  const structuredArtifacts = await (
    llmClient as unknown as {
      generateStructuredArtifacts: (
        prompt: string,
        expectedFiles: string[],
        phase?: string,
        options?: {
          temperature?: number;
          maxOutputTokens?: number;
          retries?: number;
        }
      ) => Promise<Record<string, string | Buffer>>;
    }
  ).generateStructuredArtifacts(prompt, expectedFiles, 'DEPENDENCIES', {
    temperature: 0.3,
    maxOutputTokens: 8192,
    retries: 2,
  });

  logger.info('[DEPENDENCIES] DevOps Agent completed', {
    artifacts: Object.keys(structuredArtifacts),
  });
  return structuredArtifacts;
}

// ============================================================================
// EXPORTED WRAPPER FUNCTIONS FOR ORCHESTRATOR
// ============================================================================
// These are called directly by OrchestratorEngine
// They create ConfigLoader locally (before any awaits) to avoid context loss

export async function getAnalystExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const configLoader = new ConfigLoader();
  const projectIdea = asString(
    artifacts['project_idea'] || 'Project for analysis'
  );
  return executeAnalystAgent(llmClient, configLoader, projectIdea, projectName);
}

export async function getPMExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const configLoader = new ConfigLoader();
  const brief = asString(artifacts['ANALYSIS/project-brief.md'] || '');
  const personas = asString(artifacts['ANALYSIS/personas.md'] || '');
  return executePMAgent(llmClient, configLoader, brief, personas, projectName);
}

export async function getArchitectExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  phase: 'SPEC' | 'SPEC_ARCHITECT' | 'SOLUTIONING' = 'SOLUTIONING',
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const configLoader = new ConfigLoader();
  const brief = asString(artifacts['ANALYSIS/project-brief.md'] || '');
  const personas = asString(artifacts['ANALYSIS/personas.md'] || '');
  const constitution = asString(artifacts['ANALYSIS/constitution.md'] || '');
  // Support both SPEC_PM and SPEC paths for PRD
  const prd = asString(
    artifacts['SPEC_PM/PRD.md'] || artifacts['SPEC/PRD.md'] || ''
  );
  return executeArchitectAgent(
    llmClient,
    configLoader,
    phase,
    brief,
    personas,
    constitution,
    prd,
    stackChoice,
    projectName
  );
}

export async function getStackSelectionExecutor(
  llmClient: LLMProvider,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const configLoader = new ConfigLoader();
  const brief = asString(artifacts['ANALYSIS/project-brief.md'] || '');
  const personas = asString(artifacts['ANALYSIS/personas.md'] || '');
  const constitution = asString(artifacts['ANALYSIS/constitution.md'] || '');
  const classificationRaw = asString(
    artifacts['ANALYSIS/project-classification.json'] || ''
  );
  const classification = parseProjectClassification(classificationRaw);
  const defaultStack = deriveIntelligentDefaultStack(classification, brief);
  return executeArchitectAgent(
    llmClient,
    configLoader,
    'STACK_SELECTION',
    brief,
    personas,
    constitution,
    '',
    undefined,
    projectName,
    classificationRaw,
    defaultStack.stack,
    defaultStack.reason
  );
}

export async function getScruMasterExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const configLoader = new ConfigLoader();
  const prd = asString(artifacts['SPEC/PRD.md'] || '');
  const dataModel = asString(artifacts['SPEC/data-model.md'] || '');
  const apiSpec = asString(artifacts['SPEC/api-spec.json'] || '');
  return executeScrumMasterAgent(
    llmClient,
    configLoader,
    prd,
    dataModel,
    apiSpec,
    projectName
  );
}

export async function getDevOpsExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const configLoader = new ConfigLoader();
  const prd = asString(artifacts['SPEC/PRD.md'] || '');
  return executeDevOpsAgent(
    llmClient,
    configLoader,
    prd,
    stackChoice || 'nextjs_web_app',
    projectName
  );
}

// ============================================================================
// DESIGN SYSTEM EXECUTOR
// ============================================================================

/**
 * Execute Design System Agent
 * Generates design-tokens.md, component-mapping.md, and journey-maps.md
 * Following fire-your-design-team.md principles and orchestrator_spec.yml phase definitions
 */
async function executeDesignAgent(
  llmClient: LLMProvider,
  projectBrief: string,
  prd: string,
  personas: string,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  logger.info('[SPEC] Executing Design Agent', {
    briefLength: projectBrief?.length || 0,
    prdLength: prd?.length || 0,
    personasLength: personas?.length || 0,
    projectName,
  });

  const designSystemPrompt = `You are a Senior UI/UX Designer following strict design system principles.

## Project: ${projectName || 'Untitled Project'}

## Context:
${projectBrief.slice(0, 8000)}

## User Personas:
${personas.slice(0, 4000)}

## Requirements (from PRD):
${prd.slice(0, 15000)}

## CRITICAL DESIGN PRINCIPLES (from fire-your-design-team.md):

### Typography: ONLY 4 sizes, 2 weights
- body: 14-16px (regular weight) - default text
- label: 12-13px (regular weight) - small labels, captions  
- heading: 20-24px (semibold) - section headers
- display: 32-48px (semibold) - hero text, page titles
- NO OTHER SIZES ALLOWED

### Font Selection (CRITICAL - Will fail validation if ignored):
- **NEVER use Inter** - this is considered "AI slop" and will be rejected
- Choose a font appropriate to the project's personality:
  - Professional/Corporate: "DM Sans", "IBM Plex Sans", "Source Sans Pro"
  - Creative/Modern: "Outfit", "Space Grotesk", "Manrope"
  - Editorial/Content: "Merriweather", "Lora", "Crimson Pro"
  - Technical/Developer: "JetBrains Mono", "Fira Code", "IBM Plex Mono"
- Use system font stack as fallback: -apple-system, BlinkMacSystemFont, system-ui, sans-serif

### Spacing: 8pt Grid ONLY
- All spacing values MUST be: 8, 16, 24, 32, 48, 64, 96
- NO values like 10, 15, 20, 25, 30

### Color: 60/30/10 Rule
- 60% neutral (background)
- 30% secondary (text, borders)
- 10% accent (brand color, CTAs)
- NEVER use purple as default primary (common AI slop)
- Choose brand colors based on project context

### Animation: Framer Motion
- Duration scale: 150ms (fast), 200ms (normal), 300ms (slow), 500ms (emphasis)
- Spring config: { stiffness: 400, damping: 30 } for snappy interactions
- Always include reduced motion alternatives

### ANTI-PATTERNS TO AVOID (AI Slop - Will cause validation failure):
- NO "Inter" font anywhere in the document - VALIDATION WILL FAIL
- NO purple/violet as primary color unless brand-specific
- NO gradient blob backgrounds
- NO excessive border radius (max 12px for containers)
- NO generic "modern" purple gradient buttons

Generate a design-system.md file with:
1. Color palette (with semantic names and HSL values)
2. Typography scale (exactly 4 sizes)
3. Spacing tokens (8pt grid values only)
4. Border radius tokens (max 12px)
5. Shadow tokens
6. Motion tokens (Framer Motion durations and springs)
7. Breakpoints

Output format:
\`\`\`markdown
filename: design-tokens.md
---
title: "Design System"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# Design System for ${projectName || 'Project'}

## Color Palette
... (include semantic colors with HSL values)

## Typography
... (exactly 4 sizes, 2 weights)

## Spacing
... (8pt grid: 8, 16, 24, 32, 48, 64)

## Motion
... (Framer Motion duration scale and spring configs)

## Components
... (shadcn/ui component customizations)
\`\`\``;

  const componentInventoryPrompt = `You are a Senior UI/UX Designer creating a component inventory.

## Project: ${projectName || 'Untitled Project'}

## PRD Features:
${prd.slice(0, 15000)}

Generate component-mapping.md listing ALL UI components needed for this project and their mapping to the design system.

For each component, specify:
1. Component name
2. shadcn/ui base component (if applicable)
3. Props/variants needed
4. Animation requirements (Framer Motion)

Output format:
\`\`\`markdown
filename: component-mapping.md
---
title: "Component Mapping"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# Component Mapping

## Layout Components
| Component | Base | Variants | Animation |
|-----------|------|----------|-----------|
| ... | ... | ... | ... |

## Form Components
| Component | Base | Variants | Animation |
|-----------|------|----------|-----------|
| ... | ... | ... | ... |

## Data Display
| Component | Base | Variants | Animation |
|-----------|------|----------|-----------|
| ... | ... | ... | ... |

## Feedback Components
| Component | Base | Variants | Animation |
|-----------|------|----------|-----------|
| ... | ... | ... | ... |

## Custom Components (not in shadcn/ui)
| Component | Purpose | Props |
|-----------|---------|-------|
| ... | ... | ... |
\`\`\``;

  const userFlowsPrompt = `You are a Senior UI/UX Designer creating user flow documentation.

## Project: ${projectName || 'Untitled Project'}

## User Personas:
${personas.slice(0, 4000)}

## PRD Features:
${prd.slice(0, 15000)}

Generate journey-maps.md documenting the key user journeys and interaction patterns.

For each flow:
1. Flow name and description
2. User persona
3. Steps (numbered)
4. Key screens/states
5. Success criteria
6. Error states

Output format:
\`\`\`markdown
filename: journey-maps.md
---
title: "Journey Maps"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# Journey Maps

## Flow 1: [Primary User Journey]
**Persona**: [Target persona]
**Goal**: [What the user wants to accomplish]

### Steps
1. [Step 1]
2. [Step 2]
...

### Screens
- Screen A: [Description]
- Screen B: [Description]

### Success State
[What success looks like]

### Error States
- Error 1: [Description and recovery]
- Error 2: [Description and recovery]

## Flow 2: [Secondary Journey]
...
\`\`\``;

  // Generate all three design artifacts
  const [designSystemResponse, componentResponse, userFlowsResponse] =
    await Promise.all([
      llmClient.generateCompletion(designSystemPrompt, undefined, 2, 'SPEC'),
      llmClient.generateCompletion(
        componentInventoryPrompt,
        undefined,
        2,
        'SPEC'
      ),
      llmClient.generateCompletion(userFlowsPrompt, undefined, 2, 'SPEC'),
    ]);

  const artifacts: Record<string, string | Buffer> = {};

  // Parse design-tokens.md
  const designSystemArtifacts = await parseArtifactsWithValidation(
    designSystemResponse.content,
    ['design-tokens.md'],
    llmClient,
    designSystemPrompt,
    'SPEC',
    2
  );
  if (designSystemArtifacts['design-tokens.md']) {
    artifacts['design-tokens.md'] = designSystemArtifacts['design-tokens.md'];
  }

  // Parse component-mapping.md
  const componentArtifacts = await parseArtifactsWithValidation(
    componentResponse.content,
    ['component-mapping.md'],
    llmClient,
    componentInventoryPrompt,
    'SPEC',
    2
  );
  if (componentArtifacts['component-mapping.md']) {
    artifacts['component-mapping.md'] =
      componentArtifacts['component-mapping.md'];
  }

  // Parse journey-maps.md
  const userFlowsArtifacts = await parseArtifactsWithValidation(
    userFlowsResponse.content,
    ['journey-maps.md'],
    llmClient,
    userFlowsPrompt,
    'SPEC',
    2
  );
  if (userFlowsArtifacts['journey-maps.md']) {
    artifacts['journey-maps.md'] = userFlowsArtifacts['journey-maps.md'];
  }

  logger.info('[SPEC] Design Agent completed', {
    artifacts: Object.keys(artifacts),
    designTokensLength: artifacts['design-tokens.md']?.length || 0,
    componentMappingLength: artifacts['component-mapping.md']?.length || 0,
    journeyMapsLength: artifacts['journey-maps.md']?.length || 0,
  });

  return artifacts;
}

export async function getDesignExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  const brief = asString(artifacts['ANALYSIS/project-brief.md'] || '');
  const prd = asString(artifacts['SPEC/PRD.md'] || '');
  const personas = asString(artifacts['ANALYSIS/personas.md'] || '');
  return executeDesignAgent(llmClient, brief, prd, personas, projectName);
}

/**
 * Design Agent - UI/UX Designer and Design Systems Architect
 * Perspective: Head of Design
 * Expertise: UI/UX design, design systems, accessibility, color theory
 */
export function getDesignerExecutor(config: AgentConfig = {}): AgentExecutor {
  return {
    role: 'designer',
    perspective: 'head_of_design',
    expertise: [
      'ui_ux_design',
      'design_systems',
      'accessibility',
      'color_theory',
    ],

    async generateArtifacts(context: any): Promise<ArtifactGenerationResult> {
      const {
        phase,
        stack,
        constitution,
        projectBrief,
        projectPath,
        projectId,
        llmClient,
      } = context;

      // Build design context from project inputs
      const designContext = {
        phase,
        stack,
        constitution,
        projectBrief,
        projectPath,
        projectId,
        antiAISlopRules: {
          forbidden: [
            'purple gradients',
            'Inter font default',
            'blob backgrounds',
          ],
          required: [
            'OKLCH colors',
            '60/30/10 rule',
            '8pt grid',
            '4 typography sizes',
          ],
        },
      };

      // llmClient must be provided in context (passed from orchestrator)
      if (!llmClient) {
        throw new Error(
          'llmClient is required in context for getDesignerExecutor.generateArtifacts'
        );
      }

      // Generate artifacts using LLM
      const llmPrompt = `You are a Head of Design (UI/UX Designer and Design Systems Architect).

## Phase: ${phase}
## Stack: ${stack || 'Not selected yet (stack-agnostic)'}

## Anti-AI-Slop Rules (STRICTLY ENFORCE):
FORBIDDEN:
- Purple gradients
- Inter font as default
- Blob backgrounds

REQUIRED:
- OKLCH color system (not RGB/HEX)
- 60/30/10 color rule (60% light, 30% medium, 10% dark)
- 8pt grid system
- 4 typography sizes minimum
- Design tokens first, components second

## Project Context:
${projectBrief ? `Project Brief:\n${projectBrief}\n\n` : ''}
${constitution ? `Constitution:\n${constitution}\n\n` : ''}
${stack ? `Tech Stack:\n${stack}\n\n` : ''}

${
  phase === 'SPEC_DESIGN_TOKENS'
    ? `Generate design-tokens.md with:

1. Colors (OKLCH format)
   - Primary: 60% lightness
   - Secondary: 30% lightness  
   - Accent: 10% lightness

2. Typography (4 sizes, 8pt grid)
   - Display: 32px (8pt base)
   - Heading: 24px
   - Body: 16px
   - Caption: 14px

3. Spacing (8pt grid)
   - Base spacing unit: 8px
   - Scale: 8, 16, 24, 32, 40, 48

4. Animation tokens
   - Duration
   - Easing
   - Delay

5. Shadow tokens (if needed)

6. Border radius tokens

7. Z-index scale

Format as markdown with frontmatter.`
    : `Generate TWO separate files: component-mapping.md and journey-maps.md

IMPORTANT: Output MUST follow this exact structure with file markers:

---FILE: component-mapping.md---
---
title: "Component Mapping"
owner: "designer"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# Component Mapping

## Design Tokens to Component Props
- Color tokens mapped to component props
- Typography tokens to text components
- Spacing tokens to layout components

## Stack-Specific Components
- ${
        stack
          ? `Components for ${stack}`
          : 'Shadcn/ui components (if React/Next.js)'
      }
- Component variants and states
- Props interface for each component

---FILE: journey-maps.md---
---
title: "Journey Maps"
owner: "designer"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# Journey Maps

## User Flows
- Key user journeys
- Screen states and transitions

## Interactions
- Transition animations
- Micro-interactions
- Accessibility considerations

You MUST include both ---FILE: markers exactly as shown above.`
}`;

      const llmResponse = await llmClient.generateCompletion(
        llmPrompt,
        undefined,
        2,
        phase
      );

      // Parse artifacts from response
      const artifacts: Record<string, string | Buffer> = {};

      if (phase === 'SPEC_DESIGN_TOKENS') {
        // Use structured output for reliable single-file generation
        const structuredArtifacts = await (
          llmClient as unknown as {
            generateStructuredArtifacts: (
              prompt: string,
              expectedFiles: string[],
              phase?: string,
              options?: {
                temperature?: number;
                maxOutputTokens?: number;
                retries?: number;
              }
            ) => Promise<Record<string, string | Buffer>>;
          }
        ).generateStructuredArtifacts(llmPrompt, ['design-tokens.md'], phase, {
          temperature: 0.3,
          maxOutputTokens: 8192,
          retries: 2,
        });
        artifacts['design-tokens.md'] = structuredArtifacts['design-tokens.md'];
      } else if (phase === 'SPEC_DESIGN_COMPONENTS') {
        // CRITICAL: Use two-file structured output to ensure BOTH files are generated
        // The LLM sometimes ignores the two-file requirement, so structured output ENFORCES it
        const structuredArtifacts = await (
          llmClient as unknown as {
            generateStructuredArtifacts: (
              prompt: string,
              expectedFiles: string[],
              phase?: string,
              options?: {
                temperature?: number;
                maxOutputTokens?: number;
                retries?: number;
              }
            ) => Promise<Record<string, string | Buffer>>;
          }
        ).generateStructuredArtifacts(
          llmPrompt,
          ['component-mapping.md', 'journey-maps.md'],
          phase,
          { temperature: 0.3, maxOutputTokens: 8192, retries: 2 }
        );

        artifacts['component-mapping.md'] =
          structuredArtifacts['component-mapping.md'];
        artifacts['journey-maps.md'] = structuredArtifacts['journey-maps.md'];
      }

      logger.info('[DESIGNER] Artifacts generated', {
        phase,
        artifacts: Object.keys(artifacts),
        stackAgnostic: phase === 'SPEC_DESIGN_TOKENS',
      });

      return {
        success: true,
        artifacts,
        metadata: {
          phase,
          agent: 'designer',
          generatedAt: new Date().toISOString(),
          stackAgnostic: phase === 'SPEC_DESIGN_TOKENS',
          stack: stack,
        },
      };
    },

    validateArtifacts(
      artifacts: Record<string, string | Buffer>
    ): ValidationResult {
      const results: ValidationIssue[] = [];

      for (const [artifactName, content] of Object.entries(artifacts)) {
        // Anti-AI-Slop validation
        const forbiddenPatterns = [
          'purple-gradient',
          'blob background',
          'Inter, sans-serif',
          '"Inter",',
          "'Inter'",
        ];
        const requiredPatterns = [
          'oklch',
          '60/30/10',
          '8pt',
          'typography-sizes',
        ];

        forbiddenPatterns.forEach((pattern) => {
          const contentStr = asString(content);
          if (contentStr.toLowerCase().includes(pattern)) {
            results.push({
              severity: 'error',
              artifactId: artifactName,
              message: `Anti-AI-slop violation: forbidden pattern "${pattern}" detected`,
            });
          }
        });

        requiredPatterns.forEach((pattern) => {
          const contentStr = asString(content);
          if (!contentStr.toLowerCase().includes(pattern)) {
            results.push({
              severity: 'warning',
              artifactId: artifactName,
              message: `Anti-AI-slop warning: required pattern "${pattern}" not found`,
            });
          }
        });
      }

      return {
        canProceed: !results.some((r) => r.severity === 'error'),
        issues: results,
      };
    },
  };
}

/**
 * Execute DONE phase - Generate handoff package
 * Generates: README.md, HANDOFF.md, project.zip
 */
export async function getHandoffExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string | Buffer>,
  projectName?: string
): Promise<Record<string, string | Buffer>> {
  logger.info('[DONE] Generating handoff package');

  const { HandoffGenerator } = await import(
    '@/backend/services/file_system/handoff_generator'
  );

  // Extract stack choice from artifacts for project metadata
  const stackDecision = asString(
    artifacts['STACK_SELECTION/stack-decision.md'] || ''
  );
  const stackMatch = stackDecision.match(
    /##? Approved Stack.*?\n([\s\S]*?)(?=\n##|\n#|$)/i
  );
  const stackChoice = stackMatch
    ? stackMatch[1].trim().split('\n')[0].replace(/^- /, '')
    : 'custom';

  const projectMetadata = {
    name: projectName,
    stack_choice: stackChoice,
  };

  const handoffGenerator = new HandoffGenerator(projectId, artifacts);

  // Generate README.md
  const readmeContent = await handoffGenerator.generateReadme(
    undefined,
    projectMetadata
  );

  // Generate HANDOFF.md
  const handoffContent = await handoffGenerator.generateHandoff(
    undefined,
    projectMetadata
  );

  // Create actual project.zip
  const zipBuffer = await handoffGenerator.createZip();

  logger.info('[DONE] Handoff package generated', {
    readmeLength: readmeContent?.length || 0,
    handoffLength: handoffContent?.length || 0,
    zipSize: zipBuffer.length,
  });

  return {
    'README.md': readmeContent || '',
    'HANDOFF.md': handoffContent || '',
    'project.zip': zipBuffer,
  };
}
