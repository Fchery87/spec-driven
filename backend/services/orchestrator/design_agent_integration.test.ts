import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getDesignerExecutor } from '../llm/agent_executors';
import { LLMProvider } from '../llm/providers/base';
import { ConfigLoader } from '../orchestrator/config_loader';

// Mock LLM provider for testing
const mockLLMProvider = {
  generateCompletion: vi.fn().mockResolvedValue({
    content: `
filename: design-tokens.md
---
title: Design Tokens
owner: designer
version: 1.0
date: 2025-01-02
status: draft
---

# Design Tokens

## Colors (OKLCH format)
- Primary: oklch(0.6 0.15 250)
- Secondary: oklch(0.3 0.1 200)
- Accent: oklch(0.1 0.1 280)
- Neutral: oklch(0.9 0.02 250)

## Typography (4 sizes)
- Display: 32px
- Heading: 24px
- Body: 16px
- Caption: 14px

## Spacing (8pt grid)
8, 16, 24, 32, 48, 64

## 60/30/10 Rule
Following the 60/30/10 rule for balanced visual hierarchy.

## Animation
- Fast: 150ms
- Normal: 200ms
- Slow: 300ms
- Emphasis: 500ms
`,
  }),
} as unknown as LLMProvider;

describe('Design Agent Integration Tests', () => {
  describe('SPEC_DESIGN_TOKENS Phase', () => {
    it('should generate design tokens with OKLCH colors', async () => {
      const executor = getDesignerExecutor();

      const result = await executor.generateArtifacts({
        phase: 'SPEC_DESIGN_TOKENS',
        stack: undefined, // Stack-agnostic
        constitution: 'User privacy is paramount. Performance is critical.',
        projectBrief: 'A project management tool for remote teams.',
        projectPath: '/tmp/test-project',
        projectId: 'test-project-123',
        llmClient: mockLLMProvider as LLMProvider,
      });

      expect(result.success).toBe(true);
      expect(result.artifacts['design-tokens.md']).toBeDefined();
      expect(result.artifacts['design-tokens.md']).toContain('oklch');
      expect(result.metadata!.phase).toBe('SPEC_DESIGN_TOKENS');
      expect(result.metadata!.stackAgnostic).toBe(true);
    });

    it('should validate design tokens for anti-AI-slop compliance', () => {
      const executor = getDesignerExecutor();

      const validArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors (OKLCH format)
- Primary: oklch(0.6 0.15 250)
- Secondary: oklch(0.3 0.1 200)
- Accent: oklch(0.1 0.1 280)

## Typography (4 sizes)
- Display: 32px
- Heading: 24px
- Body: 16px
- Caption: 14px

## Spacing (8pt grid)
8, 16, 24, 32, 48, 64

## 60/30/10 Rule
60% neutral, 30% secondary, 10% accent
`,
      };

      const result = executor.validateArtifacts!(validArtifacts);
      expect(result.canProceed).toBe(true);
      expect(result.issues.filter((i: { severity: string }) => i.severity === 'error').length).toBe(0);
    });

    it('should reject artifacts with forbidden patterns', () => {
      const executor = getDesignerExecutor();

      const invalidArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: purple-gradient
- Secondary: linear-gradient(to right, #8b5cf6, #6366f1)

## Background
- Style: blob background
`,
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      expect(result.canProceed).toBe(false);
      expect(result.issues.some((i: { severity: string }) => i.severity === 'error')).toBe(true);
    });

    it('should include stackAgnostic flag in metadata', async () => {
      const executor = getDesignerExecutor();

      const result = await executor.generateArtifacts({
        phase: 'SPEC_DESIGN_TOKENS',
        stack: undefined,
        constitution: '',
        projectBrief: '',
        projectPath: '/tmp/test',
        projectId: 'test',
        llmClient: mockLLMProvider as LLMProvider,
      });

      expect(result.metadata!.stackAgnostic).toBe(true);
    });

    it('should throw error when llmClient is not provided', async () => {
      const executor = getDesignerExecutor();

      await expect(executor.generateArtifacts({
        phase: 'SPEC_DESIGN_TOKENS',
        stack: undefined,
        constitution: '',
        projectBrief: '',
        projectPath: '/tmp/test',
        projectId: 'test',
      })).rejects.toThrow('llmClient is required in context for getDesignerExecutor.generateArtifacts');
    });
  });

  describe('SPEC_DESIGN_COMPONENTS Phase', () => {
    it('should generate component mapping with stack-specific details', async () => {
      const executor = getDesignerExecutor();

      const result = await executor.generateArtifacts({
        phase: 'SPEC_DESIGN_COMPONENTS',
        stack: 'nextjs_web_app',
        constitution: 'User privacy is paramount.',
        projectBrief: 'A project management tool.',
        projectPath: '/tmp/test-project',
        projectId: 'test-project-456',
        llmClient: mockLLMProvider as LLMProvider,
      });

      expect(result.success).toBe(true);
      expect(result.artifacts['component-mapping.md']).toBeDefined();
      expect(result.metadata!.phase).toBe('SPEC_DESIGN_COMPONENTS');
      expect(result.metadata!.stackAgnostic).toBe(false);
    });

    it('should generate journey maps for user flows', async () => {
      const executor = getDesignerExecutor();

      const result = await executor.generateArtifacts({
        phase: 'SPEC_DESIGN_COMPONENTS',
        stack: 'nextjs_web_app',
        constitution: '',
        projectBrief: 'A project management tool for remote teams.',
        projectPath: '/tmp/test',
        projectId: 'test',
        llmClient: mockLLMProvider as LLMProvider,
      });

      expect(result.success).toBe(true);
      // The executor should generate either component-mapping.md or journey-maps.md
      const hasContent = result.artifacts['component-mapping.md'] || result.artifacts['journey-maps.md'];
      expect(hasContent).toBeDefined();
    });

    it('should include stack info in generated artifacts', async () => {
      const executor = getDesignerExecutor();

      const result = await executor.generateArtifacts({
        phase: 'SPEC_DESIGN_COMPONENTS',
        stack: 'hybrid_nextjs_fastapi',
        constitution: '',
        projectBrief: 'AI-powered application',
        projectPath: '/tmp/test',
        projectId: 'test',
        llmClient: mockLLMProvider as LLMProvider,
      });

      expect(result.success).toBe(true);
      // The artifacts should be generated with stack context
      expect(result.metadata!.stack).toBe('hybrid_nextjs_fastapi');
    });
  });

  describe('Designer Executor Interface', () => {
    it('should have correct role and perspective', () => {
      const executor = getDesignerExecutor();

      expect(executor.role).toBe('designer');
      expect(executor.perspective).toBe('head_of_design');
    });

    it('should include all required expertise areas', () => {
      const executor = getDesignerExecutor();

      expect(executor.expertise).toContain('ui_ux_design');
      expect(executor.expertise).toContain('design_systems');
      expect(executor.expertise).toContain('accessibility');
      expect(executor.expertise).toContain('color_theory');
    });

    it('should have generateArtifacts method', () => {
      const executor = getDesignerExecutor();

      expect(typeof executor.generateArtifacts).toBe('function');
    });

    it('should have validateArtifacts method', () => {
      const executor = getDesignerExecutor();

      expect(typeof executor.validateArtifacts!).toBe('function');
    });
  });

  describe('Anti-AI-Slop Validation', () => {
    it('should flag missing OKLCH color format', () => {
      const executor = getDesignerExecutor();

      const artifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors (HEX format)
- Primary: #3b82f6
- Secondary: #64748b
`,
      };

      const result = executor.validateArtifacts!(artifacts);
      const oklchWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('oklch')
      );
      expect(oklchWarning).toBeDefined();
      expect(oklchWarning?.severity).toBe('warning');
    });

    it('should flag missing 60/30/10 rule', () => {
      const executor = getDesignerExecutor();

      const artifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: oklch(0.5 0.2 250)
- Secondary: oklch(0.5 0.2 200)
- Accent: oklch(0.5 0.2 280)
`,
      };

      const result = executor.validateArtifacts!(artifacts);
      const ruleWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('60/30/10')
      );
      expect(ruleWarning).toBeDefined();
    });

    it('should flag non-8pt spacing values', () => {
      const executor = getDesignerExecutor();

      const artifacts = {
        'design-tokens.md': `
# Design Tokens

## Spacing
- Small: 10px
- Medium: 15px
- Large: 20px
`,
      };

      const result = executor.validateArtifacts!(artifacts);
      const gridWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('8pt')
      );
      expect(gridWarning).toBeDefined();
    });

    it('should flag missing typography sizes', () => {
      const executor = getDesignerExecutor();

      const artifacts = {
        'design-tokens.md': `
# Design Tokens

## Typography
- Body: 16px
`,
      };

      const result = executor.validateArtifacts!(artifacts);
      const typographyWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('typography-sizes')
      );
      expect(typographyWarning).toBeDefined();
    });
  });
});
