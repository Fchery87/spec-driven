import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFrontendExecutor } from '../llm/frontend_executor';
import type { AgentExecutor } from '../llm/agent_executors';
import { validateAntiAISlop } from '../validation/anti_ai_slop_validator';

// Mock the LLM client
const mockLlmClient = {
  generateCompletion: vi.fn().mockResolvedValue({
    content: `\`\`\`tsx filename: src/components/ui/Button.tsx
import { motion } from 'framer-motion';

export function Button({ children, variant = 'primary' }: { children: React.ReactNode; variant?: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="px-4 py-2 rounded-lg font-medium transition-colors"
      style={{
        '--color-primary': 'oklch(0.7 0.15 250)',
      } as React.CSSProperties}
    >
      {children}
    </motion.button>
  );
}
\`\`\`

\`\`\`tsx filename: src/app/page.tsx
import { Button } from '@/components/ui/Button';
import '@/app/globals.css';

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Button>Click me</Button>
    </main>
  );
}
\`\`\`

\`\`\`css filename: src/app/globals.css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap');

:root {
  --color-primary: oklch(0.7 0.15 250);
  --color-accent: oklch(0.8 0.12 320);
}

body {
  font-family: 'Space Grotesk', sans-serif;
}
\`\`\``,
  }),
};

