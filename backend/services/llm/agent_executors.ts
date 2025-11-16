import { GeminiClient } from './llm_client';
import { AgentContext, AgentOutput, LLMConfig } from '@/types/llm';
import { ConfigLoader } from '../orchestrator/config_loader';
import { logger } from '@/lib/logger';

export class AgentExecutor {
  private llmClient: GeminiClient;
  private configLoader: ConfigLoader;

  constructor() {
    const config = new ConfigLoader();
    const llmConfigData = config.getSection('llm_config') as any;

    const llmConfig: LLMConfig = {
      provider: llmConfigData.provider || 'gemini',
      model: llmConfigData.model || 'gemini-2.5-flash',
      max_tokens: llmConfigData.max_tokens || 8192,
      temperature: llmConfigData.temperature || 0.7,
      timeout_seconds: llmConfigData.timeout_seconds || 120,
      api_key: process.env.GEMINI_API_KEY
    };

    this.llmClient = new GeminiClient(llmConfig);
    this.configLoader = config;
  }

  /**
   * Run Analyst Agent
   */
  async runAnalystAgent(projectIdea: string, context: AgentContext): Promise<AgentOutput> {
    const agentSpec = this.configLoader.getSection('agents').analyst;
    const prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
      projectIdea,
      phase: context.phase
    });

    const response = await this.llmClient.generateCompletion(prompt);
    
    return this.parseAgentOutput(response.content, [
      'constitution.md',
      'project-brief.md',
      'personas.md'
    ]);
  }

  /**
   * Run Product Manager Agent
   */
  async runPMAgent(brief: string, personas: string, context: AgentContext): Promise<AgentOutput> {
    const agentSpec = this.configLoader.getSection('agents').pm;
    const prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
      brief,
      personas,
      phase: context.phase
    });

    const response = await this.llmClient.generateWithContext(prompt, {
      'project-brief.md': brief,
      'personas.md': personas
    });
    
    return this.parseAgentOutput(response.content, ['PRD.md']);
  }

  /**
   * Run Architect Agent
   */
  async runArchitectAgent(
    brief: string,
    context: AgentContext,
    prd?: string
  ): Promise<AgentOutput> {
    const agentSpec = this.configLoader.getSection('agents').architect;
    
    let prompt: string;
    let artifacts: Record<string, string> = { 'project-brief.md': brief };

    if (context.phase === 'STACK_SELECTION') {
      // Generate stack proposal
      prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
        brief,
        phase: 'stack_selection'
      });
    } else if (context.phase === 'SPEC') {
      // Generate data model and API spec
      prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
        brief,
        prd: prd || '',
        phase: 'spec'
      });
      if (prd) artifacts['PRD.md'] = prd;
    } else if (context.phase === 'SOLUTIONING') {
      // Generate architecture document
      prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
        brief,
        prd: prd || '',
        phase: 'solutioning'
      });
      if (prd) artifacts['PRD.md'] = prd;
    } else {
      throw new Error(`Architect agent not configured for phase: ${context.phase}`);
    }

    const response = await this.llmClient.generateWithContext(prompt, artifacts);
    
    const expectedOutputs = context.phase === 'STACK_SELECTION' 
      ? ['stack-proposal.md'] 
      : context.phase === 'SPEC'
      ? ['data-model.md', 'api-spec.json']
      : ['architecture.md'];
    
    return this.parseAgentOutput(response.content, expectedOutputs);
  }

  /**
   * Run Scrum Master Agent
   */
  async runScrumMasterAgent(
    prd: string,
    architecture: string,
    dataModel: string,
    apiSpec: string,
    context: AgentContext
  ): Promise<AgentOutput> {
    const agentSpec = this.configLoader.getSection('agents').scrummaster;
    const prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
      phase: context.phase
    });

    const response = await this.llmClient.generateWithContext(prompt, {
      'PRD.md': prd,
      'architecture.md': architecture,
      'data-model.md': dataModel,
      'api-spec.json': apiSpec
    });
    
    return this.parseAgentOutput(response.content, [
      'epics.md',
      'tasks.md'
    ]);
  }

  /**
   * Run DevOps Agent
   */
  async runDevOpsAgent(
    prd: string,
    stackChoice: string,
    context: AgentContext
  ): Promise<AgentOutput> {
    const agentSpec = this.configLoader.getSection('agents').devops;
    const prompt = this.buildAgentPrompt(agentSpec.prompt_template, {
      prd,
      stackChoice,
      phase: context.phase
    });

    const stacks = this.configLoader.getSection('stacks');
    const stackInfo = stacks[stackChoice];

    const response = await this.llmClient.generateWithContext(prompt, {
      'PRD.md': prd,
      'stack-info.json': JSON.stringify(stackInfo, null, 2)
    });
    
    return this.parseAgentOutput(response.content, [
      'DEPENDENCIES.md',
      'dependency-proposal.md'
    ]);
  }

  /**
   * Build agent-specific prompt
   */
  private buildAgentPrompt(template: string, variables: Record<string, any>): string {
    let prompt = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return prompt;
  }

  /**
   * Parse agent output into separate artifacts
   */
  private parseAgentOutput(content: string, expectedFiles: string[]): AgentOutput {
    const artifacts: Record<string, string> = {};

    // Try to extract files from markdown code blocks with explicit filename markers
    const fileRegex = /```(\w+)?\n?filename:\s*(.+?)\n([\s\S]*?)```/g;
    let match;

    while ((match = fileRegex.exec(content)) !== null) {
      const [, language, filename, fileContent] = match;
      artifacts[filename.trim()] = fileContent.trim();
    }

    // If some but not all files found, try to fill in missing ones from content headers
    if (Object.keys(artifacts).length > 0 && Object.keys(artifacts).length < expectedFiles.length) {
      for (const filename of expectedFiles) {
        if (!artifacts[filename]) {
          // Try to find this file by header
          const fileHeader = new RegExp(`#?\\s*${filename.replace('.', '\\.')}`, 'i');
          const parts = content.split(fileHeader);

          if (parts.length > 1) {
            let fileContent = parts[1];
            // Find the next file header or end of content
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

    // If no files extracted yet, try header-based parsing for all expected files
    if (Object.keys(artifacts).length === 0) {
      for (const filename of expectedFiles) {
        const fileHeader = new RegExp(`#?\\s*${filename.replace('.', '\\.')}`, 'i');
        const parts = content.split(fileHeader);

        if (parts.length > 1) {
          let fileContent = parts[1];
          // Find the next file header or end of content
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

    // Fallback: if still no artifacts found, put entire content into first expected file
    // This ensures at least one file is created
    if (Object.keys(artifacts).length === 0 && expectedFiles.length > 0) {
      logger.warn(`Failed to parse artifacts. Expected files: ${expectedFiles.join(', ')}`);
      logger.warn(`Putting entire response in first expected file: ${expectedFiles[0]}`);
      artifacts[expectedFiles[0]] = content;
    }

    // Ensure all expected files are present (fill in missing ones with empty strings for now)
    for (const filename of expectedFiles) {
      if (!artifacts[filename]) {
        logger.warn(`Missing expected artifact: ${filename}. Creating placeholder.`);
        artifacts[filename] = '';
      }
    }

    return {
      artifacts,
      metadata: {
        generated_at: new Date().toISOString(),
        expected_files: expectedFiles,
        actual_files: Object.keys(artifacts)
      }
    };
  }

  /**
   * Test agent execution
   */
  async testAgent(agentType: string): Promise<boolean> {
    try {
      switch (agentType) {
        case 'analyst':
          await this.runAnalystAgent('Test project idea', { 
            project_id: 'test', 
            phase: 'ANALYSIS', 
            artifacts: {} 
          });
          break;
        case 'pm':
          await this.runPMAgent('Test brief', 'Test personas', { 
            project_id: 'test', 
            phase: 'SPEC', 
            artifacts: {} 
          });
          break;
        default:
          return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Wrapper functions for orchestrator to call agents
 * These functions are called by OrchestratorEngine.runPhaseAgent()
 */

export async function getAnalystExecutor(
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>
): Promise<Record<string, string>> {
  const executor = new AgentExecutor();
  const projectIdea = artifacts['project_idea'] || 'Project for analysis';
  const result = await executor.runAnalystAgent(projectIdea, {
    project_id: projectId,
    phase: 'ANALYSIS',
    artifacts
  });
  return result.artifacts;
}

export async function getPMExecutor(
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>,
  stackChoice?: string
): Promise<Record<string, string>> {
  const executor = new AgentExecutor();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const personas = artifacts['ANALYSIS/personas.md'] || '';
  const result = await executor.runPMAgent(brief, personas, {
    project_id: projectId,
    phase: 'SPEC',
    artifacts
  });
  return result.artifacts;
}

export async function getArchitectExecutor(
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>
): Promise<Record<string, string>> {
  const executor = new AgentExecutor();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const prd = artifacts['SPEC/PRD.md'] || '';
  const result = await executor.runArchitectAgent(brief, {
    project_id: projectId,
    phase: 'SOLUTIONING',
    artifacts
  }, prd);
  return result.artifacts;
}

export async function getScruMasterExecutor(
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>
): Promise<Record<string, string>> {
  const executor = new AgentExecutor();
  const prd = artifacts['SPEC/PRD.md'] || '';
  const architecture = artifacts['SOLUTIONING/architecture.md'] || '';
  const dataModel = artifacts['SPEC/data-model.md'] || '';
  const apiSpec = artifacts['SPEC/api-spec.json'] || '';
  const result = await executor.runScrumMasterAgent(prd, architecture, dataModel, apiSpec, {
    project_id: projectId,
    phase: 'SOLUTIONING',
    artifacts
  });
  return result.artifacts;
}

export async function getDevOpsExecutor(
  llmClient: GeminiClient,
  projectId: string,
  artifacts: Record<string, string>,
  stackChoice?: string
): Promise<Record<string, string>> {
  const executor = new AgentExecutor();
  const prd = artifacts['SPEC/PRD.md'] || '';
  const result = await executor.runDevOpsAgent(prd, stackChoice || 'nextjs_only_expo', {
    project_id: projectId,
    phase: 'DEPENDENCIES',
    artifacts
  });
  return result.artifacts;
}