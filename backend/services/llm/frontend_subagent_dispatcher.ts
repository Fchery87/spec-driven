import { LLMProvider } from './providers/base';
import { componentSelfReview, type FrontendSelfReview } from './frontend_executor';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of generating a single component
 */
export interface SubagentResult {
  componentName: string;
  success: boolean;
  code: string;
  errors: string[];
  durationMs: number;
}

/**
 * Specification for a single component to be generated
 */
export interface ComponentSpec {
  name: string;
  type: 'atom' | 'molecule' | 'organism' | 'template' | 'page';
  props: string[];
  dependencies: string[];
  designTokens: Record<string, string>;
  parentComponent?: string;
}

/**
 * Context for component generation
 */
export interface ComponentGenerationContext {
  projectId: string;
  projectName: string;
  projectBrief: string;
  stack: string;
}

// ============================================================================
// FRONTEND SUBAGENT DISPATCHER
// ============================================================================

/**
 * FrontendSubagentDispatcher - Generates frontend components in isolated LLM sessions
 * 
 * This dispatcher solves the context pollution problem by:
 * 1. Creating a fresh LLM session for each component
 * 2. Processing components in dependency order (parents first)
 * 3. Running self-review before accepting generated code
 * 4. Supporting parallel generation for independent components
 * 
 * Benefits:
 * - No context pollution from other components
 * - Independent retry for failed components
 * - Clear error isolation
 * - Dependency-based ordering
 */
export class FrontendSubagentDispatcher {
  private llmClient: LLMProvider;
  private designTokens: Record<string, string>;
  private existingComponents: Map<string, string>;

  constructor(
    llmClient: LLMProvider,
    designTokens: Record<string, string> = {}
  ) {
    this.llmClient = llmClient;
    this.designTokens = designTokens;
    this.existingComponents = new Map();
  }