describe('FRONTEND_BUILD Phase Integration', () => {
  describe('FrontendExecutor Configuration', () => {
    it('should create executor with creative_technologist perspective', () => {
      const executor = getFrontendExecutor({ perspective: 'creative_technologist' });
      expect(executor.perspective).toBe('creative_technologist');
      expect(executor.role).toBe('frontend_developer');
    });

    it('should create executor with strict anti-generic mode by default', () => {
      const executor = getFrontendExecutor({});
      expect(executor).toBeDefined();
    });
  });

  describe('FrontendExecutor Artifact Generation', () => {
    it('should generate React component artifacts', async () => {
      const executor = getFrontendExecutor({ perspective: 'creative_technologist' });
      
      const result = await executor.generateArtifacts({
        phase: 'SPEC_FRONTEND',
        projectName: 'Test Project',
        projectBrief: 'A test project for frontend components',
        designTokens: ':root { --color-primary: oklch(0.7 0.15 250); }',
        componentInventory: '- Button\n- Card\n- Input',
        stack: 'nextjs',
        llmClient: mockLlmClient,
      });

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(Object.keys(result.artifacts).length).toBeGreaterThan(0);
      expect(result.metadata?.phase).toBe('SPEC_FRONTEND');
    });

    it('should generate React components with proper file structure', async () => {
      const executor = getFrontendExecutor({ perspective: 'creative_technologist' });
      
      const result = await executor.generateArtifacts({
        phase: 'SPEC_FRONTEND',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        designTokens: ':root { --color-primary: oklch(0.7 0.15 250); }',
        componentInventory: '- Button',
        stack: 'nextjs',
        llmClient: mockLlmClient,
      });

      expect(result.success).toBe(true);
      // Should have at least Button component
      const hasButton = Object.keys(result.artifacts).some(k => 
        k.toLowerCase().includes('button')
      );
      expect(hasButton).toBe(true);
    });
  });

  describe('Anti-AI-Slop Validation for Frontend Artifacts', () => {
    it('should reject Inter font imports', async () => {
      const executor = getFrontendExecutor({ strictAntiGenericMode: true }) as AgentExecutor;
      
      const artifacts = {
        'src/app/globals.css': `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
body { font-family: 'Inter', sans-serif; }`,
      };

      const validation = executor.validateArtifacts!(artifacts);
      expect(validation.canProceed).toBe(false);
      expect(validation.issues?.some((i: { message: string }) => i.message.includes('Inter'))).toBe(true);
    });

    it('should reject Roboto font imports', async () => {
      const artifacts = {
        'src/app/globals.css': `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
body { font-family: 'Roboto', sans-serif; }`,
      };

      const executor = getFrontendExecutor({ strictAntiGenericMode: true }) as AgentExecutor;
      const validation = executor.validateArtifacts!(artifacts);
      
      expect(validation.canProceed).toBe(false);
      expect(validation.issues?.some((i: { message: string }) => i.message.includes('Roboto'))).toBe(true);
    });

    it('should reject purple gradients', async () => {
      const artifacts = {
        'src/app/globals.css': `.hero {
  background: linear-gradient(to right, #8b5cf6, #6366f1);
}`,
      };

      const executor = getFrontendExecutor({ strictAntiGenericMode: true }) as AgentExecutor;
      const validation = executor.validateArtifacts!(artifacts);
      
      expect(validation.issues?.some((i: { message: string }) => 
        i.message.toLowerCase().includes('purple') || 
        i.message.toLowerCase().includes('gradient')
      )).toBe(true);
    });

    it('should accept distinctive fonts like Space Grotesk', async () => {
      const artifacts = {
        'src/app/globals.css': `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap');
:root {
  --color-primary: oklch(0.7 0.15 250);
  --color-accent: oklch(0.8 0.12 320);
}
body { font-family: 'Space Grotesk', sans-serif; }`,
      };

      const executor = getFrontendExecutor({ strictAntiGenericMode: true }) as AgentExecutor;
      const validation = executor.validateArtifacts!(artifacts);
      
      // Should not have errors about forbidden fonts
      expect(validation.issues?.filter((i: { severity: string }) => i.severity === 'error').length).toBe(0);
    });

    it('should accept OKLCH color format', async () => {
      const artifacts = {
        'src/app/globals.css': `:root {
  --color-primary: oklch(0.7 0.15 250);
  --color-accent: oklch(0.8 0.12 320);
}`,
      };

      const executor = getFrontendExecutor({ strictAntiGenericMode: true }) as AgentExecutor;
      const validation = executor.validateArtifacts!(artifacts);
      
      expect(validation.issues?.some((i: { message: string }) => i.message.includes('OKLCH'))).toBe(false);
    });
  });

  describe('FrontendExecutor reads design tokens and component inventory', () => {
    it('should accept design tokens in context', async () => {
      const executor = getFrontendExecutor({ perspective: 'creative_technologist' });
      
      const designTokens = `
:root {
  --color-primary: oklch(0.7 0.15 250);
  --color-secondary: oklch(0.6 0.2 200);
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}
`.trim();

      const componentInventory = `
# Component Inventory

## UI Components
1. Button - Primary action button with variants
2. Card - Content container
3. Input - Form input field
4. Badge - Status indicator
5. Dialog - Modal dialog
`.trim();

      const result = await executor.generateArtifacts({
        phase: 'SPEC_FRONTEND',
        projectName: 'Test Project',
        projectBrief: 'A test project with custom design tokens',
        designTokens,
        componentInventory,
        stack: 'nextjs',
        llmClient: mockLlmClient,
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.projectName).toBe('Test Project');
    });
  });

  describe('Integration: Full FRONTEND_BUILD flow with validation', () => {
    it('should generate valid frontend artifacts that pass anti-generic validation', async () => {
      const executor = getFrontendExecutor({ perspective: 'creative_technologist' }) as AgentExecutor;
      
      // Generate artifacts
      const result = await executor.generateArtifacts({
        phase: 'SPEC_FRONTEND',
        projectName: 'Integration Test',
        projectBrief: 'Testing full frontend build flow',
        designTokens: ':root { --color: oklch(0.7 0.15 250); }',
        componentInventory: '- Button',
        stack: 'nextjs',
        llmClient: mockLlmClient,
      });

      expect(result.success).toBe(true);

      // Validate generated artifacts
      const validation = executor.validateArtifacts!(result.artifacts);
      expect(validation.canProceed).toBe(true);
    });
  });
});
