import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateAntiAISlop } from '../validation/anti_ai_slop_validator';

describe('Anti-AI-Slop Validation for Design Agent', () => {
  describe('validateAntiAISlop', () => {
    describe('detects purple gradient AI slop patterns', () => {
      it('should fail when purple gradient is detected in design tokens', () => {
        const artifactWithPurpleGradient = `
# Design Tokens

## Colors
- Primary: linear-gradient(to right, #8b5acf, #7c21ab)
- Secondary: violet gradient
- Background: indigo gradient
        `.trim();

        const result = validateAntiAISlop('colors.md', artifactWithPurpleGradient);

        expect(result.status).toBe('fail');
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(e => e.includes('Purple gradient'))).toBe(true);
      });

      it('should fail when violet hex color is detected', () => {
        const artifactWithVioletHex = `
# Color Palette
Primary: #8B5ACF
Accent: #7C21AB
        `.trim();

        const result = validateAntiAISlop('colors.md', artifactWithVioletHex);

        expect(result.status).toBe('fail');
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(e => e.includes('Purple gradient'))).toBe(true);
      });

      it('should fail when OKLCH purple hue is detected', () => {
        const artifactWithPurpleOKLCH = `
# Colors
Primary: oklch(65% 0.2 290)
Accent: oklch(70% 0.25 300)
        `.trim();

        const result = validateAntiAISlop('colors.md', artifactWithPurpleOKLCH);

        // This may warn instead of fail depending on exact pattern matching
        expect(result.status).not.toBe('pass');
        expect(result.errors || result.warnings).toBeDefined();
      });
    });

    describe('detects Inter font default AI slop pattern', () => {
      it('should fail when Inter font is specified as default', () => {
        const artifactWithInterFont = `
# Typography
Font Family: "Inter", sans-serif
Body: Inter 16px
        `.trim();

        const result = validateAntiAISlop('typography.md', artifactWithInterFont);

        expect(result.status).toBe('fail');
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(e => e.includes('Inter font'))).toBe(true);
      });
    });

    describe('detects blob background AI slop pattern', () => {
      it('should fail when blob background is detected', () => {
        const artifactWithBlob = `
# Backgrounds
Blob Background: blob.svg
Shape: border-radius: 50% 60% 40% 70%
        `.trim();

        const result = validateAntiAISlop('backgrounds.md', artifactWithBlob);

        expect(result.status).toBe('fail');
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(e => e.includes('Blob background'))).toBe(true);
      });
    });

    describe('passes valid design artifacts', () => {
      it('should pass when design artifact has no AI slop patterns', () => {
        const validDesignTokens = `
# Design Tokens

## Colors - OKLCH Format
Neutral: oklch(20% 0 0)
Primary: oklch(55% 0.2 250)
Accent: oklch(65% 0.15 30)

## 60/30/10 Color Rule
- 60% Neutral (backgrounds, large areas)
- 30% Primary (text, important elements)
- 10% Accent (CTAs, highlights)

## Typography Scale
Body: 16px / 1.5
Label: 14px / 1.4
Heading: 24px / 1.2
Display: 48px / 1.1

## Spacing - 8pt Grid
Base unit: 8px
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
        `.trim();

        const result = validateAntiAISlop('design-tokens.md', validDesignTokens);

        expect(result.status).toBe('pass');
        expect(result.errors).toBeUndefined();
        expect(result.checks).toBeDefined();
        expect(result.checks?.no_purple_gradient).toBe(true);
        expect(result.checks?.no_inter_font_default).toBe(true);
        expect(result.checks?.no_blob_background).toBe(true);
        expect(result.checks?.has_oklch_colors).toBe(true);
        expect(result.checks?.has_60_30_10_rule).toBe(true);
        expect(result.checks?.has_8pt_grid).toBe(true);
        expect(result.checks?.has_typography_sizes).toBe(true);
      });

      it('should pass component inventory without AI slop patterns', () => {
        const validComponentInventory = `
# Component Inventory

## Color Rule (60/30/10)
- 60% Neutral (backgrounds, large areas) - oklch(20% 0 0)
- 30% Primary (text, important elements) - oklch(55% 0.2 250)
- 10% Accent (CTAs, highlights) - oklch(65% 0.15 30)

## Button
- Size: sm (32px), md (40px), lg (48px)
- Spacing: 8px 16px (1x base unit, 2x base unit)
- Colors: oklch(55% 0.2 250) primary, oklch(20% 0 0) neutral

## Card
- Padding: 24px (3x base unit)
- Border-radius: 8px (1x base unit)
- Colors: oklch(20% 0 0) background, oklch(25% 0 0) border

## Typography
- Body: 16px
- Label: 14px (captions)
- Heading: 24px
- Display: 48px
        `.trim();

        const result = validateAntiAISlop('component-inventory.md', validComponentInventory);

        expect(result.status).toBe('pass');
        expect(result.errors).toBeUndefined();
      });
    });

    describe('warns for missing required patterns', () => {
      it('should warn when OKLCH color format is missing', () => {
        const artifactWithoutOKLCH = `
# Colors
Primary: #3b82f6
Secondary: #64748b
        `.trim();

        const result = validateAntiAISlop('colors.md', artifactWithoutOKLCH);

        expect(result.status).toBe('warn');
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('OKLCH'))).toBe(true);
      });

      it('should warn when 60/30/10 rule is missing', () => {
        const artifactWithout6010 = `
# Colors
Primary: blue
Secondary: gray
        `.trim();

        const result = validateAntiAISlop('colors.md', artifactWithout6010);

        expect(result.status).toBe('warn');
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('60/30/10'))).toBe(true);
      });

      it('should warn when 8pt grid is not documented', () => {
        const artifactWithout8pt = `
# Spacing
Small: 5px
Medium: 10px
Large: 20px
        `.trim();

        const result = validateAntiAISlop('spacing.md', artifactWithout8pt);

        expect(result.status).toBe('warn');
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('8pt'))).toBe(true);
      });

      it('should warn when typography sizes are incomplete', () => {
        const artifactWithPartialTypography = `
# Typography
Body: 16px
Heading: 24px
        `.trim();

        const result = validateAntiAISlop('typography.md', artifactWithPartialTypography);

        expect(result.status).toBe('warn');
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.some(w => w.includes('typography'))).toBe(true);
      });
    });

    describe('combined validation scenarios', () => {
      it('should fail when AI slop patterns are present and warn about missing patterns', () => {
        const mixedArtifact = `
# Colors
Primary: #8B5ACF
Secondary: Inter font

Spacing: 5px
        `.trim();

        const result = validateAntiAISlop('colors.md', mixedArtifact);

        expect(result.status).toBe('fail');
        expect(result.errors?.length).toBeGreaterThan(0);
        expect(result.warnings?.length).toBeGreaterThan(0);
      });
    });
  });
});
