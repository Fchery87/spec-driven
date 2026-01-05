import { LLMProvider } from './providers/base';
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
  validateArtifacts?: (artifacts: Record<string, string>) => ValidationResult;
}

export interface ArtifactGenerationResult {
  success: boolean;
  artifacts: Record<string, string>;
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
// ARTIFACT PARSING
// ============================================================================

function parseArtifacts(
  content: string,
  expectedFiles: string[]
): Record<string, string> {
  const artifacts: Record<string, string> = {};
  const expectedMap = expectedFiles.reduce<Record<string, string>>(
    (map, filename) => {
      map[filename.toLowerCase()] = filename;
      return map;
    },
    {}
  );

  // Try to extract files from markdown code blocks with explicit filename markers
  // Supports:
  // ```markdown filename: plan.md\n...``` and
  // ```\nfilename: plan.md\n...```
  const fileRegex =
    /```(?:(\w+)[ \t]*)?\n?filename:\s*([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = fileRegex.exec(content)) !== null) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, language, filename, fileContent] = match;
    const rawName = filename.trim();
    const normalizedName = expectedMap[rawName.toLowerCase()] || rawName;
    artifacts[normalizedName] = fileContent.trim();
  }

  // Special handling for JSON files - try to extract JSON blocks
  for (const filename of expectedFiles) {
    if (filename.endsWith('.json') && !artifacts[filename]) {
      // Try multiple patterns for JSON extraction
      // Pattern 1: ```json\n{...}```
      const jsonBlockRegex = /```json\s*\n(\{[\s\S]*?\})\s*```/g;
      let jsonMatch;
      while ((jsonMatch = jsonBlockRegex.exec(content)) !== null) {
        const jsonContent = jsonMatch[1].trim();
        // Validate it's actually valid JSON
        try {
          JSON.parse(jsonContent);
          artifacts[filename] = jsonContent;
          break;
        } catch {
          // Not valid JSON, continue searching
        }
      }

      // Pattern 2: Look for OpenAPI structure specifically
      if (!artifacts[filename]) {
        const openapiMatch = content.match(/"openapi"\s*:\s*"[\d.]+"/);
        if (openapiMatch) {
          // Find the complete JSON object containing openapi
          const startIndex = content.lastIndexOf('{', openapiMatch.index);
          if (startIndex !== -1) {
            // Try to find matching closing brace
            let braceCount = 0;
            let endIndex = -1;
            for (let i = startIndex; i < content.length; i++) {
              if (content[i] === '{') braceCount++;
              if (content[i] === '}') braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
            if (endIndex !== -1) {
              const jsonContent = content.slice(startIndex, endIndex);
              try {
                JSON.parse(jsonContent);
                artifacts[filename] = jsonContent;
              } catch {
                // Failed to parse, continue
              }
            }
          }
        }
      }
    }
  }

  // If some but not all files found, try header-based parsing
  if (
    Object.keys(artifacts).length > 0 &&
    Object.keys(artifacts).length < expectedFiles.length
  ) {
    for (const filename of expectedFiles) {
      if (!artifacts[filename]) {
        const fileHeader = new RegExp(
          `#?\\s*${filename.replace('.', '\\.')}`,
          'i'
        );
        const parts = content.split(fileHeader);

