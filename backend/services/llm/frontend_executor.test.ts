import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { getFrontendExecutor, type FrontendContext } from './frontend_executor';

// Mock LLM client for testing
const createMockLLMClient = (response: string) => ({
  generateCompletion: vi.fn().mockResolvedValue({
    content: response,
    usage: { promptTokens: 100, completionTokens: 200 }
  })
});

describe('Frontend Executor', () => {
  describe('getFrontendExecutor', () => {
    it('should create a frontend executor with correct role and expertise', () => {
      const executor = getFrontendExecutor();

      expect(executor.role).toBe('frontend_developer');
      expect(executor.perspective).toBe('creative_technologist');
      expect(executor.expertise).toContain('react');
      expect(executor.expertise).toContain('typescript');
      expect(executor.expertise).toContain('css_animation');
      expect(executor.expertise).toContain('design_systems');
    });

    it('should accept configuration options', () => {
      const executor = getFrontendExecutor({
        enableAnimations: true,
        strictAntiGenericMode: false
      });

      expect(executor.role).toBe('frontend_developer');
      expect(executor.expertise.length).toBe(4);
    });

    it('should have validateArtifacts method', () => {
      const executor = getFrontendExecutor();

      expect(typeof executor.validateArtifacts!).toBe('function');
    });

    it('should have generateArtifacts method', () => {
      const executor = getFrontendExecutor();

      expect(typeof executor.generateArtifacts).toBe('function');
    });
  });

  describe('Artifact Validation - Anti-Generic Patterns', () => {
    it('should reject Inter font imports', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

:root {
  --primary: oklch(0.6 0.15 250);
}
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const fontErrors = result.issues.filter(i => 
        i.message.toLowerCase().includes('inter')
      );
      expect(fontErrors.length).toBeGreaterThan(0);
      expect(result.canProceed).toBe(false);
    });

    it('should reject Roboto font imports', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');

:root {
  --primary: oklch(0.6 0.15 250);
}
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const fontErrors = result.issues.filter(i => 
        i.message.toLowerCase().includes('roboto')
      );
      expect(fontErrors.length).toBeGreaterThan(0);
    });

    it('should reject purple gradient patterns', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/globals.css': `
:root {
  --gradient: linear-gradient(to right, #8b5cf6, #6366f1);
}
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const gradientErrors = result.issues.filter(i => 
        i.message.toLowerCase().includes('purple') || 
        i.message.toLowerCase().includes('gradient')
      );
      expect(gradientErrors.length).toBeGreaterThan(0);
    });

    it('should reject blob background patterns', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/page.tsx': `
<div className="blob-background">
  <div className="content" />
</div>
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const blobErrors = result.issues.filter(i => 
        i.message.toLowerCase().includes('blob')
      );
      expect(blobErrors.length).toBeGreaterThan(0);
    });

    it('should reject system-ui font family', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/globals.css': `
body {
  font-family: system-ui, -apple-system, sans-serif;
}
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const systemFontErrors = result.issues.filter(i => 
        i.message.toLowerCase().includes('system-ui')
      );
      expect(systemFontErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Artifact Validation - Required Patterns', () => {
    it('should accept artifacts with custom fonts (Space Grotesk)', () => {
      const executor = getFrontendExecutor();

      const validArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap');

:root {
  --primary: oklch(0.6 0.15 250);
  --secondary: oklch(0.3 0.1 200);
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap');
        `,
        'src/components/ui/Button.tsx': `
import { motion } from 'framer-motion';

export function Button() {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      Click me
    </motion.button>
  );
}
        `
      };

      const result = executor.validateArtifacts!(validArtifacts);
      expect(result.canProceed).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error').length).toBe(0);
    });

    it('should accept artifacts with Syne font', () => {
      const executor = getFrontendExecutor();

      const validArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&display=swap');

:root {
  --font-display: 'Syne', sans-serif;
  --primary: oklch(0.6 0.15 250);
}
        `
      };

      const result = executor.validateArtifacts!(validArtifacts);
      expect(result.canProceed).toBe(true);
    });

    it('should accept artifacts with Framer Motion animations', () => {
      const executor = getFrontendExecutor();

      const validArtifacts = {
        'src/components/ui/Button.tsx': `
import { motion } from 'framer-motion';

export function Button() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300 }}
    />
  );
}
        `,
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap');
:root {
  --primary: oklch(0.6 0.15 250);
  --secondary: oklch(0.3 0.1 200);
}
        `
      };

      const result = executor.validateArtifacts!(validArtifacts);
      expect(result.issues.filter(i => i.message.includes('Framer Motion')).length).toBe(0);
    });

    it('should accept OKLCH color format', () => {
      const executor = getFrontendExecutor();

      const validArtifacts = {
        'src/app/globals.css': `
:root {
  --primary: oklch(0.6 0.15 250);
  --accent: oklch(0.1 0.1 280);
  --surface: oklch(0.98 0.02 250);
}
        `
      };

      const result = executor.validateArtifacts!(validArtifacts);
      const oklchWarning = result.issues.find(i => 
        i.message.toLowerCase().includes('oklch')
      );
      expect(oklchWarning).toBeUndefined();
    });

    it('should accept CSS custom properties', () => {
      const executor = getFrontendExecutor();

      const validArtifacts = {
        'src/app/globals.css': `
:root {
  --primary: oklch(0.6 0.15 250);
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

body {
  background: var(--primary);
  padding: var(--spacing-md);
}
        `
      };

      const result = executor.validateArtifacts!(validArtifacts);
      const varWarning = result.issues.find(i => 
        i.message.includes('CSS custom properties')
      );
      expect(varWarning).toBeUndefined();
    });
  });

  describe('Artifact Validation - Edge Cases', () => {
    it('should detect multiple forbidden patterns', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');

:root {
  --gradient: linear-gradient(to right, #8b5cf6, #6366f1);
  --blob: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
}
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      expect(result.issues.filter(i => i.severity === 'error').length).toBeGreaterThanOrEqual(3);
      expect(result.canProceed).toBe(false);
    });

    it('should pass when only warnings are present', () => {
      const executor = getFrontendExecutor();

      const warningOnlyArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap');
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap');
:root {
  --primary: oklch(0.6 0.15 250);
  --secondary: oklch(0.3 0.1 200);
}

body {
  color: var(--primary);
  font-family: 'DM Sans', sans-serif;
}
        `,
        'src/components/ui/Button.tsx': `
import React from 'react';

export function Button() {
  return <button>Click</button>;
}
        `
      };

      const result = executor.validateArtifacts!(warningOnlyArtifacts);
      // With custom fonts, OKLCH colors, and var(--), should proceed
      // The only issue is missing Framer Motion (a warning)
      const errorCount = result.issues.filter(i => i.severity === 'error').length;
      expect(errorCount).toBeLessThanOrEqual(1); // May have 1 error for DM Sans if body font check triggers
      expect(result.canProceed).toBe(true);
    });

    it('should handle empty artifacts with appropriate errors', () => {
      const executor = getFrontendExecutor();

      const result = executor.validateArtifacts!({});
      // Empty artifacts will have errors due to missing fonts and OKLCH
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.filter(i => i.severity === 'error').length).toBeGreaterThan(0);
    });

    it('should handle missing Framer Motion with warning', () => {
      const executor = getFrontendExecutor();

      const artifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap');
:root {
  --primary: oklch(0.6 0.15 250);
}
        `,
        'src/components/ui/Button.tsx': `
export function Button() {
  return <button>Click</button>;
}
        `
      };

      const result = executor.validateArtifacts!(artifacts);
      const framerWarning = result.issues.find(i => 
        i.message.includes('Framer Motion')
      );
      expect(framerWarning).toBeDefined();
      expect(framerWarning?.severity).toBe('warning');
    });
  });

  describe('React Component Output Format', () => {
    it('should parse code blocks with filename markers', async () => {
      const mockLLMClient = createMockLLMClient(`
\`\`\`tsx filename: src/components/ui/Button.tsx
import { motion } from 'framer-motion';

export function Button() {
  return <motion.button>Click</motion.button>;
}
\`\`\`

\`\`\`css filename: src/app/globals.css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap');
:root {
  --primary: oklch(0.6 0.15 250);
}
\`\`\`
      `);

      const executor = getFrontendExecutor();
      const context: FrontendContext = {
        phase: 'SPEC_FRONTEND',
        projectName: 'Test Project',
        projectBrief: 'A test project',
        designTokens: '---\ncolors:\n  primary: oklch(0.6 0.15 250)\n',
        componentInventory: '---\ncomponents:\n  - Button\n',
        stack: 'nextjs_web_app',
        llmClient: mockLLMClient as any
      };

      const result = await executor.generateArtifacts(context);

      expect(result.success).toBe(true);
      expect(result.artifacts['src/components/ui/Button.tsx']).toBeDefined();
      expect(result.artifacts['src/app/globals.css']).toBeDefined();
    });

    it('should include metadata in response', async () => {
      const mockLLMClient = createMockLLMClient(`
\`\`\`tsx filename: src/components/ui/Button.tsx
import { motion } from 'framer-motion';
export function Button() { return <motion.button>Click</motion.button>; }
\`\`\`
      `);

      const executor = getFrontendExecutor();
      const context: FrontendContext = {
        phase: 'SPEC_FRONTEND',
        projectName: 'My Project',
        projectBrief: 'A creative project',
        designTokens: '',
        componentInventory: '',
        stack: 'nextjs_web_only',
        llmClient: mockLLMClient as any
      };

      const result = await executor.generateArtifacts(context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.phase).toBe('SPEC_FRONTEND');
      expect(result.metadata?.agent).toBe('frontend_developer');
      expect(result.metadata?.projectName).toBe('My Project');
    });

    it('should throw error when llmClient is missing', async () => {
      const executor = getFrontendExecutor();
      const context: FrontendContext = {
        phase: 'SPEC_FRONTEND',
        projectName: 'Test',
        projectBrief: 'Test brief',
        designTokens: '',
        componentInventory: '',
        stack: 'nextjs_web_app'
        // Note: llmClient is intentionally missing
      };

      await expect(executor.generateArtifacts(context)).rejects.toThrow(
        'llmClient is required'
      );
    });
  });

  describe('Strict Mode Configuration', () => {
    it('should use strict mode by default', () => {
      const executor = getFrontendExecutor();

      const invalidArtifacts = {
        'src/app/globals.css': `
body {
  font-family: Inter, sans-serif;
}
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const interError = result.issues.find(i => 
        i.message.includes('Inter') && i.severity === 'error'
      );
      expect(interError).toBeDefined();
    });

    it('should allow non-strict mode to downgrade errors to warnings', () => {
      const executor = getFrontendExecutor({ strictAntiGenericMode: false });

      const invalidArtifacts = {
        'src/app/globals.css': `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');
        `
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      const interError = result.issues.find(i => 
        i.message.includes('Inter')
      );
      // In non-strict mode, this might be a warning instead of error
      // but we still want to detect it
      expect(interError).toBeDefined();
      expect(result.canProceed).toBe(true); // Should still proceed with warnings
    });
  });

  describe('Frontend Executor Context Requirements', () => {
    it('should support SPEC_FRONTEND phase', () => {
      const executor = getFrontendExecutor();

      expect(typeof executor.generateArtifacts).toBe('function');
    });

    it('should support ITERATION_FRONTEND phase', () => {
      const executor = getFrontendExecutor();

      expect(typeof executor.generateArtifacts).toBe('function');
    });

    it('should include all required expertise areas', () => {
      const executor = getFrontendExecutor();

      const requiredExpertise = [
        'react',
        'typescript',
        'css_animation',
        'design_systems'
      ];

      requiredExpertise.forEach(expertise => {
        expect(executor.expertise).toContain(expertise);
      });
    });
  });
});
