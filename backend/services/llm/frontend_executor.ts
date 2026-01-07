import type { AgentExecutor, ArtifactGenerationResult, ValidationResult } from './agent_executors';
import type { ValidationIssue } from '../orchestrator/inline_validation';
import { MCP_TOOLS_DOC, SHADCN_UI_PATTERNS, formatMCPContext } from './mcp-code-lookup';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FrontendSelfReview {
  passed: boolean;
  issues: string[];
}

export interface FrontendConfig {
  // Configuration options for frontend execution
  enableAnimations?: boolean;
  strictAntiGenericMode?: boolean;
  useMCPLookup?: boolean;
  [key: string]: unknown;
}

export interface FrontendContext extends Record<string, unknown> {
  phase: 'SPEC_FRONTEND' | 'ITERATION_FRONTEND';
  projectName: string;
  projectBrief: string;
  designTokens: string;
  componentInventory: string;
  stack: string;
  componentType?: string; // MCP lookup parameter
  llmClient?: {
    generateCompletion: (prompt: string, systemPrompt?: string, maxRetries?: number, phase?: string) => Promise<{
      content: string;
    }>;
    callMCPTool?: (toolName: string, params: Record<string, unknown>) => Promise<{
      result: string;
    }>;
  };
}

// ============================================================================
// MCP INTEGRATION HELPERS
// ============================================================================

/**
 * Get MCP lookup context for a specific component type
 */
function getMCPLookupContext(componentType: string): string {
  const mcpContext = formatMCPContext(componentType);
  if (mcpContext) {
    return mcpContext;
  }
  
  // Default MCP context for frontend components
  return `
## MCP Code Lookup for ${componentType}

Before generating the ${componentType} component, use MCP tools to fetch accurate code:

1. **exa-code search** for shadcn/ui ${componentType} component:
   - Query: "shadcn/ui ${componentType} component TypeScript React"
   - Library: shadcn/ui

2. **context7 query** for implementation details:
   - Query: "How to implement ${componentType} with cva variants and proper accessibility?"
   - Library: shadcn/ui

3. **Adapt the fetched code**:
   - Replace hardcoded colors with OKLCH design tokens
   - Update imports to use @/lib/utils aliases
   - Add Framer Motion animations
   - Ensure TypeScript types are exported
`;
}

/**
 * Get component-specific MCP query pattern
 */
function getComponentMCPPatterns(components: string[]): string {
  const patterns: string[] = [];
  
  for (const component of components) {
    const normalized = component.toLowerCase().replace(/[^a-z]/g, '');
    
    for (const [key, pattern] of Object.entries(SHADCN_UI_PATTERNS)) {
      if (normalized.includes(key)) {
        patterns.push(`
### ${component}
- Query: "${pattern.query}"
- Library: ${pattern.library}
- Purpose: ${pattern.description}
`);
        break;
      }
    }
  }
  
  return patterns.join('\n');
}

// ============================================================================
// COMPONENT SELF-REVIEW
// ============================================================================

/**
 * Extract colors from design tokens
 */
function extractColorsFromTokens(tokens: Record<string, unknown>): string[] {
  const colors: string[] = [];
  
  function traverse(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string' && value.startsWith('oklch')) {
        colors.push(value.toLowerCase());
      } else if (typeof value === 'object' && value !== null) {
        traverse(value as Record<string, unknown>, newKey);
      }
    }
  }
  
  traverse(tokens);
  return colors;
}

/**
 * Check if code uses useReducedMotion from framer-motion
 */
function usesReducedMotion(code: string): boolean {
  return /\.useReducedMotion|useReducedMotion/.test(code);
}

/**
 * Check if code has animations or transitions
 */
function hasAnimations(code: string): boolean {
  return /animation|transition|keyframe|whileHover|whileTap|whileInView|initial|animate|exit/.test(code);
}

/**
 * Self-review check for generated frontend components
 * Runs BEFORE each component is considered complete
 */