        if (parts.length > 1) {
          let fileContent = parts[1];
          for (const otherFile of expectedFiles) {
            if (otherFile !== filename) {
              const nextHeader = new RegExp(
                `#?\\s*${otherFile.replace('.', '\\.')}`,
                'i'
              );
              const headerParts = fileContent.split(nextHeader);
              if (headerParts.length > 1) {
                fileContent = headerParts[0];
                break;
              }
            }
          }
          artifacts[filename] = fileContent.trim();
        }
      }
    }
  }

  // If no files extracted, try header-based parsing for all expected files
  if (Object.keys(artifacts).length === 0) {
    for (const filename of expectedFiles) {
      const fileHeader = new RegExp(
        `#?\\s*${filename.replace('.', '\\.')}`,
        'i'
      );
      const parts = content.split(fileHeader);

      if (parts.length > 1) {
        let fileContent = parts[1];
        for (const otherFile of expectedFiles) {
          if (otherFile !== filename) {
            const nextHeader = new RegExp(
              `#?\\s*${otherFile.replace('.', '\\.')}`,
              'i'
            );
            const headerParts = fileContent.split(nextHeader);
            if (headerParts.length > 1) {
              fileContent = headerParts[0];
              break;
            }
          }
        }
        artifacts[filename] = fileContent.trim();
      }
    }
  }

  // Fallback: if still no artifacts, put entire content into first file
  if (Object.keys(artifacts).length === 0 && expectedFiles.length > 0) {
    logger.warn(
      `Failed to parse artifacts. Expected files: ${expectedFiles.join(', ')}`
    );
    logger.warn(
      `Putting entire response in first expected file: ${expectedFiles[0]}`
    );
    artifacts[expectedFiles[0]] = content;
  }

  // Fill missing files with empty strings
  for (const filename of expectedFiles) {
    if (!artifacts[filename]) {
      logger.warn(
        `Missing expected artifact: ${filename}. Creating placeholder.`
      );
      artifacts[filename] = '';
    }
  }

  return artifacts;
}

// ============================================================================
// PURE EXECUTOR FUNCTIONS
// ============================================================================

/**
 * Execute Analyst Agent (ANALYSIS phase)
 * Generates: constitution.md, project-brief.md, project-classification.json, personas.md
 */
