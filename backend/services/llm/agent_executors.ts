import { LLMProvider } from './providers/base';
import { ConfigLoader } from '../orchestrator/config_loader';
import { logger } from '@/lib/logger';

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
    ...variables
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

function parseArtifacts(content: string, expectedFiles: string[]): Record<string, string> {
  const artifacts: Record<string, string> = {};
  const expectedMap = expectedFiles.reduce<Record<string, string>>((map, filename) => {
    map[filename.toLowerCase()] = filename;
    return map;
  }, {});

  // Try to extract files from markdown code blocks with explicit filename markers
  // Supports:
  // ```markdown filename: plan.md\n...``` and
  // ```\nfilename: plan.md\n...```
  const fileRegex = /```(?:(\w+)[ \t]*)?\n?filename:\s*([^\n]+)\n([\s\S]*?)```/g;
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
  if (Object.keys(artifacts).length > 0 && Object.keys(artifacts).length < expectedFiles.length) {
    for (const filename of expectedFiles) {
      if (!artifacts[filename]) {
        const fileHeader = new RegExp(`#?\\s*${filename.replace('.', '\\.')}`, 'i');
        const parts = content.split(fileHeader);

        if (parts.length > 1) {
          let fileContent = parts[1];
          for (const otherFile of expectedFiles) {
            if (otherFile !== filename) {
              const nextHeader = new RegExp(`#?\\s*${otherFile.replace('.', '\\.')}`, 'i');
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
      const fileHeader = new RegExp(`#?\\s*${filename.replace('.', '\\.')}`, 'i');
      const parts = content.split(fileHeader);

      if (parts.length > 1) {
        let fileContent = parts[1];
        for (const otherFile of expectedFiles) {
          if (otherFile !== filename) {
            const nextHeader = new RegExp(`#?\\s*${otherFile.replace('.', '\\.')}`, 'i');
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
    logger.warn(`Failed to parse artifacts. Expected files: ${expectedFiles.join(', ')}`);
    logger.warn(`Putting entire response in first expected file: ${expectedFiles[0]}`);
    artifacts[expectedFiles[0]] = content;
  }

  // Fill missing files with empty strings
  for (const filename of expectedFiles) {
    if (!artifacts[filename]) {
      logger.warn(`Missing expected artifact: ${filename}. Creating placeholder.`);
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
 * Generates: constitution.md, project-brief.md, personas.md
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
    projectName: projectName || 'Untitled Project'
  });

  const response = await llmClient.generateCompletion(prompt, undefined, 3, 'ANALYSIS');
  const artifacts = parseArtifacts(response.content, [
    'constitution.md',
    'project-brief.md',
    'personas.md'
  ]);

  logger.info('[ANALYSIS] Agent completed', { artifacts: Object.keys(artifacts) });
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
    projectName: projectName || 'Untitled Project'
  });

  const response = await llmClient.generateCompletion(prompt, undefined, 3, 'SPEC');
  const artifacts = parseArtifacts(response.content, ['PRD.md']);

  logger.info('[SPEC] PM Agent completed', { artifacts: Object.keys(artifacts) });
  return artifacts;
}

/**
 * Execute Architect Agent
 * Can generate different outputs based on phase:
 * - SPEC phase: data-model.md, api-spec.json
 * - SOLUTIONING phase: architecture.md
 */
async function executeArchitectAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  phase: 'SPEC' | 'SOLUTIONING',
  projectBrief: string,
  prd: string = '',
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info(`[${phase}] Executing Architect Agent`, {
    briefLength: projectBrief?.length || 0,
    prdLength: prd?.length || 0,
    stackChoice,
    projectName
  });

  const agentConfig = configLoader.getSection('agents').architect;

  let expectedFiles: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let variables: Record<string, any>;

  if (phase === 'SPEC') {
    expectedFiles = ['data-model.md', 'api-spec.json'];
    variables = {
      brief: projectBrief,
      prd: prd,
      phase: 'spec',
      stackChoice: stackChoice || 'web_application',
      projectName: projectName || 'Untitled Project'
    };
  } else {
    expectedFiles = ['architecture.md'];
    // Use a dedicated, shorter prompt for SOLUTIONING architecture generation
    // Increased limits to provide more context while staying within 64K context window
    const truncatedBrief = projectBrief.slice(0, 10000);
    const truncatedPrd = prd.slice(0, 25000);
    const currentDate = new Date().toISOString().split('T')[0];
    const name = projectName || 'Untitled Project';
    
    logger.info(`[${phase}] Using dedicated architecture prompt`, {
      originalBriefLength: projectBrief.length,
      truncatedBriefLength: truncatedBrief.length,
      originalPrdLength: prd.length,
      truncatedPrdLength: truncatedPrd.length
    });
    
    // Dedicated architecture prompt - much shorter than the full template
    // Get stack template details for consistency
    const stackTemplates: Record<string, string> = {
      'nextjs_fullstack_expo': 'Next.js 14 + TypeScript + Expo for mobile',
      'nextjs_web_only': 'Next.js 14 + TypeScript (web only, no mobile)',
      'hybrid_nextjs_fastapi': 'Next.js frontend + FastAPI Python backend',
      'react_express': 'React SPA + Express.js backend',
      'vue_nuxt': 'Vue 3 + Nuxt 3',
      'svelte_kit': 'SvelteKit fullstack',
      'django_htmx': 'Django + HTMX hypermedia',
      'go_react': 'Go backend + React frontend',
    };
    const chosenStack = stackChoice || 'nextjs_web_only';
    const stackDescription = stackTemplates[chosenStack] || chosenStack;

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

    const response = await llmClient.generateCompletion(architecturePrompt, undefined, 3, phase);
    const artifacts = parseArtifacts(response.content, expectedFiles);
    
    // If parsing failed, use raw response
    if (!artifacts['architecture.md'] || artifacts['architecture.md'].trim().length < 500) {
      logger.warn('[SOLUTIONING] architecture.md parsing failed, using raw response');
      artifacts['architecture.md'] = response.content;
    }
    
    logger.info(`[${phase}] Architect Agent completed`, {
      artifacts: Object.keys(artifacts),
      architectureLength: artifacts['architecture.md']?.length || 0
    });
    return artifacts;
  }

  const prompt = buildPrompt(agentConfig.prompt_template, variables);
  const response = await llmClient.generateCompletion(prompt, undefined, 3, phase);
  const artifacts = parseArtifacts(response.content, expectedFiles);

  logger.info(`[${phase}] Architect Agent initial parse`, {
    artifacts: Object.keys(artifacts),
    dataModelLength: artifacts['data-model.md']?.length || 0,
    apiSpecLength: artifacts['api-spec.json']?.length || 0
  });

  // Fallback: If api-spec.json is empty in SPEC phase, try to regenerate it specifically
  if (phase === 'SPEC' && (!artifacts['api-spec.json'] || artifacts['api-spec.json'].trim().length < 100)) {
    logger.warn('[SPEC] api-spec.json missing or too short, triggering fallback generation');
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

    const apiSpecResponse = await llmClient.generateCompletion(fallbackPrompt, undefined, 3, phase);
    
    // Try to extract JSON from the response
    let apiSpecContent = apiSpecResponse.content.trim();
    
    // Remove markdown code fences if present
    if (apiSpecContent.startsWith('```')) {
      apiSpecContent = apiSpecContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Try to parse to validate
    try {
      JSON.parse(apiSpecContent);
      artifacts['api-spec.json'] = apiSpecContent;
      logger.info('[SPEC] api-spec.json fallback generation successful', { length: apiSpecContent.length });
    } catch (e) {
      logger.error('[SPEC] api-spec.json fallback generation failed to produce valid JSON');
    }
  }

  // Fallback: If data-model.md is too short, try to regenerate
  if (phase === 'SPEC' && (!artifacts['data-model.md'] || artifacts['data-model.md'].trim().length < 500)) {
    logger.warn('[SPEC] data-model.md missing or too short, triggering fallback generation');
    
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
    const dataModelResponse = await llmClient.generateCompletion(fallbackPrompt, undefined, 3, 'SOLUTIONING');
    const fallbackArtifacts = parseArtifacts(dataModelResponse.content, ['data-model.md']);
    
    if (fallbackArtifacts['data-model.md'] && fallbackArtifacts['data-model.md'].trim().length > 500) {
      artifacts['data-model.md'] = fallbackArtifacts['data-model.md'];
      logger.info('[SPEC] data-model.md fallback generation successful', { length: artifacts['data-model.md'].length });
    } else {
      // If still too short, use the response content directly if it looks like a data model
      const rawContent = dataModelResponse.content;
      if (rawContent.includes('erDiagram') || rawContent.includes('Table') || rawContent.includes('Column')) {
        artifacts['data-model.md'] = rawContent;
        logger.info('[SPEC] data-model.md using raw response', { length: rawContent.length });
      } else {
        logger.error('[SPEC] data-model.md fallback generation failed to produce sufficient content');
      }
    }
  }

  logger.info(`[${phase}] Architect Agent completed`, {
    artifacts: Object.keys(artifacts),
    dataModelLength: artifacts['data-model.md']?.length || 0,
    apiSpecLength: artifacts['api-spec.json']?.length || 0
  });
  return artifacts;
}

/**
 * Execute Scrum Master Agent (SOLUTIONING phase)
 * Generates: epics.md, tasks.md, plan.md
 * Split into 3 separate calls to avoid token limit truncation
 */
async function executeScrumMasterAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  prd: string,
  dataModel: string,
  apiSpec: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info('[SOLUTIONING] Executing Scrum Master Agent (split into 3 calls)');

  const artifacts: Record<string, string> = {};
  const currentDate = new Date().toISOString().split('T')[0];
  const name = projectName || 'Untitled Project';

  // Truncate context to fit within 64K context window while providing good context
  const prdContext = prd.slice(0, 20000);
  const dataModelContext = dataModel.slice(0, 6000);
  const apiSpecContext = apiSpec.slice(0, 6000);

  // Extract requirement IDs from FULL PRD (not truncated) to ensure all are mapped
  const requirementIds = prd.match(/REQ-[A-Z]+-\d+/g) || [];
  const uniqueReqs = Array.from(new Set(requirementIds));
  
  logger.info('[SOLUTIONING] Extracted requirements from PRD', { 
    totalRequirements: uniqueReqs.length,
    requirements: uniqueReqs.join(', ')
  });
  
  // === CALL 1: Generate epics.md ===
  logger.info('[SOLUTIONING] Generating epics.md...');
  const epicsPrompt = `You are an expert Scrum Master. Generate epics.md for "${name}".

## Context
PRD Summary:
${prdContext}

Data Model Summary:
${dataModelContext}

## PRD Requirements to Cover (${uniqueReqs.length} total)
The following requirements MUST be mapped to epics:
${uniqueReqs.join(', ') || 'Extract REQ-XXX-YYY from PRD above'}

## Instructions
Create 4-8 epics covering the full MVP scope. CRITICAL REQUIREMENTS:

1. **Each epic MUST list the PRD requirements it addresses** using the REQ-XXX-YYY format
2. Every requirement from the PRD must be covered by at least one epic
3. Include clear acceptance criteria in Gherkin format (Given/When/Then)

## Output Format
Output ONLY a single fenced code block:
\`\`\`
filename: epics.md
---
title: Product Epics
owner: scrummaster
version: 1.0
date: ${currentDate}
status: draft
---

# Product Epics

## Epic 1: User Authentication
**Description:** Implement secure user authentication system
**Requirements Covered:** REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003
**Business Value:** Enables secure access and protects user data
**Acceptance Criteria:**
- Given a new user, When they register with valid email/password, Then account is created
- Given a registered user, When they login with correct credentials, Then they receive auth token
- Given an authenticated user, When their token expires, Then they are prompted to re-login
**Dependencies:** None

## Epic 2: [Title]
**Description:** ...
**Requirements Covered:** REQ-XXX-001, REQ-XXX-002
**Business Value:** ...
**Acceptance Criteria:**
- Given ... When ... Then ...
**Dependencies:** Epic 1

(continue for all epics - MUST cover ALL requirements)
\`\`\`

Generate now:`;

  const epicsResponse = await llmClient.generateCompletion(epicsPrompt, undefined, 3, 'SOLUTIONING');
  const epicsArtifacts = parseArtifacts(epicsResponse.content, ['epics.md']);
  artifacts['epics.md'] = epicsArtifacts['epics.md'] || epicsResponse.content;

  // === CALL 2: Generate tasks.md ===
  logger.info('[SOLUTIONING] Generating tasks.md...');
  const epicsContext = artifacts['epics.md']?.slice(0, 6000) || '';
  
  const tasksPrompt = `You are an expert Scrum Master. Generate tasks.md for "${name}".

## Context
Epics (with Requirements):
${epicsContext}

PRD Summary:
${prdContext.slice(0, 15000)}

## PRD Requirements to Implement (${uniqueReqs.length} total - MANDATORY - ALL MUST BE MAPPED)
The following requirements MUST each have at least one implementing task:
${uniqueReqs.join(', ') || 'Extract ALL REQ-XXX-YYY from PRD above'}

IMPORTANT: If you see requirements in the PRD that are not in this list, you MUST still create tasks for them.

## Instructions
Break down epics into concrete development tasks. CRITICAL REQUIREMENTS:

1. **Each task MUST reference the specific PRD requirement(s) it implements** (REQ-XXX-YYY)
2. **EVERY requirement from the PRD must have at least one implementing task - NO EXCEPTIONS**
3. Include test specifications BEFORE implementation details (Test-First)
4. Use Gherkin format (Given/When/Then) for acceptance criteria
5. **Before finishing, verify EVERY REQ-XXX-YYY has at least one task**

## Output Format
Output ONLY a single fenced code block:
\`\`\`
filename: tasks.md
---
title: Development Tasks
owner: scrummaster
version: 1.0
date: ${currentDate}
status: draft
---

# Development Tasks

## Sprint 1 Tasks

### TASK-001: Implement User Registration API
- **Epic:** Epic 1 - User Authentication
- **Implements:** REQ-AUTH-001, REQ-AUTH-002
- **Points:** 5
- **Priority:** P0
- **Description:** Create registration endpoint with email/password validation
- **Test Specification:**
  - Given valid email and password, When POST /auth/register, Then return 201 with user object
  - Given existing email, When POST /auth/register, Then return 409 Conflict
  - Given invalid email format, When POST /auth/register, Then return 400 Bad Request
- **Technical Notes:** Use bcrypt for password hashing, validate email format

### TASK-002: [Title]
- **Epic:** Epic X
- **Implements:** REQ-XXX-001
- **Points:** N
- **Priority:** P0/P1/P2
- **Description:** ...
- **Test Specification:**
  - Given ... When ... Then ...
- **Technical Notes:** ...

(continue for ALL tasks - every requirement MUST have implementing tasks)
\`\`\`

## VALIDATION CHECKLIST (Complete before generating)
Before outputting, verify:
- [ ] Every REQ-AUTH-XXX has at least one task
- [ ] Every REQ-USER-XXX has at least one task  
- [ ] Every REQ-CRUD-XXX has at least one task
- [ ] Every REQ-MEDIA-XXX has at least one task
- [ ] Every REQ-PAYMENT-XXX has at least one task
- [ ] Every REQ-ADMIN-XXX has at least one task
- [ ] Every REQ-SEARCH-XXX has at least one task
- [ ] Every REQ-NOTIF-XXX has at least one task
- [ ] Every REQ-INTEG-XXX has at least one task
- [ ] All tasks have Gherkin test specifications

If ANY requirement is missing a task, ADD ONE before generating output.

Generate now:`;

  const tasksResponse = await llmClient.generateCompletion(tasksPrompt, undefined, 3, 'SOLUTIONING');
  const tasksArtifacts = parseArtifacts(tasksResponse.content, ['tasks.md']);
  artifacts['tasks.md'] = tasksArtifacts['tasks.md'] || tasksResponse.content;

  // === CALL 3: Generate plan.md ===
  logger.info('[SOLUTIONING] Generating plan.md...');
  const tasksContext = artifacts['tasks.md']?.slice(0, 4000) || '';

  const planPrompt = `You are an expert Scrum Master. Generate plan.md for "${name}".

## Context
Epics Summary:
${epicsContext.slice(0, 3000)}

Tasks Summary:
${tasksContext}

## Instructions
Create a comprehensive execution plan. CRITICAL REQUIREMENTS:

1. **Reference specific requirements** (REQ-XXX-YYY) when defining MVP scope
2. **Include test milestones** - tests must be written before implementation
3. **Use Gherkin acceptance criteria** for key deliverables
4. **Define clear success metrics** tied to requirements

## Output Format
Output ONLY a single fenced code block:
\`\`\`
filename: plan.md
---
title: Execution Plan
owner: scrummaster
version: 1.0
date: ${currentDate}
status: draft
---

# Execution Plan

## 1. Timeline Overview
| Sprint | Duration | Focus | Key Deliverables |
|--------|----------|-------|------------------|
| Sprint 1 | 2 weeks | Auth & Core | REQ-AUTH-001 to REQ-AUTH-004 |
| Sprint 2 | 2 weeks | Features | REQ-CRUD-001 to REQ-CRUD-005 |
| ... | ... | ... | ... |

## 2. MVP Scope (Requirements Included)
The MVP will implement the following requirements:
- **Authentication:** REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003, REQ-AUTH-004
- **Core CRUD:** REQ-CRUD-001, REQ-CRUD-002, REQ-CRUD-003
- **User Management:** REQ-USER-001, REQ-USER-002
(list all MVP requirements)

## 3. Phase 2 Scope (Post-MVP)
Requirements deferred to Phase 2:
- REQ-XXX-YYY: [reason for deferral]
(list deferred requirements)

## 4. Test-First Milestones
| Milestone | Tests Due | Implementation Due | Requirements |
|-----------|-----------|-------------------|--------------|
| Auth Tests | Week 1 | Week 2 | REQ-AUTH-* |
| ... | ... | ... | ... |

## 5. Resource Allocation
...

## 6. Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ... | ... | ... | ... |

## 7. Success Metrics
| Metric | Target | Measures Requirements |
|--------|--------|----------------------|
| User Registration Rate | >80% completion | REQ-AUTH-001 |
| ... | ... | ... |

## 8. Go-Live Checklist
- [ ] All REQ-AUTH-* requirements tested and passing
- [ ] All REQ-CRUD-* requirements tested and passing
- [ ] Security audit complete
- [ ] Performance benchmarks met
\`\`\`

Generate now:`;

  const planResponse = await llmClient.generateCompletion(planPrompt, undefined, 3, 'SOLUTIONING');
  const planArtifacts = parseArtifacts(planResponse.content, ['plan.md']);
  artifacts['plan.md'] = planArtifacts['plan.md'] || planResponse.content;

  logger.info('[SOLUTIONING] Scrum Master Agent completed', { 
    artifacts: Object.keys(artifacts),
    epicsLength: artifacts['epics.md']?.length || 0,
    tasksLength: artifacts['tasks.md']?.length || 0,
    planLength: artifacts['plan.md']?.length || 0
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
  stackChoice: string = 'web_application',
  projectName?: string
): Promise<Record<string, string>> {
  logger.info('[DEPENDENCIES] Executing DevOps Agent');

  const agentConfig = configLoader.getSection('agents').devops;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    prd: prd,
    stackChoice: stackChoice,
    projectName: projectName || 'Untitled Project'
  });

  const response = await llmClient.generateCompletion(prompt, undefined, 3, 'DEPENDENCIES');
  const artifacts = parseArtifacts(response.content, [
    'DEPENDENCIES.md',
    'dependencies.json'
  ]);

  logger.info('[DEPENDENCIES] DevOps Agent completed', { artifacts: Object.keys(artifacts) });
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
  phase: 'SPEC' | 'SOLUTIONING' = 'SOLUTIONING',
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const prd = artifacts['SPEC/PRD.md'] || '';
  return executeArchitectAgent(llmClient, configLoader, phase, brief, prd, stackChoice, projectName);
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
  return executeScrumMasterAgent(llmClient, configLoader, prd, dataModel, apiSpec, projectName);
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
  return executeDevOpsAgent(llmClient, configLoader, prd, stackChoice || 'web_application', projectName);
}

// ============================================================================
// DESIGN SYSTEM EXECUTOR
// ============================================================================

/**
 * Execute Design System Agent
 * Generates design-system.md, component-inventory.md, and user-flows.md
 * Following fire-your-design-team.md principles
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
    projectName
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

### ANTI-PATTERNS TO AVOID (AI Slop):
- NO purple/violet as primary color unless brand-specific
- NO gradient blob backgrounds
- NO Inter font as default (choose project-appropriate font)
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
filename: design-system.md
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

Generate component-inventory.md listing ALL UI components needed for this project.

For each component, specify:
1. Component name
2. shadcn/ui base component (if applicable)
3. Props/variants needed
4. Animation requirements (Framer Motion)

Output format:
\`\`\`markdown
filename: component-inventory.md
---
title: "Component Inventory"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# Component Inventory

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

Generate user-flows.md documenting the key user journeys.

For each flow:
1. Flow name and description
2. User persona
3. Steps (numbered)
4. Key screens/states
5. Success criteria
6. Error states

Output format:
\`\`\`markdown
filename: user-flows.md
---
title: "User Flows"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "draft"
---

# User Flows

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
  const [designSystemResponse, componentResponse, userFlowsResponse] = await Promise.all([
    llmClient.generateCompletion(designSystemPrompt, undefined, 2, 'SPEC'),
    llmClient.generateCompletion(componentInventoryPrompt, undefined, 2, 'SPEC'),
    llmClient.generateCompletion(userFlowsPrompt, undefined, 2, 'SPEC')
  ]);

  const artifacts: Record<string, string> = {};

  // Parse design-system.md
  const designSystemArtifacts = parseArtifacts(designSystemResponse.content, ['design-system.md']);
  if (designSystemArtifacts['design-system.md']) {
    artifacts['design-system.md'] = designSystemArtifacts['design-system.md'];
  }

  // Parse component-inventory.md
  const componentArtifacts = parseArtifacts(componentResponse.content, ['component-inventory.md']);
  if (componentArtifacts['component-inventory.md']) {
    artifacts['component-inventory.md'] = componentArtifacts['component-inventory.md'];
  }

  // Parse user-flows.md
  const userFlowsArtifacts = parseArtifacts(userFlowsResponse.content, ['user-flows.md']);
  if (userFlowsArtifacts['user-flows.md']) {
    artifacts['user-flows.md'] = userFlowsArtifacts['user-flows.md'];
  }

  logger.info('[SPEC] Design Agent completed', {
    artifacts: Object.keys(artifacts),
    designSystemLength: artifacts['design-system.md']?.length || 0,
    componentInventoryLength: artifacts['component-inventory.md']?.length || 0,
    userFlowsLength: artifacts['user-flows.md']?.length || 0
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
