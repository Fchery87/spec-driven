import { describe, it, expect } from 'vitest';
import {
  runInlineValidation,
  InlineValidationConfig,
  InlineValidationResult,
  PHASE_VALIDATORS,
} from './inline_validation';

describe('Inline Validation System', () => {
  describe('ANALYSIS Phase Validators', () => {
    it('should validate presence of required artifacts', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': '---\ntitle: Test\n---\nValid project brief content with enough length to pass the content quality validator check',
          'constitution.md': '---\ntitle: Constitution\n---\nValid constitution content with enough length to pass the content quality validator check',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required artifacts', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': 'Valid content',
          // Missing constitution.md
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('constitution.md');
    });

    it('should validate markdown frontmatter', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': '---\ntitle: Test\n---\nContent',
          'constitution.md': 'Missing frontmatter',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('frontmatter');
    });

    it('should check for unresolved clarifications', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': '---\ntitle: Test\n---\nContent with [CLARIFICATION NEEDED: something]',
          'constitution.md': '---\ntitle: Constitution\n---\nValid content',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Unresolved clarification');
    });

    it('should detect stub/incomplete content', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': '---\ntitle: Test\n---\nShort',
          'constitution.md': '---\ntitle: Constitution\n---\nValid content with enough length to pass minimum character threshold',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.warnings.length).toBeGreaterThan(0);
      const incompleteWarning = result.warnings.find(w => w.message.includes('incomplete'));
      expect(incompleteWarning).toBeDefined();
    });

    it('should detect placeholder text', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': '---\ntitle: Test\n---\nContent with TODO: fix this later and enough content to pass length check',
          'constitution.md': '---\ntitle: Constitution\n---\nValid content with enough length to pass minimum character threshold',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.warnings.length).toBeGreaterThan(0);
      const placeholderWarning = result.warnings.find(w => w.message.includes('placeholder'));
      expect(placeholderWarning).toBeDefined();
    });
  });

  describe('STACK_SELECTION Phase Validators', () => {
    it('should validate stack.json presence and format', async () => {
      const config: InlineValidationConfig = {
        phase: 'STACK_SELECTION',
        artifacts: {
          'stack.json': JSON.stringify({
            frontend: 'React',
            backend: 'Node.js',
            database: 'PostgreSQL',
            approved: true,
          }),
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(true);
    });

    it('should detect invalid JSON in stack.json', async () => {
      const config: InlineValidationConfig = {
        phase: 'STACK_SELECTION',
        artifacts: {
          'stack.json': 'Invalid JSON {',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain('JSON');
    });

    it('should validate stack completeness', async () => {
      const config: InlineValidationConfig = {
        phase: 'STACK_SELECTION',
        artifacts: {
          'stack.json': JSON.stringify({
            frontend: 'React',
            // Missing backend and database
          }),
        },
      };

      const result = await runInlineValidation(config);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Incomplete');
    });

    it('should require stack approval', async () => {
      const config: InlineValidationConfig = {
        phase: 'STACK_SELECTION',
        artifacts: {
          'stack.json': JSON.stringify({
            frontend: 'React',
            backend: 'Node.js',
            database: 'PostgreSQL',
            // Missing approved: true
          }),
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('not approved');
    });

    it('should pass when stack is approved', async () => {
      const config: InlineValidationConfig = {
        phase: 'STACK_SELECTION',
        artifacts: {
          'stack.json': JSON.stringify({
            frontend: 'React',
            backend: 'Node.js',
            database: 'PostgreSQL',
            approved: true,
          }),
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(true);
    });
  });

  describe('Validation Behaviors', () => {
    it('should allow progression with warnings (non-blocking)', async () => {
      const config: InlineValidationConfig = {
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': 'Missing frontmatter',
          'constitution.md': 'Valid content',
        },
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(true); // Warnings don't block
      expect(result.canProceed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should block progression on critical errors', async () => {
      const config: InlineValidationConfig = {
        phase: 'STACK_SELECTION',
        artifacts: {}, // Missing required artifacts
      };

      const result = await runInlineValidation(config);

      expect(result.passed).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Warning Accumulation', () => {
    it('should track accumulated warnings', async () => {
      const result = await runInlineValidation({
        phase: 'ANALYSIS',
        artifacts: {
          'project-brief.md': '---\ntitle: Test\n---\nShort',
          'constitution.md': '---\ntitle: Constitution\n---\nShort too',
        },
        accumulatedWarnings: [], // Start fresh
      });

      expect(result.totalWarnings).toBe(2);
      expect(result.accumulatedWarnings).toHaveLength(2);
    });

    it('should carry forward warnings from previous phases', async () => {
      const previousWarnings = [
        { phase: 'ANALYSIS', message: 'Previous warning', severity: 'warning' as const },
      ];

      const result = await runInlineValidation({
        phase: 'STACK_SELECTION',
        artifacts: {
          'stack.json': JSON.stringify({ incomplete: true }),
        },
        accumulatedWarnings: previousWarnings,
      });

      expect(result.totalWarnings).toBeGreaterThan(1);
      expect(result.accumulatedWarnings).toContain(previousWarnings[0]);
    });
  });
});