export function componentSelfReview(
  componentName: string,
  code: string,
  designTokens: Record<string, string> = {}
): FrontendSelfReview {
  const issues: string[] = [];
  
  // 1. Check for placeholder code
  if (/\/\/\s*TODO|\bTODO:|\bplaceholder\b/i.test(code)) {
    issues.push(`${componentName}: Contains placeholder code (// TODO)`);
  }
  
  // 2. Check for lorem ipsum
  if (/lorem\s+ipsum/i.test(code)) {
    issues.push(`${componentName}: Contains lorem ipsum text`);
  }
  
  // 3. Check for console.log
  if (/console\.(log|debug|info)/.test(code)) {
    issues.push(`${componentName}: Contains console.log statements`);
  }
  
  // 4. Check for useReducedMotion (accessibility) when animations are present
  if (hasAnimations(code) && !usesReducedMotion(code)) {
    issues.push(`${componentName}: Has animations but missing useReducedMotion (accessibility)`);
  }
  
  // 5. Check for shadcn/ui patterns (Button, Card, Input, etc.)
  if (!/import\s+.*\s+from\s+['"]@\/components\/ui\//.test(code)) {
    issues.push(`${componentName}: Not using shadcn/ui components`);
  }
  
  // 6. Check for design tokens (colors from design-tokens.json)
  if (designTokens['design-tokens.json']) {
    try {
      const tokens = JSON.parse(designTokens['design-tokens.json']);
      // Check for hardcoded hex colors not in tokens
      const colorPattern = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
      const hardcodedColors = code.match(colorPattern);
      
      if (hardcodedColors) {
        // Check if colors exist in tokens
        const tokenColors = extractColorsFromTokens(tokens);
        const validColors = tokenColors.map(c => c.toLowerCase());
        
        const invalidColors = hardcodedColors.filter(c => 
          !validColors.includes(c.toLowerCase())
        );
        
        if (invalidColors.length > 0) {
          issues.push(`${componentName}: Hardcoded colors not in design tokens: ${invalidColors.join(', ')}`);
        }
      }
    } catch {
      // If design tokens parsing fails, skip the color check
    }
  }
  
  return {
    passed: issues.length === 0,
    issues,
  };
}

// ============================================================================
// FRONTEND EXECUTOR
// ============================================================================

/**
 * Frontend Executor - Creative Technologist
 * Perspective: Creative Technologist
 * Generates distinctive, production-grade frontend interfaces
 * 
 * MCP Integration:
 * - Uses exa-code to fetch real shadcn/ui component patterns
 * - Uses context7 to query library documentation
 * - Adapts fetched code to match design tokens
 * 
 * Anti-AI-Slop Enforcement:
 * - NEVER use: Inter, Roboto, Arial, system fonts, purple gradients, predictable layouts
 * - ALWAYS use: Custom fonts, distinctive colors, unexpected layouts, creative motion
 */
export function getFrontendExecutor(config: FrontendConfig = {}): AgentExecutor {
  const strictMode = config.strictAntiGenericMode ?? true;
  const useMCPLookup = config.useMCPLookup ?? true;
  
  return {
    role: 'frontend_developer',
    perspective: 'creative_technologist',
    expertise: ['react', 'typescript', 'css_animation', 'design_systems'],
    
    async generateArtifacts(context: Record<string, unknown>): Promise<ArtifactGenerationResult> {
      const { 
        phase, 
        projectName, 
        projectBrief, 
        designTokens, 
        componentInventory, 
        stack,
        llmClient 
      } = context as FrontendContext;

      // llmClient must be provided in context (passed from orchestrator)
      if (!llmClient) {
        throw new Error('llmClient is required in context for getFrontendExecutor.generateArtifacts');
      }

      const isProductionPhase = phase === 'SPEC_FRONTEND';

      // Extract component types from inventory for MCP lookup
      const componentTypes = componentInventory
        .match(/###?\s*([A-Z][a-zA-Z]+)/g)
        ?.map(m => m.replace(/###?\s*/, '')) || [];

      // Build MCP context
      const mcpLookupSection = useMCPLookup ? `
${MCP_TOOLS_DOC}

## Component-Specific MCP Lookups
${getComponentMCPPatterns(['Button', 'Input', 'Card', 'Dialog', 'Select', 'Form', 'Toast', 'Tabs', 'Dropdown', 'Badge'])}
` : '';

      // Build the LLM prompt for frontend generation
      const frontendPrompt = `You are a Creative Technologist specializing in distinctive, production-grade frontend interfaces.

## Project: ${projectName}

## Project Brief:
${projectBrief}

## Design Tokens (from design-tokens.md):
\`\`\`
${designTokens.slice(0, 8000)}
\`\`\`

## Component Mapping (from component-mapping.md):
\`\`\`
${componentInventory.slice(0, 8000)}
\`\`\`

## Tech Stack: ${stack}

${mcpLookupSection}

## ANTI-GENERIC AI SLOP RULES (STRICTLY ENFORCE):

### NEVER USE (Forbidden Patterns):
1. **Fonts**: Inter, Roboto, Arial, system-ui, sans-serif defaults
   - Instead: Use distinctive Google Fonts (e.g., Space Grotesk, Outfit, Fraunces, Syne, Playfair Display)
   - Must specify exact @font-face or @import with specific weights (300-700)

2. **Colors**: Purple gradients, blue-purple gradients, generic "tech" gradients
   - Instead: Use the OKLCH colors from design tokens
   - Implement CSS custom properties for all colors

3. **Layouts**: Centered cards, hero sections with gradient backgrounds, blob decorations
   - Instead: Asymmetry, diagonal flows, grid-breaking layouts
   - Consider overlap, whitespace, unexpected positioning

4. **Motion**: Basic fades, simple scales, default easing
   - Instead: Framer Motion for React components with spring physics
   - Staggered children, morphing, scroll-triggered reveals

5. **Patterns**: "Inter font default", "Purple gradient hero", "Blob background", "Centered content card"

### REQUIRED (Aesthetic Standards):

1. **Typography**: One distinctive display font + one refined body font
   - Display: Consider Space Grotesk, Syne, Fraunces, or Outfit for headings
   - Body: Consider DM Sans, Public Sans, or Geist for readability

2. **Color**: CSS variables with OKLCH values from design tokens
   - Dominant colors with sharp accents
   - Purposeful contrast ratios

3. **Motion**: Framer Motion for React components
   - spring(...) for natural physics
   - Custom easings for distinctive feel
   - Scroll-triggered animations

4. **Spatial**: Asymmetry, overlap, diagonal flow, grid-breaking
   - Avoid predictable vertical stacks
   - Use CSS Grid creatively

## MCP-FIRST CODE GENERATION

IMPORTANT: Before generating each component, you should use MCP tools:

1. **Call exa-code** to search for: "shadcn/ui {componentType} component TypeScript React"
2. **Call context7** to query: "How to implement {componentType} with cva variants?"
3. **Adapt the real code** to your design tokens and motion patterns
4. **Verify accessibility** matches the fetched implementation

This ensures production-ready, accurate code patterns.

## OUTPUT FORMAT:
\`\`\`tsx filename: src/components/PageLayout.tsx
import { motion } from 'framer-motion';

// Your distinctive React component
\`\`\`

### For SPEC_FRONTEND phase:
Generate these artifacts:
1. **src/components/ui/Button.tsx** - Distinctive button with custom fonts and motion
2. **src/components/ui/Input.tsx** - Styled input with design token colors
3. **src/components/ui/Card.tsx** - Creative card with unexpected layout
4. **src/app/page.tsx** - Landing page with distinctive aesthetic
5. **src/app/globals.css** - CSS with custom fonts, OKLCH colors, and design tokens

### For ITERATION_FRONTEND phase:
Generate refined versions based on feedback, maintaining the distinctive aesthetic.

${isProductionPhase ? `## Generate production-ready React components with:

1. TypeScript types
2. Framer Motion animations
3. CSS custom properties for colors/spacing
4. Accessibility (aria-* attributes)
5. Responsive design (mobile-first)

Return ALL components as separate code blocks with proper filename markers.` : `## Iterate on components based on feedback:

1. Refine animations for performance
2. Improve accessibility
3. Fix any layout issues
4. Maintain the distinctive aesthetic

Return the updated components.`}

Generate the frontend components now. Each component must have:
- Custom @import font (NOT Inter/Roboto/system)
- OKLCH color CSS variables from design tokens
- Framer Motion animations (or CSS-only for simple elements)
- Distinctive, non-generic layout patterns`;

      const llmResponse = await llmClient.generateCompletion(
        frontendPrompt, 
        undefined, 
        isProductionPhase ? 3 : 2, 
        phase
      );

      // Parse artifacts from response
      const artifacts: Record<string, string> = parseFrontendArtifacts(llmResponse.content, phase);

      return {
        success: true,
        artifacts,
        metadata: {
          phase,
          agent: 'frontend_developer',
          generatedAt: new Date().toISOString(),
          projectName,
          stack
        }
      };
    },

    validateArtifacts(artifacts: Record<string, string>): ValidationResult {
      const results: ValidationIssue[] = [];
      const allContent = Object.values(artifacts).join('\n').toLowerCase();

      // Forbidden patterns (strict mode errors)
      const forbiddenPatterns = [
        { pattern: 'inter', message: 'Forbidden font: Inter detected' },
        { pattern: 'roboto', message: 'Forbidden font: Roboto detected' },
        { pattern: 'system-ui', message: 'Forbidden font: system-ui detected' },
        { pattern: 'arial', message: 'Forbidden font: Arial detected' },
        { pattern: 'purple-gradient', message: 'Forbidden pattern: purple-gradient detected' },
        { pattern: 'linear-gradient(to right, #8b5cf6', message: 'Forbidden pattern: purple gradient detected' },
        { pattern: 'blob background', message: 'Forbidden pattern: blob background detected' },
        { pattern: 'blob', message: 'Suspicious pattern: blob detected (may indicate generic AI design)' },
        { pattern: 'font-family: inter', message: 'Forbidden font-family: Inter detected' },
        { pattern: 'font-family: roboto', message: 'Forbidden font-family: Roboto detected' },
        { pattern: "font-family: 'inter'", message: 'Forbidden font-family: Inter detected' },
        { pattern: 'centered content card', message: 'Generic pattern: centered content card detected' },
        { pattern: 'hero section', message: 'Generic pattern: hero section detected' },
        { pattern: 'gradient text', message: 'Suspicious pattern: gradient text (may indicate generic AI)' },
      ];

      // Required patterns
      const requiredPatterns = [
        { pattern: 'oklch', message: 'Missing OKLCH color format' },
        { pattern: '@import', message: 'Missing custom @import font declaration' },
        { pattern: 'framer-motion', message: 'Missing Framer Motion animations' },
        { pattern: 'var(--', message: 'Missing CSS custom properties' },
        { pattern: 'space grotesk', message: 'Missing distinctive display font (Space Grotesk)' },
        { pattern: 'outfit', message: 'Missing distinctive display font (Outfit)' },
        { pattern: 'syne', message: 'Missing distinctive display font (Syne)' },
        { pattern: 'fraunces', message: 'Missing distinctive display font (Fraunces)' },
        { pattern: 'playfair display', message: 'Missing distinctive display font (Playfair Display)' },
        { pattern: 'dm sans', message: 'Missing refined body font (DM Sans)' },
        { pattern: 'public sans', message: 'Missing refined body font (Public Sans)' },
        { pattern: 'geist', message: 'Missing refined body font (Geist)' },
      ];

      // Check forbidden patterns
      forbiddenPatterns.forEach(({ pattern, message }) => {
        if (allContent.includes(pattern.toLowerCase())) {
          results.push({
            severity: strictMode ? 'error' : 'warning',
            artifactId: 'frontend-components',
            message
          });
        }
      });

      // Check required patterns (only if strict mode or during validation)
      if (strictMode) {
        // Check for any custom font import (at least one)
        const hasCustomFont = requiredPatterns.slice(4, 12).some(p => allContent.includes(p.pattern));
        if (!hasCustomFont) {
          results.push({
            severity: 'error',
            artifactId: 'frontend-components',
            message: 'Missing distinctive custom font (Space Grotesk, Syne, Outfit, Fraunces, or similar)'
          });
        }

        // Check for Framer Motion
        if (!allContent.includes('framer-motion')) {
          results.push({
            severity: 'warning',
            artifactId: 'frontend-components',
            message: 'Missing Framer Motion animations'
          });
        }

        // Check for OKLCH colors
        if (!allContent.includes('oklch')) {
          results.push({
            severity: 'error',
            artifactId: 'frontend-components',
            message: 'Missing OKLCH color format in CSS'
          });
        }

        // Check for CSS custom properties
        if (!allContent.includes('var(--')) {
          results.push({
            severity: 'warning',
            artifactId: 'frontend-components',
            message: 'Missing CSS custom properties (var(--))'
          });
        }
      }

      // Check for generic AI patterns in React components
      const genericPatterns = [
        { regex: /className=".*flex.*center.*"/i, message: 'Generic flex-center pattern detected' },
        { regex: /className=".*w-full.*h-full.*"/i, message: 'Generic full-width/height pattern detected' },
        { regex: /import.*from\s+['"]react['"]/i, message: 'Basic React import (should have motion)' },
      ];

      genericPatterns.forEach(({ regex, message }) => {
        if (regex.test(allContent)) {
          results.push({
            severity: 'warning',
            artifactId: 'frontend-components',
            message
          });
        }
      });

      return {
        canProceed: !results.some(r => r.severity === 'error'),
        issues: results
      };
    }
  };
}

// ============================================================================
// ARTIFACT PARSING HELPERS
// ============================================================================

function parseFrontendArtifacts(content: string, phase: string): Record<string, string> {
  const artifacts: Record<string, string> = {};

  // Pattern: ```tsx filename: path/to/file.tsx ... code ... ```
  const codeBlockRegex = /```(?:tsx|typescript|ts|javascript|js|css)?[ \t]*\n?filename:\s*([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const [, filename, fileContent] = match;
    const cleanFilename = filename.trim();
    artifacts[cleanFilename] = fileContent.trim();
  }

  // If no files extracted, try alternative patterns
  if (Object.keys(artifacts).length === 0) {
    // Try finding .tsx file references
    const tsxFiles = content.match(/filename:\s*([^\s]+\.tsx?)/g);
    if (tsxFiles) {
      tsxFiles.forEach(fileRef => {
        const filename = fileRef.replace('filename:', '').trim();
        const blockStart = content.indexOf(fileRef);
        if (blockStart !== -1) {
          const blockEnd = content.indexOf('```', blockStart + 1);
          if (blockEnd !== -1) {
            const codeStart = content.indexOf('\n', blockStart) + 1;
            artifacts[filename] = content.slice(codeStart, blockEnd).trim();
          }
        }
      });
    }
  }

  // Common frontend files to ensure are present
  const requiredFiles = [
    'src/components/ui/Button.tsx',
    'src/app/page.tsx',
    'src/app/globals.css'
  ];

  for (const requiredFile of requiredFiles) {
    if (!artifacts[requiredFile]) {
      artifacts[requiredFile] = `// Placeholder for ${requiredFile}
// Auto-generated placeholder - to be filled by frontend executor
`;
    }
  }

  return artifacts;
}
