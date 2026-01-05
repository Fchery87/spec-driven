/**
 * Anti-AI-Slop Validator
 *
 * Validates design artifacts for common AI-generated design anti-patterns
 * and enforces design system best practices.
 */

import { ValidationResult } from '@/types/orchestrator';

/**
 * Checks for forbidden AI-generated design patterns.
 * Returns errors when these patterns are detected.
 */
function detectForbiddenPatterns(content: string): string[] {
  const errors: string[] = [];

  // Check for purple gradients (common AI slop pattern)
  const purpleGradientPatterns = [
    /\bpurple.*gradient\b/i,
    /\bgradient.*purple\b/i,
    /\bviolet.*gradient\b/i,
    /\bindigo.*gradient\b/i,
    /#8[Bb]5[Aa][Cc][Ff]/, // violet/indigo hex (8b5acf)
    /#7[Cc]21[Aa][Bb]/, // purple hex (7c21ab)
    /#a[0-9a-f]{5}[fF]/i, // any aXXXXXf pattern (purple-ish)
    /linear-gradient.*#(?:8b5|7c2|a[0-9a-f]{5})/i, // gradient with purple hex
    /\b(?:purple|violet|indigo)\b[^\n]{0,50}(?:primary|accent|background)/i,
    /oklch\([\d.]+\s*[\d.]+\s*(?:2[7-9][0-9]|[3-3][0-2][0-9])(\s*\/)?\)/i, // OKLCH with purple hue (270-320)
  ];

  for (const pattern of purpleGradientPatterns) {
    if (pattern.test(content)) {
      errors.push(
        'Forbidden pattern detected: Purple gradient (AI-generated design anti-pattern)'
      );
      break;
    }
  }

  // NOTE: Inter font is now handled via auto-fix instead of error
  // See autoFixInterFont() function below

  // Check for blob backgrounds (common AI slop pattern)
  const blobPatterns = [
    /\bblob\s+background\b/i,
    /\bbackground.*blob\b/i,
    /\.blob\b/i,
    /\bblob-.*\.(?:svg|png|jpg)/i,
    /blob\.svg/i,
    /border-radius:\s*[\d.]+%(?![\d.]*%)/, // amorphous blob-like border radius
  ];

  for (const pattern of blobPatterns) {
    if (pattern.test(content)) {
      errors.push(
        'Forbidden pattern detected: Blob background (AI-generated design anti-pattern)'
      );
      break;
    }
  }

  return errors;
}

/**
 * Auto-fix patterns for common AI slop
 * Returns { fixed: boolean, content: string, replacements: string[] }
 */
export function autoFixAntiAISlop(content: string): {
  fixed: boolean;
  content: string;
  replacements: string[];
} {
  const replacements: string[] = [];
  let fixedContent = content;

  // Auto-fix Inter font -> DM Sans (a professional, purposeful alternative)
  const interFontPatterns = [
    {
      pattern: /"Inter",?\s*sans-serif/gi,
      replacement: '"DM Sans", sans-serif',
    },
    {
      pattern: /'Inter',?\s*sans-serif/gi,
      replacement: "'DM Sans', sans-serif",
    },
    {
      pattern: /font-family:\s*['"]?Inter['"]?/gi,
      replacement: 'font-family: "DM Sans"',
    },
    {
      pattern: /\bInter\b(?=.*(?:font|default|typography|family))/gi,
      replacement: 'DM Sans',
    },
  ];

  for (const { pattern, replacement } of interFontPatterns) {
    if (pattern.test(fixedContent)) {
      fixedContent = fixedContent.replace(pattern, replacement);
      replacements.push(
        `Replaced "Inter" font with "DM Sans" (Inter is considered AI slop)`
      );
    }
  }

  return {
    fixed: replacements.length > 0,
    content: fixedContent,
    replacements,
  };
}

/**
 * Checks for required design system patterns.
 * Returns warnings when these patterns are missing.
 */
function detectMissingRequiredPatterns(content: string): string[] {
  const warnings: string[] = [];

  // Check for OKLCH color format
  const hasOKLCH = /oklch\(/i.test(content) || /\bOKLCH\b/i.test(content);
  if (!hasOKLCH) {
    warnings.push(
      'Missing required pattern: OKLCH color format (use OKLCH for colors)'
    );
  }

  // Check for 60/30/10 color rule
  const has6010Rule =
    /60[\s-]*30[\s-]*10|60\/30\/10/i.test(content) ||
    /sixty.*thirty.*ten|thirty.*sixty.*ten/i.test(content) ||
    /60%.*30%.*10%/i.test(content);
  if (!has6010Rule) {
    warnings.push(
      'Missing required pattern: 60/30/10 color rule (not documented)'
    );
  }

  // Check for 8pt grid / spacing divisible by 4 or 8
  const has8ptGrid =
    /8\s*pt|8px|grid.*\b8\b|spacing.*\b8\b/i.test(content) ||
    /base.*spacing.*\b[48]\b/i.test(content);
  if (!has8ptGrid) {
    warnings.push('Missing required pattern: 8pt grid system (not documented)');
  }

  // Check for 4 typography sizes (body, label, heading, display)
  const typographyChecks = [
    /\bbody\b/i,
    /\blabel\b/i,
    /\bheading\b/i,
    /\bdisplay\b/i,
  ];

  const typographyFound = typographyChecks.filter((pattern) =>
    pattern.test(content)
  );
  if (typographyFound.length < 4) {
    const missing = ['body', 'label', 'heading', 'display'].filter(
      (term, i) => !typographyChecks[i].test(content)
    );
    warnings.push(
      `Missing required typography tokens: ${missing.join(
        ', '
      )} (need all 4: body, label, heading, display)`
    );
  }

  return warnings;
}

/**
 * Validates a design artifact for anti-AI-slop patterns.
 *
 * @param artifactName - The name of the artifact being validated
 * @param content - The content to validate
 * @returns ValidationResult with canProceed status and issues array
 */
export function validateAntiAISlop(
  artifactName: string,
  content: string
): ValidationResult {
  const errors = detectForbiddenPatterns(content);
  const warnings = detectMissingRequiredPatterns(content);

  const status =
    errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';

  const checks: Record<string, boolean> = {
    no_purple_gradient: !errors.some((e) => e.includes('Purple gradient')),
    no_inter_font_default: !errors.some((e) => e.includes('Inter font')),
    no_blob_background: !errors.some((e) => e.includes('Blob background')),
    has_oklch_colors: !warnings.some((w) => w.includes('OKLCH')),
    has_60_30_10_rule: !warnings.some((w) => w.includes('60/30/10')),
    has_8pt_grid: !warnings.some((w) => w.includes('8pt')),
    has_typography_sizes: !warnings.some((w) => w.includes('typography')),
  };

  return {
    status,
    checks,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
