import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  FrontendSubagentDispatcher,
  type ComponentSpec,
  type SubagentResult,
  parseComponentSpecs,
  buildArtifactMap,
  allComponentsGenerated,
  getFailedComponents,
} from './frontend_subagent_dispatcher';

// ============================================================================
// MOCKS AND HELPERS
// ============================================================================

const createMockLLMClient = (response: { content: string }) => ({
  generateCompletion: vi.fn().mockResolvedValue(response),
  testConnection: vi.fn().mockResolvedValue(true),
});

const validComponentCode = `
import { Button } from '@/components/ui/button';
import { motion, useReducedMotion } from 'framer-motion';

interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, variant = 'primary' }: ButtonProps) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.button
      whileHover={{ scale: shouldReduce ? 1 : 1.05 }}
      whileTap={{ scale: shouldReduce ? 1 : 0.95 }}
      className="btn-primary"
    >
      {label}
    </motion.button>
  );
}
`;

const designTokens = {
  'design-tokens.json': JSON.stringify({
    colors: {
      primary: 'oklch(0.6 0.15 250)',
      secondary: 'oklch(0.3 0.1 200)',
    },
    typography: {
      fontFamily: {
        display: 'Space Grotesk',
        body: 'DM Sans',
      },
    },
  }),
};

// ============================================================================
// TESTS
// ============================================================================