  /**
   * Dispatch a single component for generation in a fresh LLM session
   */
  async dispatchComponent(
    spec: ComponentSpec,
    context: ComponentGenerationContext
  ): Promise<SubagentResult> {
    const startTime = Date.now();

    // Create fresh LLM context for this component
    const componentPrompt = this.buildComponentPrompt(spec, context);

    try {
      // Generate in fresh session (no context from other components)
      const response = await this.llmClient.generateCompletion(
        componentPrompt,
        undefined,
        2, // retries
        `FRONTEND_${spec.name.toUpperCase().replace(/\s+/g, '_')}`
      );

      const code = this.extractComponentCode(response.content);

      // Run self-review
      const selfReview = componentSelfReview(spec.name, code, this.designTokens);
      if (!selfReview.passed) {
        return {
          componentName: spec.name,
          success: false,
          code: '',
          errors: selfReview.issues,
          durationMs: Date.now() - startTime,
        };
      }

      this.existingComponents.set(spec.name, code);

      logger.info('[FrontendSubagentDispatcher] Component generated successfully', {
        componentName: spec.name,
        durationMs: Date.now() - startTime,
      });

      return {
        componentName: spec.name,
        success: true,
        code,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[FrontendSubagentDispatcher] Component generation failed', {
        componentName: spec.name,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        componentName: spec.name,
        success: false,
        code: '',
        errors: [errorMessage],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Dispatch all components for generation
   * Processes components in dependency order (parents first)
   */
  async dispatchAll(
    components: ComponentSpec[],
    context: ComponentGenerationContext
  ): Promise<SubagentResult[]> {
    // Process in dependency order (parents first)
    const sorted = this.sortByDependencies(components);

    logger.info('[FrontendSubagentDispatcher] Starting dispatch', {
      totalComponents: sorted.length,
      projectName: context.projectName,
    });

    const results: SubagentResult[] = [];

    for (const spec of sorted) {
      const result = await this.dispatchComponent(spec, context);
      results.push(result);

      // If parent failed, skip children
      if (!result.success && spec.parentComponent) {
        const parentResult = results.find(r => r.componentName === spec.parentComponent);
        if (parentResult && !parentResult.success) {
          results.push({
            componentName: `${spec.name} (skipped - parent failed)`,
            success: false,
            code: '',
            errors: ['Parent component failed to generate'],
            durationMs: 0,
          });
        }
      }
    }

    logger.info('[FrontendSubagentDispatcher] Dispatch complete', {
      totalResults: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Dispatch all components in parallel (for independent components)
   * Warning: Only use for components without dependencies
   */
  async dispatchAllParallel(
    components: ComponentSpec[],
    context: ComponentGenerationContext,
    maxConcurrency: number = 5
  ): Promise<SubagentResult[]> {
    // For parallel execution, we need fresh dispatchers per component
    // to ensure complete isolation
    const sorted = this.sortByDependencies(components);
    const results: SubagentResult[] = [];

    logger.info('[FrontendSubagentDispatcher] Starting parallel dispatch', {
      totalComponents: sorted.length,
      maxConcurrency,
      projectName: context.projectName,
    });

    // Process in batches to respect maxConcurrency
    for (let i = 0; i < sorted.length; i += maxConcurrency) {
      const batch = sorted.slice(i, i + maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(async (spec) => {
          // Create a fresh dispatcher for each component to ensure isolation
          const freshDispatcher = new FrontendSubagentDispatcher(this.llmClient, this.designTokens);
          return freshDispatcher.dispatchComponent(spec, context);
        })
      );

      results.push(...batchResults);
    }

    logger.info('[FrontendSubagentDispatcher] Parallel dispatch complete', {
      totalResults: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Build the prompt for generating a single component
   */
  private buildComponentPrompt(
    spec: ComponentSpec,
    context: ComponentGenerationContext
  ): string {
    const existingComponentsList = Array.from(this.existingComponents.entries())
      .map(([name, _code]) => `- ${name}`)
      .join('\n');

    return `
# ROLE
You are a Senior Frontend Developer specializing in React, TypeScript, and accessible UI components.

# CONTEXT
Project: ${context.projectName}
Project Brief: ${context.projectBrief}
Component: ${spec.name}
Type: ${spec.type}
Tech Stack: ${context.stack}

Design Tokens:
\`\`\`json
${JSON.stringify(this.designTokens, null, 2)}
\`\`\`

Existing Components:
${existingComponentsList || '(None yet - you are generating the first component)'}

# TASK
Generate ${spec.type} component: ${spec.name}

## Props Interface
\`\`\`typescript
interface ${spec.name}Props {
${spec.props.map((p) => `  ${p}: string;`).join('\n')}
}
\`\`\`

## Required Dependencies
${spec.dependencies.map((d) => `- ${d}`).join('\n')}

## Requirements
1. Use shadcn/ui components from @/components/ui
2. Use class-variance-authority (cva) for variants
3. Include useReducedMotion for accessibility
4. Follow design tokens exactly
5. No placeholder code (// TODO, lorem ipsum)
6. No console.log statements
7. Export as default component
8. Use Framer Motion for animations with spring physics
9. Use distinctive fonts (NOT Inter, Roboto, Arial, or system-ui)

## ANTI-GENERIC AI SLOP RULES (STRICTLY ENFORCE):

### NEVER USE (Forbidden Patterns):
- Fonts: Inter, Roboto, Arial, system-ui, sans-serif defaults
- Colors: Purple gradients, blue-purple gradients, generic "tech" gradients
- Layouts: Centered cards, hero sections with gradient backgrounds, blob decorations
- Motion: Basic fades, simple scales, default easing

### REQUIRED (Aesthetic Standards):
- Typography: One distinctive display font (Space Grotesk, Syne, Outfit, Fraunces, etc.)
- Color: CSS variables with OKLCH values from design tokens
- Motion: Framer Motion with spring(...) physics, staggered children
- Spatial: Asymmetry, overlap, diagonal flow

## OUTPUT FORMAT
Return component code in this format:
\`\`\`json
[{"filename": "${spec.name}.tsx", "content": "..."}]
\`\`\`

Do not include any markdown outside the JSON code block.
`.trim();
  }

  /**
   * Extract component code from LLM response
   */
  private extractComponentCode(content: string): string {
    // Try to parse as JSON array first (structured output)
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Find the entry with the component code
        for (const item of parsed) {
          if (item.filename && item.content) {
            return item.content;
          }
        }
      }
    } catch {
      // Not JSON, continue with regex parsing
    }

    // Fallback: parse from markdown code blocks
    const codeBlockRegex = /```(?:tsx|typescript|ts|javascript|js)?[ \t]*\n?filename:\s*([^\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const [, _filename, fileContent] = match;
      // Return the first code block that looks like a React component
      if (fileContent.includes('export') || fileContent.includes('import')) {
        return fileContent.trim();
      }
    }

    // Last resort: return the whole content
    return content.trim();
  }

  /**
   * Sort components by dependency order (parents first)
   * Uses topological sort based on parentComponent
   */
  private sortByDependencies(components: ComponentSpec[]): ComponentSpec[] {
    const byName = new Map(components.map((c) => [c.name, c]));
    const sorted: ComponentSpec[] = [];
    const visited = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;

      const component = byName.get(name);
      if (!component) return;

      // Visit parent first
      if (component.parentComponent) {
        visit(component.parentComponent);
      }

      visited.add(name);
      sorted.push(component);
    };

    for (const c of components) {
      visit(c.name);
    }

    return sorted;
  }

  /**
   * Get the map of generated components
   */
  getGeneratedComponents(): Map<string, string> {
    return new Map(this.existingComponents);
  }

  /**
   * Clear all generated components
   */
  clear(): void {
    this.existingComponents.clear();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse component specs from design phase context
 */
export function parseComponentSpecs(context: Record<string, unknown>): ComponentSpec[] {
  const componentInventory = context.componentInventory as string | undefined;
  const designTokens = context.designTokens as string | undefined;

  if (!componentInventory) {
    return [];
  }

  // Parse component inventory to extract specs
  const specs: ComponentSpec[] = [];

  // Simple parsing - in production this would be more sophisticated
  const componentLines = componentInventory.split('\n');
  let currentComponent: Partial<ComponentSpec> | null = null;

  for (const line of componentLines) {
    const nameMatch = line.match(/###?\s*([A-Z][a-zA-Z]+)/);
    if (nameMatch) {
      if (currentComponent) {
        specs.push(currentComponent as ComponentSpec);
      }
      currentComponent = {
        name: nameMatch[1],
        type: 'molecule',
        props: [],
        dependencies: [],
        designTokens: {},
      };
    }

    // Parse component details
    if (currentComponent) {
      if (line.includes('(atom)')) {
        currentComponent.type = 'atom';
      } else if (line.includes('(molecule)')) {
        currentComponent.type = 'molecule';
      } else if (line.includes('(organism)')) {
        currentComponent.type = 'organism';
      } else if (line.includes('(template)')) {
        currentComponent.type = 'template';
      } else if (line.includes('(page)')) {
        currentComponent.type = 'page';
      }
    }
  }

  // Don't forget the last component
  if (currentComponent) {
    specs.push(currentComponent as ComponentSpec);
  }

  return specs;
}

/**
 * Build artifact map from dispatch results
 */
export function buildArtifactMap(results: SubagentResult[]): Record<string, string> {
  const artifacts: Record<string, string> = {};

  for (const result of results) {
    if (result.success) {
      artifacts[`${result.componentName}.tsx`] = result.code;
    }
  }

  return artifacts;
}

/**
 * Check if all components were generated successfully
 */
export function allComponentsGenerated(results: SubagentResult[]): boolean {
  return results.every((r) => r.success);
}

/**
 * Get failed components from results
 */
export function getFailedComponents(results: SubagentResult[]): SubagentResult[] {
  return results.filter((r) => !r.success);
}
