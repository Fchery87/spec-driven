import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDesignerExecutor } from './agent_executors';
import { LLMProvider } from './providers/base';
import { ConfigLoader } from '../orchestrator/config_loader';

describe('Design Agent Executor', () => {
  describe('getDesignerExecutor', () => {
    it('should create a designer executor with correct role and expertise', () => {
      const executor = getDesignerExecutor();

      expect(executor.role).toBe('designer');
      expect(executor.perspective).toBe('head_of_design');
      expect(executor.expertise).toContain('ui_ux_design');
      expect(executor.expertise).toContain('design_systems');
      expect(executor.expertise).toContain('accessibility');
      expect(executor.expertise).toContain('color_theory');
    });

    it('should validate artifacts for anti-AI-slop compliance', async () => {
      const executor = getDesignerExecutor();

      // Test with valid design tokens (contains oklch, 60/30/10, 8pt)
      const validArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors (OKLCH format)
- Primary: oklch(0.6 0.2 250)
- Secondary: oklch(0.3 0.1 200)
- Accent: oklch(0.1 0.1 280)

## Typography (4 sizes)
- Display: 32px
- Heading: 24px
- Body: 16px
- Caption: 14px

## Spacing (8pt grid)
8, 16, 24, 32, 48

## 60/30/10 Rule
60% neutral, 30% secondary, 10% accent
`
      };

      const validResult = executor.validateArtifacts!(validArtifacts);
      expect(validResult.canProceed).toBe(true);
      expect(validResult.issues.filter((i: { severity: string }) => i.severity === 'error').length).toBe(0);
    });

    it('should reject artifacts with forbidden anti-patterns (purple-gradient, blob background)', async () => {
      const executor = getDesignerExecutor();

      // Test with forbidden patterns - use lowercase versions that will match after toLowerCase()
      const invalidArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Primary Color
- Style: purple-gradient
- Background: blob background
`
      };

      const invalidResult = executor.validateArtifacts!(invalidArtifacts);
      // Check for error issues related to forbidden patterns
      const errorIssues = invalidResult.issues.filter((i: { severity: string }) => i.severity === 'error');
      expect(errorIssues.length).toBeGreaterThan(0);
      
      // Verify specific forbidden patterns are detected
      expect(errorIssues.some((i: { message: string }) => i.message.includes('purple-gradient'))).toBe(true);
      expect(errorIssues.some((i: { message: string }) => i.message.includes('blob background'))).toBe(true);
    });

    it('should require OKLCH color format for SPEC_DESIGN_TOKENS', async () => {
      const executor = getDesignerExecutor();

      const artifactsWithoutOKLCH = {
        'design-tokens.md': `
# Design Tokens

## Colors (HEX format)
- Primary: #3b82f6
- Secondary: #64748b
`
      };

      const result = executor.validateArtifacts!(artifactsWithoutOKLCH);
      const oklchWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('oklch')
      );
      expect(oklchWarning).toBeDefined();
      expect(oklchWarning?.severity).toBe('warning');
    });

    it('should validate 60/30/10 rule presence', async () => {
      const executor = getDesignerExecutor();

      const artifactsWithoutRule = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: oklch(0.5 0.2 250)
`
      };

      const result = executor.validateArtifacts!(artifactsWithoutRule);
      const ruleWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('60/30/10')
      );
      expect(ruleWarning).toBeDefined();
    });

    it('should validate 8pt grid presence', async () => {
      const executor = getDesignerExecutor();

      const artifactsWithoutGrid = {
        'design-tokens.md': `
# Design Tokens

## Spacing
- Small: 10px
- Medium: 15px
- Large: 20px
`
      };

      const result = executor.validateArtifacts!(artifactsWithoutGrid);
      const gridWarning = result.issues.find(
        (i: { message: string }) => i.message.toLowerCase().includes('8pt')
      );
      expect(gridWarning).toBeDefined();
    });

    it('should validate typography-sizes requirement', async () => {
      const executor = getDesignerExecutor();

      const artifactsWithoutTypography = {
        'design-tokens.md': `
# Design Tokens

## Typography
- Body: 16px
- Heading: 20px
`
      };

      const result = executor.validateArtifacts!(artifactsWithoutTypography);
      const typographyWarning = result.issues.find(
        i => i.message.toLowerCase().includes('typography-sizes')
      );
      expect(typographyWarning).toBeDefined();
    });

    it('should pass validation when all required patterns are present', async () => {
      const executor = getDesignerExecutor();

      const validArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: oklch(0.6 0.15 250)
- Secondary: oklch(0.3 0.1 200)
- Accent: oklch(0.1 0.1 280)

## Typography
- Display: 48px
- Heading: 32px
- Body: 16px
- Caption: 14px

## Spacing
- 8, 16, 24, 32, 40, 48, 56, 64

## Color Distribution
Following the 60/30/10 rule for balanced visual hierarchy.
`
      };

      const result = executor.validateArtifacts!(validArtifacts);
      expect(result.canProceed).toBe(true);
      // Should have warnings but no errors
      expect(result.issues.filter((i: { severity: string }) => i.severity === 'error').length).toBe(0);
    });

    it('should detect multiple forbidden patterns in single artifact', async () => {
      const executor = getDesignerExecutor();

      const artifactsWithMultipleIssues = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: purple-gradient
- Secondary: linear-gradient(to right, #8b5cf6, #6366f1)

## Background
- Style: blob background
`
      };

      const result = executor.validateArtifacts!(artifactsWithMultipleIssues);
      const errorIssues = result.issues.filter((i: { severity: string }) => i.severity === 'error');
      
      // Should detect multiple forbidden patterns
      expect(errorIssues.length).toBeGreaterThanOrEqual(2);
    });

    it('should produce canProceed=false when errors are present', async () => {
      const executor = getDesignerExecutor();

      const invalidArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: purple-gradient
`
      };

      const result = executor.validateArtifacts!(invalidArtifacts);
      expect(result.canProceed).toBe(false);
    });

    it('should produce canProceed=true when only warnings are present', async () => {
      const executor = getDesignerExecutor();

      const warningOnlyArtifacts = {
        'design-tokens.md': `
# Design Tokens

## Colors
- Primary: #3b82f6
- Secondary: oklch(0.3 0.1 200)
- Accent: oklch(0.1 0.1 280)

## Typography
- Display: 48px
- Heading: 32px

## Spacing
- 8, 16, 24
`
      };

      const result = executor.validateArtifacts!(warningOnlyArtifacts);
      expect(result.canProceed).toBe(true);
      // Should have warnings but no errors
      const errorIssues = result.issues.filter((i: { severity: string }) => i.severity === 'error');
      expect(errorIssues.length).toBe(0);
    });
  });

  describe('Design Agent Context Requirements', () => {
    it('should support SPEC_DESIGN_TOKENS phase (stack-agnostic)', () => {
      const executor = getDesignerExecutor();

      // The executor should have the generateArtifacts method that handles this phase
      expect(typeof executor.generateArtifacts).toBe('function');
    });

    it('should support SPEC_DESIGN_COMPONENTS phase (stack-specific)', () => {
      const executor = getDesignerExecutor();

      // The executor should have the generateArtifacts method that handles this phase
      expect(typeof executor.generateArtifacts).toBe('function');
    });

    it('should include all required expertise areas', () => {
      const executor = getDesignerExecutor();

      const requiredExpertise = [
        'ui_ux_design',
        'design_systems',
        'accessibility',
        'color_theory'
      ];

      requiredExpertise.forEach(expertise => {
        expect(executor.expertise).toContain(expertise);
      });
    });

    it('should have validateArtifacts method', () => {
      const executor = getDesignerExecutor();

      expect(typeof executor.validateArtifacts!).toBe('function');
    });
  });
});