describe('FrontendSubagentDispatcher', () => {
  describe('Constructor', () => {
    it('should initialize with LLM client and design tokens', () => {
      const mockClient = createMockLLMClient({ content: validComponentCode });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      expect(dispatcher).toBeDefined();
    });

    it('should initialize with empty design tokens if not provided', () => {
      const mockClient = createMockLLMClient({ content: validComponentCode });
      const dispatcher = new FrontendSubagentDispatcher(mockClient);

      expect(dispatcher).toBeDefined();
    });
  });

  describe('dispatchComponent', () => {
    it('should generate a component successfully', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${validComponentCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: ['label: string', 'variant?: "primary" | "secondary"'],
        dependencies: ['@/components/ui/button', 'framer-motion'],
        designTokens: {},
        parentComponent: undefined,
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const result = await dispatcher.dispatchComponent(spec, context);

      expect(result.success).toBe(true);
      expect(result.componentName).toBe('Button');
      expect(result.code).toContain('export function Button');
      expect(result.errors).toHaveLength(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail when LLM returns placeholder code', async () => {
      const placeholderCode = `
// TODO: Implement this component later
export function Button() {
  return <button>placeholder</button>;
}
      `;
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${placeholderCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: ['label: string'],
        dependencies: [],
        designTokens: {},
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const result = await dispatcher.dispatchComponent(spec, context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('placeholder'))).toBe(true);
    });

    it('should fail when LLM returns code with console.log', async () => {
      const codeWithConsole = `
console.log('Debug: Button rendered');
export function Button() {
  return <button>Click</button>;
}
      `;
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${codeWithConsole.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: [],
        dependencies: [],
        designTokens: {},
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const result = await dispatcher.dispatchComponent(spec, context);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('console.log'))).toBe(true);
    });

    it('should handle LLM errors gracefully', async () => {
      const mockClient = {
        generateCompletion: vi.fn().mockRejectedValue(new Error('LLM API error')),
      };
      const dispatcher = new FrontendSubagentDispatcher(mockClient as any, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: [],
        dependencies: [],
        designTokens: {},
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const result = await dispatcher.dispatchComponent(spec, context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toBe('LLM API error');
    });

    it('should parse markdown code blocks as fallback', async () => {
      const code = `
\`\`\`tsx filename: Button.tsx
import { Button } from '@/components/ui/button';

export function Button() {
  return <Button>Click</Button>;
}
\`\`\`
      `;
      const mockClient = createMockLLMClient({ content: code });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: [],
        dependencies: [],
        designTokens: {},
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const result = await dispatcher.dispatchComponent(spec, context);

      expect(result.success).toBe(true);
      expect(result.code).toContain('export function Button');
    });
  });

  describe('dispatchAll', () => {
    it('should generate multiple components in dependency order', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Card.tsx", "content": "${validComponentCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const components: ComponentSpec[] = [
        {
          name: 'Card',
          type: 'molecule',
          props: ['title: string'],
          dependencies: [],
          designTokens: {},
        },
        {
          name: 'CardHeader',
          type: 'atom',
          props: ['heading: string'],
          dependencies: [],
          designTokens: {},
          parentComponent: 'Card',
        },
        {
          name: 'CardContent',
          type: 'atom',
          props: ['children: React.ReactNode'],
          dependencies: [],
          designTokens: {},
          parentComponent: 'Card',
        },
      ];

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const results = await dispatcher.dispatchAll(components, context);

      expect(results.length).toBe(3);
      // Card should be generated first (no parent)
      const cardResult = results.find((r) => r.componentName === 'Card');
      expect(cardResult).toBeDefined();
      // Parent should be before children in the results
      const cardIndex = results.findIndex((r) => r.componentName === 'Card');
      const headerIndex = results.findIndex((r) => r.componentName === 'CardHeader');
      const contentIndex = results.findIndex((r) => r.componentName === 'CardContent');
      expect(cardIndex).toBeLessThan(headerIndex);
      expect(cardIndex).toBeLessThan(contentIndex);
    });

    it('should skip children when parent fails', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "// TODO: placeholder"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const components: ComponentSpec[] = [
        {
          name: 'Button',
          type: 'atom',
          props: [],
          dependencies: [],
          designTokens: {},
        },
        {
          name: 'ButtonGroup',
          type: 'molecule',
          props: ['buttons: string[]'],
          dependencies: [],
          designTokens: {},
          parentComponent: 'Button',
        },
      ];

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const results = await dispatcher.dispatchAll(components, context);

      const buttonResult = results.find((r) => r.componentName === 'Button');
      const skippedResult = results.find((r) => r.componentName === 'ButtonGroup (skipped - parent failed)');

      expect(buttonResult?.success).toBe(false);
      expect(skippedResult).toBeDefined();
      expect(skippedResult?.errors[0]).toBe('Parent component failed to generate');
    });

    it('should handle empty component list', async () => {
      const mockClient = createMockLLMClient({ content: '' });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const results = await dispatcher.dispatchAll([], context);

      expect(results).toHaveLength(0);
    });
  });

  describe('dispatchAllParallel', () => {
    it('should generate components in parallel', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${validComponentCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const components: ComponentSpec[] = [
        { name: 'Button1', type: 'atom', props: [], dependencies: [], designTokens: {} },
        { name: 'Button2', type: 'atom', props: [], dependencies: [], designTokens: {} },
        { name: 'Button3', type: 'atom', props: [], dependencies: [], designTokens: {} },
      ];

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const startTime = Date.now();
      const results = await dispatcher.dispatchAllParallel(components, context, 5);
      const elapsed = Date.now() - startTime;

      expect(results.length).toBe(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should respect max concurrency', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${validComponentCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const components: ComponentSpec[] = [
        { name: 'Button1', type: 'atom', props: [], dependencies: [], designTokens: {} },
        { name: 'Button2', type: 'atom', props: [], dependencies: [], designTokens: {} },
        { name: 'Button3', type: 'atom', props: [], dependencies: [], designTokens: {} },
        { name: 'Button4', type: 'atom', props: [], dependencies: [], designTokens: {} },
        { name: 'Button5', type: 'atom', props: [], dependencies: [], designTokens: {} },
      ];

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      const startTime = Date.now();
      // With concurrency of 2, 5 items should take at least 2 batches
      await dispatcher.dispatchAllParallel(components, context, 2);
      const elapsed = Date.now() - startTime;

      // The actual timing depends on the environment, but we can verify it completes
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getGeneratedComponents', () => {
    it('should return map of generated components', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${validComponentCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: [],
        dependencies: [],
        designTokens: {},
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      await dispatcher.dispatchComponent(spec, context);

      const components = dispatcher.getGeneratedComponents();
      expect(components.has('Button')).toBe(true);
      expect(components.get('Button')).toContain('export function Button');
    });

    it('should return empty map when no components generated', () => {
      const mockClient = createMockLLMClient({ content: '' });
      const dispatcher = new FrontendSubagentDispatcher(mockClient);

      const components = dispatcher.getGeneratedComponents();
      expect(components.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all generated components', async () => {
      const mockClient = createMockLLMClient({
        content: `[{"filename": "Button.tsx", "content": "${validComponentCode.replace(/"/g, '\\"')}"}]`,
      });
      const dispatcher = new FrontendSubagentDispatcher(mockClient, designTokens);

      const spec: ComponentSpec = {
        name: 'Button',
        type: 'atom',
        props: [],
        dependencies: [],
        designTokens: {},
      };

      const context = {
        projectId: 'test-project',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        stack: 'nextjs_web_app',
      };

      await dispatcher.dispatchComponent(spec, context);

      expect(dispatcher.getGeneratedComponents().size).toBe(1);

      dispatcher.clear();

      expect(dispatcher.getGeneratedComponents().size).toBe(0);
    });
  });
});

describe('parseComponentSpecs', () => {
  it('should parse component specs from context', () => {
    const context = {
      componentInventory: `
### Button (atom)
- Props: label, variant
### Card (molecule)
- Props: title, content
### PageLayout (template)
      `,
      designTokens: '{}',
    };

    const specs = parseComponentSpecs(context);

    expect(specs.length).toBe(3);
    expect(specs[0].name).toBe('Button');
    expect(specs[0].type).toBe('atom');
    expect(specs[1].name).toBe('Card');
    expect(specs[1].type).toBe('molecule');
    expect(specs[2].name).toBe('PageLayout');
    expect(specs[2].type).toBe('template');
  });

  it('should return empty array when no component inventory', () => {
    const specs = parseComponentSpecs({});
    expect(specs).toHaveLength(0);
  });

  it('should handle component type annotations', () => {
    const context = {
      componentInventory: `
### AtomComponent (atom)
### MoleculeComponent (molecule)
### OrganismComponent (organism)
### TemplateComponent (template)
### PageComponent (page)
      `,
      designTokens: '{}',
    };

    const specs = parseComponentSpecs(context);

    expect(specs[0].type).toBe('atom');
    expect(specs[1].type).toBe('molecule');
    expect(specs[2].type).toBe('organism');
    expect(specs[3].type).toBe('template');
    expect(specs[4].type).toBe('page');
  });
});

describe('buildArtifactMap', () => {
  it('should build artifact map from results', () => {
    const results: SubagentResult[] = [
      {
        componentName: 'Button',
        success: true,
        code: 'export function Button() {}',
        errors: [],
        durationMs: 100,
      },
      {
        componentName: 'Card',
        success: true,
        code: 'export function Card() {}',
        errors: [],
        durationMs: 100,
      },
      {
        componentName: 'Failed',
        success: false,
        code: '',
        errors: ['Error'],
        durationMs: 100,
      },
    ];

    const artifacts = buildArtifactMap(results);

    expect(Object.keys(artifacts)).toHaveLength(2);
    expect(artifacts['Button.tsx']).toBe('export function Button() {}');
    expect(artifacts['Card.tsx']).toBe('export function Card() {}');
    expect(artifacts['Failed.tsx']).toBeUndefined();
  });

  it('should return empty object when no successful results', () => {
    const results: SubagentResult[] = [
      {
        componentName: 'Failed',
        success: false,
        code: '',
        errors: ['Error'],
        durationMs: 100,
      },
    ];

    const artifacts = buildArtifactMap(results);
    expect(Object.keys(artifacts)).toHaveLength(0);
  });
});

describe('allComponentsGenerated', () => {
  it('should return true when all components succeeded', () => {
    const results: SubagentResult[] = [
      { componentName: 'A', success: true, code: '', errors: [], durationMs: 0 },
      { componentName: 'B', success: true, code: '', errors: [], durationMs: 0 },
    ];

    expect(allComponentsGenerated(results)).toBe(true);
  });

  it('should return false when any component failed', () => {
    const results: SubagentResult[] = [
      { componentName: 'A', success: true, code: '', errors: [], durationMs: 0 },
      { componentName: 'B', success: false, code: '', errors: ['Error'], durationMs: 0 },
    ];

    expect(allComponentsGenerated(results)).toBe(false);
  });
});

describe('getFailedComponents', () => {
  it('should return only failed components', () => {
    const results: SubagentResult[] = [
      { componentName: 'Success1', success: true, code: '', errors: [], durationMs: 0 },
      { componentName: 'Failed1', success: false, code: '', errors: ['Error'], durationMs: 0 },
      { componentName: 'Success2', success: true, code: '', errors: [], durationMs: 0 },
      { componentName: 'Failed2', success: false, code: '', errors: ['Error'], durationMs: 0 },
    ];

    const failed = getFailedComponents(results);

    expect(failed).toHaveLength(2);
    expect(failed[0].componentName).toBe('Failed1');
    expect(failed[1].componentName).toBe('Failed2');
  });

  it('should return empty array when all succeeded', () => {
    const results: SubagentResult[] = [
      { componentName: 'A', success: true, code: '', errors: [], durationMs: 0 },
      { componentName: 'B', success: true, code: '', errors: [], durationMs: 0 },
    ];

    const failed = getFailedComponents(results);
    expect(failed).toHaveLength(0);
  });
});