async function executeAnalystAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  projectIdea: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info('[ANALYSIS] Executing Analyst Agent');

  const agentConfig = configLoader.getSection('agents').analyst;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    projectIdea,
    projectName: projectName || 'Untitled Project',
  });

  const response = await llmClient.generateCompletion(
    prompt,
    undefined,
    3,
    'ANALYSIS'
  );
  const artifacts = parseArtifacts(response.content, [
    'constitution.md',
    'project-brief.md',
    'project-classification.json',
    'personas.md',
  ]);

  logger.info('[ANALYSIS] Agent completed', {
    artifacts: Object.keys(artifacts),
  });
  return artifacts;
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
): Promise<Record<string, string>> {
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
  const artifacts = parseArtifacts(response.content, ['PRD.md']);

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
): Promise<Record<string, string>> {
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
      'stack-analysis.md',
      'stack-decision.md',
      'stack-rationale.md',
      'stack.json',
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
  } else if (phase === 'SPEC' || phase === 'SPEC_ARCHITECT') {
    // SPEC and SPEC_ARCHITECT both generate data-model.md and api-spec.json
    expectedFiles = ['data-model.md', 'api-spec.json'];
    variables = {
      brief: projectBrief,
      personas,
      constitution,
      prd: prd,
      phase: 'SPEC',
      stackChoice: stackChoice || 'web_application',
      projectName: projectName || 'Untitled Project',
    };
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
    const stackTemplates: Record<string, string> = {
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
    const artifacts = parseArtifacts(response.content, expectedFiles);

    // If parsing failed, use raw response
    if (
      !artifacts['architecture.md'] ||
      artifacts['architecture.md'].trim().length < 500
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

  const prompt = buildPrompt(agentConfig.prompt_template, variables);
  const response = await llmClient.generateCompletion(
    prompt,
    undefined,
    3,
    phase
  );
  const artifacts = parseArtifacts(response.content, expectedFiles);

  logger.info(`[${phase}] Architect Agent initial parse`, {
    artifacts: Object.keys(artifacts),
    dataModelLength: artifacts['data-model.md']?.length || 0,
    apiSpecLength: artifacts['api-spec.json']?.length || 0,
  });

  // Fallback: If api-spec.json is empty in SPEC or SPEC_ARCHITECT phase, try to regenerate it specifically
  if (
    (phase === 'SPEC' || phase === 'SPEC_ARCHITECT') &&
    (!artifacts['api-spec.json'] ||
      artifacts['api-spec.json'].trim().length < 100)
  ) {
    logger.warn(
      `[${phase}] api-spec.json missing or too short, triggering fallback generation`
    );
    const fallbackPrompt = `You are a Chief Architect. Generate ONLY an OpenAPI 3.0.3 specification based on the following PRD.

## PRD Summary:
${prd.slice(0, 20000)}

## Requirements:
1. Output ONLY valid JSON - no markdown, no explanation
2. Must include "openapi": "3.0.3"
3. Include all CRUD endpoints for entities mentioned in the PRD
4. Include authentication endpoints (register, login, logout)
5. Include proper schemas in components
6. Include error responses (400, 401, 403, 404, 500)

Output the complete OpenAPI JSON now:`;

    const apiSpecResponse = await llmClient.generateCompletion(
      fallbackPrompt,
      undefined,
      3,
      phase
    );

    // Try to extract JSON from the response
    let apiSpecContent = apiSpecResponse.content.trim();

    // Remove markdown code fences if present
    if (apiSpecContent.startsWith('```')) {
      apiSpecContent = apiSpecContent
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '');
    }

    // Try to parse to validate
    try {
      JSON.parse(apiSpecContent);
      artifacts['api-spec.json'] = apiSpecContent;
      logger.info('[SPEC] api-spec.json fallback generation successful', {
        length: apiSpecContent.length,
      });
    } catch (e) {
      logger.error(
        '[SPEC] api-spec.json fallback generation failed to produce valid JSON'
      );
    }
  }

  // Fallback: If data-model.md is too short in SPEC or SPEC_ARCHITECT phase, try to regenerate
  if (
    (phase === 'SPEC' || phase === 'SPEC_ARCHITECT') &&
    (!artifacts['data-model.md'] ||
      artifacts['data-model.md'].trim().length < 500)
  ) {
    logger.warn(
      `[${phase}] data-model.md missing or too short, triggering fallback generation`
    );

    // Extract key entities from PRD to focus the generation
    const prdSummary = prd.slice(0, 15000);

    const fallbackPrompt = `You are a Chief Architect. Generate a CONCISE but complete data-model.md.

## PRD Context:
${prdSummary}

## CRITICAL INSTRUCTIONS:
- Be CONCISE - focus on core entities only (5-10 tables max for MVP)
- Use compact table format, not verbose descriptions
- Keep the total output under 3000 words

## Required Sections (keep each brief):

### 1. ER Diagram (Mermaid)
\`\`\`mermaid
erDiagram
    USER ||--o{ POST : creates
    (add 5-10 key relationships)
\`\`\`

### 2. Table Schemas (use this compact format):
**users**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
(continue for each table)

### 3. Key Indexes (one-liners)
- \`idx_users_email\` on users(email)

### 4. Enums (if needed)
\`\`\`sql
CREATE TYPE status AS ENUM ('active', 'inactive');
\`\`\`

## Output format:
\`\`\`
filename: data-model.md
---
title: Data Model
owner: architect
version: 1.0
date: ${new Date().toISOString().split('T')[0]}
status: draft
---

(content here - keep it focused and concise)
\`\`\`

Generate now:`;

    // Use SOLUTIONING phase config for fallback (has 32768 tokens vs 16384 for SPEC)
    const dataModelResponse = await llmClient.generateCompletion(
      fallbackPrompt,
      undefined,
      3,
      'SOLUTIONING'
    );
    const fallbackArtifacts = parseArtifacts(dataModelResponse.content, [
      'data-model.md',
    ]);

    if (
      fallbackArtifacts['data-model.md'] &&
      fallbackArtifacts['data-model.md'].trim().length > 500
    ) {
      artifacts['data-model.md'] = fallbackArtifacts['data-model.md'];
      logger.info('[SPEC] data-model.md fallback generation successful', {
        length: artifacts['data-model.md'].length,
      });
    } else {
      // If still too short, use the response content directly if it looks like a data model
      const rawContent = dataModelResponse.content;
      if (
        rawContent.includes('erDiagram') ||
        rawContent.includes('Table') ||
        rawContent.includes('Column')
      ) {
        artifacts['data-model.md'] = rawContent;
        logger.info('[SPEC] data-model.md using raw response', {
          length: rawContent.length,
        });
      } else {
        logger.error(
          '[SPEC] data-model.md fallback generation failed to produce sufficient content'
        );
      }
    }
  }

  logger.info(`[${phase}] Architect Agent completed`, {
    artifacts: Object.keys(artifacts),
    dataModelLength: artifacts['data-model.md']?.length || 0,
    apiSpecLength: artifacts['api-spec.json']?.length || 0,
  });
  return artifacts;
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
): Promise<Record<string, string>> {
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
  const artifacts = parseArtifacts(response.content, [
    'epics.md',
    'tasks.md',
    'plan.md',
  ]);

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
 * Generates: DEPENDENCIES.md, dependencies.json
 */
async function executeDevOpsAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  prd: string,
  stackChoice: string = 'nextjs_web_app',
  projectName?: string
): Promise<Record<string, string>> {
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

  const response = await llmClient.generateCompletion(
    prompt,
    undefined,
    3,
    'DEPENDENCIES'
  );
  const artifacts = parseArtifacts(response.content, [
    'DEPENDENCIES.md',
    'dependencies.json',
  ]);

  if (!artifacts['DEPENDENCIES.md']) {
    artifacts['DEPENDENCIES.md'] = `---
title: Dependencies
owner: devops
version: 1.0
date: ${new Date().toISOString().split('T')[0]}
status: draft
---

# Dependencies

## Stack Template
- ${stackChoice}

## Core Dependencies
${dependencyContract.baseline.dependencies
  .map((dep) => `- ${dep.name}@${dep.range}`)
  .join('\n')}

## Dev Dependencies
${
  dependencyContract.baseline.devDependencies.length > 0
    ? dependencyContract.baseline.devDependencies
        .map((dep) => `- ${dep.name}@${dep.range}`)
        .join('\n')
    : '- None'
}

## Add-ons
${
  dependencyContract.addons.length > 0
    ? dependencyContract.addons
        .map(
          (addon) =>
            `### ${addon.capability}\n${addon.packages
              .map((dep) => `- ${dep.name}@${dep.range}`)
              .join('\n')}`
        )
        .join('\n\n')
    : 'None'
}
`;
  }

  artifacts['dependencies.json'] = JSON.stringify(dependencyContract, null, 2);

  logger.info('[DEPENDENCIES] DevOps Agent completed', {
    artifacts: Object.keys(artifacts),
  });
  return artifacts;
}

