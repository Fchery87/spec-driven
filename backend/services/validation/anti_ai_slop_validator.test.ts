/**
 * Anti-AI-Slop Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { validateAntiAISlop } from './anti_ai_slop_validator';

describe('Anti-AI-Slop Validator', () => {
  describe('Forbidden Patterns - Errors', () => {
    describe('Purple Gradients', () => {
      it('should reject purple gradient in content', () => {
        const content = 'background: linear-gradient(to right, #8b5cf6, #a855f7);';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(e => e.includes('Purple gradient'))).toBe(true);
      });

      it('should reject violet gradient', () => {
        const content = 'The design uses a violet gradient for the hero section.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Purple gradient'))).toBe(true);
      });

      it('should reject indigo gradient', () => {
        const content = 'indigo gradient background with blurred elements';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Purple gradient'))).toBe(true);
      });

      it('should reject OKLCH purple colors', () => {
        const content = 'color: oklch(0.7 0.15 280);';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Purple gradient'))).toBe(true);
      });

      it('should pass without purple gradient', () => {
        const content = 'Background color is #3b82f6 (blue) with white text.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).not.toBe('fail');
        expect(result.checks?.no_purple_gradient).toBe(true);
      });
    });

    describe('Inter Font Default', () => {
      it('should reject Inter font family', () => {
        const content = 'font-family: Inter, system-ui, sans-serif;';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Inter font'))).toBe(true);
      });

      it('should reject Inter as default font', () => {
        const content = '"Inter", sans-serif is used for all typography.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Inter font'))).toBe(true);
      });

      it('should pass when using other fonts', () => {
        const content = 'The design uses Geist Sans with Apple System fonts.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).not.toBe('fail');
        expect(result.checks?.no_inter_font_default).toBe(true);
      });
    });

    describe('Blob Backgrounds', () => {
      it('should reject blob background', () => {
        const content = 'The hero section uses a blob background image.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Blob background'))).toBe(true);
      });

      it('should reject blob.svg reference', () => {
        const content = 'background: url(/images/blob.svg) no-repeat center;';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).toBe('fail');
        expect(result.errors?.some(e => e.includes('Blob background'))).toBe(true);
      });

      it('should pass without blob backgrounds', () => {
        const content = 'The design uses solid colors and clean gradients.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.status).not.toBe('fail');
        expect(result.checks?.no_blob_background).toBe(true);
      });
    });
  });

  describe('Required Patterns - Warnings', () => {
    describe('OKLCH Colors', () => {
      it('should warn when OKLCH is missing', () => {
        const content = 'Colors are specified using hex values like #3b82f6.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('OKLCH'))).toBe(true);
      });

      it('should pass when OKLCH is present', () => {
        const content = 'Primary color: oklch(0.6 0.2 250);';
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings?.some(w => w.includes('OKLCH'))).toBe(false);
        expect(result.checks?.has_oklch_colors).toBe(true);
      });

      it('should pass with OKLCH keyword', () => {
        const content = 'The color system uses OKLCH for consistency.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.checks?.has_oklch_colors).toBe(true);
      });
    });

    describe('60/30/10 Rule', () => {
      it('should warn when 60/30/10 rule is missing', () => {
        const content = 'The design uses multiple colors throughout.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('60/30/10'))).toBe(true);
      });

      it('should pass when 60/30/10 is documented', () => {
        const content = 'Color distribution follows the 60-30-10 rule.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.checks?.has_60_30_10_rule).toBe(true);
      });

      it('should pass with numeric format', () => {
        const content = 'Use 60% neutral, 30% secondary, 10% accent colors.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.checks?.has_60_30_10_rule).toBe(true);
      });
    });

    describe('8pt Grid', () => {
      it('should warn when 8pt grid is missing', () => {
        const content = 'Spacing uses various pixel values.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('8pt'))).toBe(true);
      });

      it('should pass when 8pt grid is documented', () => {
        const content = 'All spacing uses the 8pt grid system.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.checks?.has_8pt_grid).toBe(true);
      });

      it('should pass with base spacing reference', () => {
        const content = 'Base spacing unit is 8px with multiples for larger gaps.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.checks?.has_8pt_grid).toBe(true);
      });
    });

    describe('Typography Sizes', () => {
      it('should warn when typography tokens are missing', () => {
        const content = 'The typography system has multiple sizes.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('typography'))).toBe(true);
      });

      it('should pass when all 4 typography sizes are present', () => {
        const content = `
## Typography
- Body: Base text size for content
- Label: Small text for UI labels
- Heading: Section headings
- Display: Hero and large text
        `.trim();
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings?.some(w => w.includes('typography'))).toBe(false);
        expect(result.checks?.has_typography_sizes).toBe(true);
      });

      it('should warn with partial typography tokens', () => {
        const content = 'Typography includes body and heading sizes.';
        const result = validateAntiAISlop('test.md', content);
        expect(result.warnings?.some(w => w.includes('label') && w.includes('display'))).toBe(true);
      });
    });
  });

  describe('Valid Designs - Pass', () => {
    it('should pass with correct anti-AI-slop patterns', () => {
      const content = `
# Design System

## Colors
- Primary: oklch(0.6 0.2 220) (blue)
- Secondary: oklch(0.7 0.15 40) (warm)
- Accent: oklch(0.8 0.1 80) (orange)

The 60/30/10 color rule is applied: 60% neutral, 30% secondary, 10% accent.

## Typography
- Body: 16px base size
- Label: 14px for UI elements
- Heading: Bold, hierarchical levels
- Display: 32px+ for hero sections

## Spacing
Uses 8pt grid system with 8px, 16px, 24px, 32px spacing tokens.

## Font
Primary font: Geist Sans with purposeful weights.
      `.trim();
      const result = validateAntiAISlop('design-system.md', content);
      expect(result.status).toBe('pass');
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeUndefined();
      expect(result.checks).toEqual({
        no_purple_gradient: true,
        no_inter_font_default: true,
        no_blob_background: true,
        has_oklch_colors: true,
        has_60_30_10_rule: true,
        has_8pt_grid: true,
        has_typography_sizes: true,
      });
    });
  });

  describe('Mixed Results', () => {
    it('should return fail when errors exist, even with warnings', () => {
      const content = `
# Design System

Uses Inter font as default.
Primary color: oklch(0.6 0.2 220)
      `.trim();
      const result = validateAntiAISlop('design-system.md', content);
      expect(result.status).toBe('fail');
      expect(result.errors?.some(e => e.includes('Inter font'))).toBe(true);
      // Warnings should still be present
      expect(result.warnings).toBeDefined();
    });

    it('should return warn when only warnings exist', () => {
      const content = `
# Design System

Colors use hex format.
      `.trim();
      const result = validateAntiAISlop('design-system.md', content);
      expect(result.status).toBe('warn');
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('Artifact Name Handling', () => {
    it('should handle various artifact names', () => {
      const content = 'Inter font used as default.';
      const result = validateAntiAISlop('design-system.md', content);
      expect(result.status).toBe('fail');

      const result2 = validateAntiAISlop('style-guide.tsx', content);
      expect(result2.status).toBe('fail');

      const result3 = validateAntiAISlop('', content);
      expect(result3.status).toBe('fail');
    });
  });

  describe('Empty Content', () => {
    it('should handle empty content', () => {
      const result = validateAntiAISlop('test.md', '');
      expect(result.status).toBe('warn');
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('should handle whitespace-only content', () => {
      const result = validateAntiAISlop('test.md', '   \n\t  ');
      expect(result.status).toBe('warn');
    });
  });
});
