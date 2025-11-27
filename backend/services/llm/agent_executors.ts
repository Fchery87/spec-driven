import { GeminiClient } from './llm_client';
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
  llmClient: GeminiClient,
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
  llmClient: GeminiClient,
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
  llmClient: GeminiClient,
  configLoader: ConfigLoader,
  phase: 'SPEC' | 'SOLUTIONING',
  projectBrief: string,
  prd: string = '',
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info(`[${phase}] Executing Architect Agent`);

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
      stackChoice: stackChoice || 'nextjs_only_expo',
      projectName: projectName || 'Untitled Project'
    };
  } else {
    expectedFiles = ['architecture.md'];
    variables = {
      brief: projectBrief,
      prd: prd,
      phase: 'solutioning',
      stackChoice: stackChoice || 'nextjs_only_expo',
      projectName: projectName || 'Untitled Project'
    };
  }

  const prompt = buildPrompt(agentConfig.prompt_template, variables);
  const response = await llmClient.generateCompletion(prompt, undefined, 3, phase);
  const artifacts = parseArtifacts(response.content, expectedFiles);

  logger.info(`[${phase}] Architect Agent completed`, { artifacts: Object.keys(artifacts) });
  return artifacts;
}

/**
 * Execute Scrum Master Agent (SOLUTIONING phase)
 * Generates: epics.md, tasks.md, plan.md
 */
async function executeScrumMasterAgent(
  llmClient: GeminiClient,
  configLoader: ConfigLoader,
  prd: string,
  dataModel: string,
  apiSpec: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info('[SOLUTIONING] Executing Scrum Master Agent');

  const agentConfig = configLoader.getSection('agents').scrummaster;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    prd: prd,
    dataModel: dataModel,
    apiSpec: apiSpec,
    projectName: projectName || 'Untitled Project'
  });

  const response = await llmClient.generateCompletion(prompt, undefined, 3, 'SOLUTIONING');
  const artifacts = parseArtifacts(response.content, ['epics.md', 'tasks.md', 'plan.md']);

  // If plan.md is missing/empty (often due to model truncation), regenerate plan only
  if (!artifacts['plan.md'] || artifacts['plan.md'].trim().length === 0) {
    logger.warn('[SOLUTIONING] plan.md missing, triggering fallback generation');
    const fallbackPrompt = [
      'You previously produced epics.md and tasks.md. Now produce ONLY plan.md.',
      'Keep it concise enough to avoid truncation but cover: timeline, sprints, MVP scope, phase 2 scope, risks, resources, success metrics, go-live, support/maintenance.',
      'Output a single fenced block exactly like:',
      '```',
      'filename: plan.md',
      '---',
      'title: Execution Plan',
      'owner: scrummaster',
      'version: 1.0',
      'date: <current-date>',
      'status: draft',
      '---',
      '',
      '<content here>',
      '```',
      '',
      'Context documents:',
      'PRD:',
      prd,
      '',
      'Data model:',
      dataModel,
      '',
      'API spec:',
      apiSpec
    ].join('\n');

    const planResponse = await llmClient.generateCompletion(fallbackPrompt);
    const planArtifacts = parseArtifacts(planResponse.content, ['plan.md']);
    artifacts['plan.md'] = planArtifacts['plan.md'];
  }

  logger.info('[SOLUTIONING] Scrum Master Agent completed', { artifacts: Object.keys(artifacts) });
  return artifacts;
}

/**
 * Execute DevOps Agent (DEPENDENCIES phase)
 * Generates: DEPENDENCIES.md, dependency-proposal.md
 */
async function executeDevOpsAgent(
  llmClient: GeminiClient,
  configLoader: ConfigLoader,
  prd: string,
  stackChoice: string = 'nextjs_only_expo',
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
    'dependency-proposal.md'
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
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const projectIdea = artifacts['project_idea'] || 'Project for analysis';
  return executeAnalystAgent(llmClient, configLoader, projectIdea, projectName);
}

export async function getPMExecutor(
  llmClient: GeminiClient,
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
  llmClient: GeminiClient,
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
  llmClient: GeminiClient,
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
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>,
  stackChoice?: string,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const prd = artifacts['SPEC/PRD.md'] || '';
  return executeDevOpsAgent(llmClient, configLoader, prd, stackChoice || 'nextjs_only_expo', projectName);
}