// ============================================================================
// EXPORTED WRAPPER FUNCTIONS FOR ORCHESTRATOR
// ============================================================================
// These are called directly by OrchestratorEngine
// They create ConfigLoader locally (before any awaits) to avoid context loss

export async function getAnalystExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string>,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const projectIdea = artifacts['project_idea'] || 'Project for analysis';
  return executeAnalystAgent(llmClient, configLoader, projectIdea, projectName);
}

export async function getPMExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const personas = artifacts['ANALYSIS/personas.md'] || '';
  return executePMAgent(llmClient, configLoader, brief, personas, projectName);
}

export async function getArchitectExecutor(
  llmClient: LLMProvider,
  projectId: string,
  artifacts: Record<string, string>,
  phase: 'SPEC' | 'SPEC_ARCHITECT' | 'SOLUTIONING' = 'SOLUTIONING',
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const personas = artifacts['ANALYSIS/personas.md'] || '';
  const constitution = artifacts['ANALYSIS/constitution.md'] || '';
  // Support both SPEC_PM and SPEC paths for PRD
  const prd = artifacts['SPEC_PM/PRD.md'] || artifacts['SPEC/PRD.md'] || '';
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
  artifacts: Record<string, string>,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const personas = artifacts['ANALYSIS/personas.md'] || '';
  const constitution = artifacts['ANALYSIS/constitution.md'] || '';
  const classificationRaw =
    artifacts['ANALYSIS/project-classification.json'] || '';
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
  artifacts: Record<string, string>,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const prd = artifacts['SPEC/PRD.md'] || '';
  const dataModel = artifacts['SPEC/data-model.md'] || '';
  const apiSpec = artifacts['SPEC/api-spec.json'] || '';
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
  artifacts: Record<string, string>,
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const prd = artifacts['SPEC/PRD.md'] || '';
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
): Promise<Record<string, string>> {
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

  const artifacts: Record<string, string> = {};

  // Parse design-tokens.md
  const designSystemArtifacts = parseArtifacts(designSystemResponse.content, [
    'design-tokens.md',
  ]);
  if (designSystemArtifacts['design-tokens.md']) {
    artifacts['design-tokens.md'] = designSystemArtifacts['design-tokens.md'];
  }

  // Parse component-mapping.md
  const componentArtifacts = parseArtifacts(componentResponse.content, [
    'component-mapping.md',
  ]);
  if (componentArtifacts['component-mapping.md']) {
    artifacts['component-mapping.md'] =
      componentArtifacts['component-mapping.md'];
  }

  // Parse journey-maps.md
  const userFlowsArtifacts = parseArtifacts(userFlowsResponse.content, [
    'journey-maps.md',
  ]);
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
  artifacts: Record<string, string>,
  projectName?: string
): Promise<Record<string, string>> {
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const prd = artifacts['SPEC/PRD.md'] || '';
  const personas = artifacts['ANALYSIS/personas.md'] || '';
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
    : `Generate component-mapping.md and journey-maps.md with:

1. Component mapping (design tokens to stack components)
   - Color tokens to component props
   - Typography tokens to text components
   - Spacing tokens to layout components
   - Shadcn components to use (if Next.js)

2. Journey maps (user interaction patterns)
   - Key user flows
   - Screen states
   - Transition animations
   - Micro-interactions
   - Accessibility considerations

Format as markdown with frontmatter.`
}`;

      const llmResponse = await llmClient.generateCompletion(
        llmPrompt,
        undefined,
        2,
        phase
      );

      // Parse artifacts from response
      const artifacts: Record<string, string> = {};

      if (phase === 'SPEC_DESIGN_TOKENS') {
        artifacts['design-tokens.md'] = llmResponse.content;
      } else if (phase === 'SPEC_DESIGN_COMPONENTS') {
        // Parse both component-mapping and journey-maps from response
        const sections = llmResponse.content.split('## ');
        sections.forEach((section: string) => {
          if (section.startsWith('Component Mapping')) {
            artifacts['component-mapping.md'] = '## ' + section;
          } else if (section.startsWith('Journey Maps')) {
            artifacts['journey-maps.md'] = '## ' + section;
          }
        });

        // If parsing failed, put all in component-mapping.md
        if (!artifacts['component-mapping.md']) {
          artifacts['component-mapping.md'] = llmResponse.content;
        }
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

    validateArtifacts(artifacts: Record<string, string>): ValidationResult {
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
          if (content.toLowerCase().includes(pattern)) {
            results.push({
              severity: 'error',
              artifactId: artifactName,
              message: `Anti-AI-slop violation: forbidden pattern "${pattern}" detected`,
            });
          }
        });

        requiredPatterns.forEach((pattern) => {
          if (!content.toLowerCase().includes(pattern)) {
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
