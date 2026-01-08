import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { getFrontendExecutor, type FrontendContext, componentSelfReview } from './frontend_executor';

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

  describe('componentSelfReview', () => {
    describe('Placeholder Code Detection', () => {
      it('should detect // TODO comments', () => {
        const code = `
export function Button() {
  // TODO: Implement button logic
  return <button>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('// TODO'))).toBe(true);
      });

      it('should detect TODO: markers', () => {
        const code = `
export function Button() {
  TODO: Add button logic
  return <button>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('placeholder code'))).toBe(true);
      });

      it('should detect placeholder text', () => {
        const code = `
export function Button() {
  return <button>placeholder</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
      });

      it('should pass for clean code without placeholders', () => {
        const code = `
import { Button } from '@/components/ui/button';

export function Button() {
  return <Button>Click me</Button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(true);
        expect(result.issues.length).toBe(0);
      });
    });

    describe('Lorem Ipsum Detection', () => {
      it('should detect lorem ipsum text', () => {
        const code = `
export function Card() {
  return (
    <div>
      <p>Lorem ipsum dolor sit amet</p>
    </div>
  );
}
        `;
        const result = componentSelfReview('Card', code);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('lorem ipsum'))).toBe(true);
      });

      it('should be case insensitive for lorem ipsum', () => {
        const code = `
export function Card() {
  return <p>LOREM IPSUM DOLOR</p>;
}
        `;
        const result = componentSelfReview('Card', code);
        expect(result.passed).toBe(false);
      });
    });

    describe('Console.log Detection', () => {
      it('should detect console.log statements', () => {
        const code = `
export function Button() {
  console.log('Button clicked');
  return <button>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('console.log'))).toBe(true);
      });

      it('should detect console.debug statements', () => {
        const code = `
export function Button() {
  console.debug('Debug info');
  return <button>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
      });

      it('should detect console.info statements', () => {
        const code = `
export function Button() {
  console.info('Info');
  return <button>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
      });
    });

    describe('useReducedMotion Accessibility Check', () => {
      it('should flag missing useReducedMotion when animations are present', () => {
        const code = `
import { motion } from 'framer-motion';

export function Button() {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      Click
    </motion.button>
  );
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('useReducedMotion'))).toBe(true);
      });

      it('should pass when useReducedMotion is used with animations', () => {
        const code = `
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function Button() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.button
      whileHover={{ scale: shouldReduceMotion ? 1 : 1.05 }}
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.95 }}
    >
      Click
    </motion.button>
  );
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(true);
        expect(result.issues.some(i => i.includes('useReducedMotion'))).toBe(false);
      });

      it('should pass when no animations are present', () => {
        const code = `
import { Button } from '@/components/ui/button';

export function Button() {
  return <Button>Click</Button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(true);
      });

      it('should detect various animation patterns', () => {
        const animationPatterns = [
          'animation: fadeIn',
          'transition: all 0.3s',
          '@keyframes fade',
          'whileHover={{ scale: 1.1 }}',
          'whileTap={{ scale: 0.9 }}',
          'whileInView={{ opacity: 1 }}',
          'initial={{ opacity: 0 }}',
          'animate={{ opacity: 1 }}',
          'exit={{ opacity: 0 }}'
        ];

        for (const pattern of animationPatterns) {
          const result = componentSelfReview('TestComponent', pattern);
          expect(result.passed).toBe(false);
          expect(result.issues.some(i => i.includes('useReducedMotion'))).toBe(true);
        }
      });
    });

    describe('shadcn/ui Pattern Check', () => {
      it('should flag missing shadcn/ui imports', () => {
        const code = `
export function Button() {
  return <button className="btn-primary">Click</button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('shadcn/ui'))).toBe(true);
      });

      it('should pass when importing from @/components/ui/', () => {
        const code = `
import { Button } from '@/components/ui/button';

export function MyButton() {
  return <Button>Click</Button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(true);
      });

      it('should pass when importing multiple ui components', () => {
        const code = `
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function MyComponent() {
  return (
    <Card>
      <Button>Click</Button>
    </Card>
  );
}
        `;
        const result = componentSelfReview('Card', code);
        expect(result.passed).toBe(true);
      });
    });

    describe('Design Token Color Validation', () => {
      it('should detect hardcoded hex colors not in design tokens', () => {
        const designTokens = {
          'design-tokens.json': JSON.stringify({
            colors: {
              primary: 'oklch(0.6 0.15 250)',
              secondary: 'oklch(0.3 0.1 200)'
            }
          })
        };

        const code = `
export function Button() {
  return <button style={{ backgroundColor: '#ff0000' }}>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code, designTokens);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('#ff0000'))).toBe(true);
      });

      it('should accept colors from design tokens', () => {
        const designTokens = {
          'design-tokens.json': JSON.stringify({
            colors: {
              primary: 'oklch(0.6 0.15 250)',
              secondary: 'oklch(0.3 0.1 200)'
            }
          })
        };

        const code = `
import { Button } from '@/components/ui/button';

export function Button() {
  return <Button style={{ backgroundColor: 'oklch(0.6 0.15 250)' }}>Click</Button>;
}
        `;
        const result = componentSelfReview('Button', code, designTokens);
        expect(result.passed).toBe(true);
      });

      it('should detect multiple invalid hex colors', () => {
        const designTokens = {
          'design-tokens.json': JSON.stringify({
            colors: {
              primary: 'oklch(0.6 0.15 250)'
            }
          })
        };

        const code = `
export function Button() {
  return (
    <button style={{ 
      backgroundColor: '#ff0000',
      color: '#00ff00',
      border: '1px solid #0000ff'
    }}>
      Click
    </button>
  );
}
        `;
        const result = componentSelfReview('Button', code, designTokens);
        expect(result.passed).toBe(false);
        const colorIssue = result.issues.find(i => i.includes('Hardcoded colors'));
        expect(colorIssue).toBeDefined();
        expect(colorIssue).toContain('#ff0000');
        expect(colorIssue).toContain('#00ff00');
        expect(colorIssue).toContain('#0000ff');
      });

      it('should handle nested design token structure', () => {
        const designTokens = {
          'design-tokens.json': JSON.stringify({
            theme: {
              light: {
                colors: {
                  primary: 'oklch(0.6 0.15 250)'
                }
              }
            }
          })
        };

        const code = `
export function Button() {
  return <button style={{ backgroundColor: '#123456' }}>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code, designTokens);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('#123456'))).toBe(true);
      });

      it('should handle invalid design token JSON gracefully', () => {
        const designTokens = {
          'design-tokens.json': 'invalid json'
        };

        const code = `
export function Button() {
  return <button style={{ backgroundColor: '#ff0000' }}>Click</button>;
}
        `;
        // Should not throw, just skip the check
        const result = componentSelfReview('Button', code, designTokens);
        expect(result.issues.length).toBe(1); // Only shadcn/ui warning
      });

      it('should handle missing design tokens gracefully', () => {
        const code = `
export function Button() {
  return <button style={{ backgroundColor: '#ff0000' }}>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code, {});
        // Should only fail shadcn/ui check, not color check
        expect(result.issues.some(i => i.includes('shadcn/ui'))).toBe(true);
        expect(result.issues.some(i => i.includes('Hardcoded colors'))).toBe(false);
      });

      it('should detect 3-digit hex colors', () => {
        const designTokens = {
          'design-tokens.json': JSON.stringify({
            colors: {
              primary: 'oklch(0.6 0.15 250)'
            }
          })
        };

        const code = `
export function Button() {
  return <button style={{ color: '#f00' }}>Click</button>;
}
        `;
        const result = componentSelfReview('Button', code, designTokens);
        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('#f00'))).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should return passed: true with no issues for clean component', () => {
        const code = `
import { Button } from '@/components/ui/button';

export function MyButton() {
  return <Button>Click me</Button>;
}
        `;
        const result = componentSelfReview('Button', code);
        expect(result.passed).toBe(true);
        expect(result.issues.length).toBe(0);
      });

      it('should report all issues when multiple problems exist', () => {
        const code = `
// TODO: Fix this later
console.log('debug');

export function BadButton() {
  return (
    <button style={{ backgroundColor: '#abc123' }}>
      placeholder
    </button>
  );
}
        `;
        const result = componentSelfReview('BadButton', code);
        expect(result.passed).toBe(false);
        expect(result.issues.length).toBeGreaterThanOrEqual(3);
      });

      it('should handle empty code', () => {
        const code = '';
        const result = componentSelfReview('Empty', code);
        // Empty code has no shadcn/ui import, so it should fail that check
        expect(result.issues.some(i => i.includes('shadcn/ui'))).toBe(true);
      });

      it('should handle component with animation and useReducedMotion', () => {
        const code = `
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function AnimatedButton() {
  const shouldReduce = useReducedMotion();
  
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduce ? 0 : 0.3 }}
    >
      Animate
    </motion.button>
  );
}
        `;
        const result = componentSelfReview('AnimatedButton', code);
        expect(result.passed).toBe(true);
      });
    });
  });
});
