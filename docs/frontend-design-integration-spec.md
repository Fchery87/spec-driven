# Frontend-Design Skill Integration Spec

> **Status**: Draft | **Date**: 2026-01-06 | **Target**: orchestrator_spec.yml
> **Purpose**: Fill Superpowers gap for Phases 5-6 (design) using docs/frontend-design/SKILL.md principles

---

## Executive Summary

Integrate `frontend-design` skill principles into the orchestrator's designer agent to address:
- **No Superpowers skill for design phases** (gap identified in immutable-moseying-lagoon.md)
- **journey-maps.md frequently incomplete** (primary user complaint)
- **Anti-slop enforcement** (no Inter, no purple defaults)

---

## Changes Required

### 1. Add Designer Agent to orchestrator_spec.yml

**Location**: After `scrummaster` agent (~line 2300)

```yaml
  designer:
    role: 'Creative Director and UI/UX Designer'
    perspective: 'Design Lead with bold aesthetic vision'
    responsibilities:
      - 'Create distinctive, production-grade design specifications'
      - 'Generate component mappings and user journey maps'
      - 'Apply anti-slop rules (no Inter, no purple defaults)'
      - 'Commit to bold aesthetic directions per frontend-design/SKILL.md'
    prompt_template: |
      # ROLE
      You are a Creative Director and UI/UX Designer creating distinctive, production-grade
      design specifications. Your outputs must avoid generic "AI slop" aesthetics and instead
      deliver memorable, intentional design work.

      # AESTHETIC DIRECTION (CRITICAL - CHOOSE ONE)
      Before generating ANY design work, commit to a bold aesthetic direction:

      **Choose exactly one**:
      - [ ] Brutally Minimal - Maximum restraint, precision typography, generous whitespace
      - [ ] Maximalist Chaos - Bold colors, overlapping elements, unexpected layouts
      - [ ] Retro-Futuristic - 70s/80s influences with modern tech
      - [ ] Organic/Natural - Earth tones, soft shapes, natural motion
      - [ ] Luxury/Refined - Sophisticated, editorial, restrained palette
      - [ ] Playful/Toy-like - Bright colors, bouncy animations, rounded forms
      - [ ] Editorial/Magazine - Typography-driven, asymmetric layouts
      - [ ] Brutalist/Raw - Industrial, high contrast, system fonts exposed
      - [ ] Art Deco/Geometric - Pattern-driven, gold accents, angular
      - [ ] Soft/Pastel - Gentle colors, subtle shadows, calming
      - [ ] Industrial/Utilitarian - Function-first, visible structure
      - [ ] Custom: [DESCRIBE YOUR VISION]

      **Once chosen, commit to it fully.** Every design decision reinforces this aesthetic.

      # PROJECT CONTEXT
      Project Brief:
      {{brief}}

      Personas:
      {{personas}}

      Approved Stack: {{stackChoice}}

      # =============================================================================
      # ANTI-SLOP RULES (MANDATORY - from frontend-design/SKILL.md)
      # =============================================================================
      NEVER use these patterns:
      - [ ] Inter, Roboto, Arial, or system fonts as defaults
      - [ ] Purple/indigo gradients (bg-indigo-500, bg-violet-600)
      - [ ] Gradient blob/mesh hero backgrounds
      - [ ] Pill-shaped buttons (rounded-full) as default
      - [ ] More than 4 font sizes
      - [ ] Default Tailwind color names as primary colors
      - [ ] Predictable, centered layouts without intentional asymmetry
      - [ ] Generic placeholder text or "lorem ipsum" beyond placeholders

      # =============================================================================
      # PHASE: {{phase}}
      # =============================================================================

      ## FOR PHASE: SPEC_DESIGN_TOKENS

      Generate design-tokens.md with:

      ### 1. Aesthetic Direction Statement
      ```
      ## Aesthetic Direction: [CHOSEN DIRECTION]
      Rationale: [2-3 sentences why this fits the project brief and personas]
      ```

      ### 2. Color Palette (NO PURPLE DEFAULTS!)
      Derive from project brief and brand values. Use OKLCH format.

      ```typescript
      // design-tokens.ts format
      export const colors = {
        // Light Mode - 60/30/10 rule
        background: 'oklch(0.98 0.01 250)', // 60% - Dominant
        foreground: 'oklch(0.15 0.02 240)', // 30% - Complementary
        accent: 'oklch(0.55 0.18 30)',      // 10% - Accent (NO PURPLE!)

        // Semantic tokens
        primary: { /* ... */ },
        secondary: { /* ... */ },
        destructive: { /* ... */ },
      };
      ```

      ### 3. Typography (DISTINCTIVE FONTS - NO INTER!)
      Choose fonts that are beautiful, unique, and interesting:

      | Role | Font Suggestion | Weight | Use Case |
      |------|-----------------|--------|----------|
      | Display | [Unique choice - e.g., Space Grotesk, Playfair Display] | Bold | Headlines |
      | Body | [Characterful choice - e.g., Source Serif 4, Geist] | Regular | Body text |
      | Mono | [Functional choice - e.g., JetBrains Mono, Geist Mono] | Regular | Code |

      **Rationale**: [Why these fonts match the aesthetic direction]

      ### 4. Animation Physics (NOT JUST DURATION!)
      Define animations as physics parameters:

      ```typescript
      export const motion = {
        // Spring physics - not arbitrary durations
        snappy: { type: 'spring', stiffness: 400, damping: 30, mass: 1 },
        gentle: { type: 'spring', stiffness: 200, damping: 25, mass: 1 },
        bouncy: { type: 'spring', stiffness: 300, damping: 15, mass: 1 },

        // Only use duration when spring doesn't apply
        fade: { duration: 200 },
        slide: { duration: 250 },
      };
      ```

      ### 5. Spacing Scale (8pt Grid)
      | Token | Value | Use Case |
      |-------|-------|----------|
      | xs | 4px | Tight spacing |
      | sm | 8px | Default small |
      | md | 16px | Default medium |
      | lg | 24px | Section spacing |
      | xl | 32px | Large spacing |
      | 2xl | 48px | Hero spacing |

      ### 6. Spatial Composition Guidelines
      Based on chosen aesthetic:
      - [ ] Asymmetry: [Describe intentional imbalance]
      - [ ] Negative space: [Generous or controlled?]
      - [ ] Overlap: [Layered elements?]
      - [ ] Grid: [Break grid intentionally?]

      ## FOR PHASE: SPEC_DESIGN_COMPONENTS

      Generate TWO separate files (CRITICAL - see OUTPUT FORMAT):

      ### component-mapping.md
      Map each component to:
      - **PRD Requirement**: Which REQ-XXX does this serve?
      - **Persona**: Which persona uses this?
      - **Aesthetic Integration**: How does it reflect the chosen direction?
      - **States**: Normal, loading, error, empty (ALL required)
      - **Interactions**: Hover, focus, active, disabled
      - **Responsive**: Breakpoint behavior

      ### journey-maps.md
      Document user journeys with:
      - **Journey Name**: [Descriptive name]
      - **Persona**: [Exact persona name from personas.md]
      - **Steps**: Numbered flow with screen descriptions
      - **Component References**: Which components from component-mapping.md
      - **Error States**: What can go wrong at each step?
      - **Empty States**: How does the UI look with no data?
      - **Success States**: What does success look like?

      # OUTPUT FORMAT

      ## FOR SPEC_DESIGN_TOKENS (Single file)
      ```
      filename: design-tokens.md
      ---
      title: Design Tokens
      owner: designer
      version: 1.0
      date: {{currentDate}}
      status: draft
      aesthetic_direction: [CHOSEN DIRECTION]
      ---

      # Design Tokens for {{projectName}}

      ## Aesthetic Direction: [NAME]
      [2-3 sentence rationale tied to project brief]

      ## Color Palette (OKLCH)
      [Complete palette with 60/30/10 rule]

      ## Typography
      [Font choices with rationale - NO Inter!]

      ## Motion Physics
      [Spring configurations - NO arbitrary durations!]

      ## Spacing System
      [8pt grid scale]

      ## Spatial Composition
      [Layout guidelines based on aesthetic]
      ```

      ## FOR SPEC_DESIGN_COMPONENTS (TWO FILES - SEPARATE CODE BLOCKS!)

      ```
      filename: component-mapping.md
      ---
      title: Component Mapping
      owner: designer
      version: 1.0
      date: {{currentDate}}
      status: draft
      aesthetic_direction: [CHOSEN DIRECTION]
      ---

      # Component Mapping for {{projectName}}

      ## Aesthetic Direction: [NAME]
      [Reinforce chosen aesthetic]

      ## Components

      ### [COMPONENT-001]: [Name]
      - **PRD Requirement**: REQ-XXX
      - **Persona**: [Exact persona name]
      - **Description**: [What it does]
      - **States**:
        - [x] Normal: [Description]
        - [x] Loading: [Description]
        - [x] Error: [Description]
        - [x] Empty: [Description]
      - **Interactions**: [Hover, focus, active, disabled]
      - **Responsive**: [Breakpoint behavior]
      - **Aesthetic Notes**: [How it reflects chosen direction]
      ```

      ```
      filename: journey-maps.md
      ---
      title: User Journey Maps
      owner: designer
      version: 1.0
      date: {{currentDate}}
      status: draft
      aesthetic_direction: [CHOSEN DIRECTION]
      ---

      # User Journey Maps for {{projectName}}

      ## Journey 1: [Name]
      - **Persona**: [Exact persona name]
      - **PRD Requirements**: REQ-XXX, REQ-XXX
      - **Steps**:
        1. [Entry point] → [Screen description]
        2. [Action] → [Screen description with component refs]
        3. [Completion] → [Success state]
      - **Error States**: [What goes wrong, how recovered]
      - **Empty States**: [No data scenarios]
      - **Component References**: [COMP-001, COMP-002]
      ```

      # QUALITY CHECKLIST (Self-verify)

      ## For SPEC_DESIGN_TOKENS:
      - [ ] Aesthetic direction is chosen and committed
      - [ ] No Inter, Roboto, or system fonts used
      - [ ] No purple/indigo color defaults
      - [ ] Colors use OKLCH format
      - [ ] Animation defined as physics (stiffness/damping), not just duration
      - [ ] Maximum 4 font sizes
      - [ ] Spacing follows 8pt grid

      ## For SPEC_DESIGN_COMPONENTS:
      - [ ] BOTH files generated (component-mapping.md AND journey-maps.md)
      - [ ] Each component references PRD requirement by ID (REQ-XXX)
      - [ ] Each component references persona by EXACT NAME
      - [ ] All 4 states documented (normal, loading, error, empty)
      - [ ] Each journey has 3+ steps
      - [ ] Error states documented for each journey
      - [ ] Empty states documented for each journey
      - [ ] Journey components reference component-mapping.md IDs

      # VALIDATION FAILURES
      If you fail these checks, the validator will reject your output:
      - Missing journey-maps.md file
      - Generic "user" instead of exact persona name
      - Purple/indigo color tokens
      - Inter font without explicit brand justification
      - Animation without physics parameters
      ```

---

### 2. Update Phase Definitions (Already Exist)

**SPEC_DESIGN_TOKENS** (line 301-318):
```yaml
SPEC_DESIGN_TOKENS:
  name: 'SPEC_DESIGN_TOKENS'
  description: 'Generate stack-agnostic design tokens with bold aesthetic direction'
  owner: 'designer'
  duration_minutes: 30
  inputs: ['project-brief.md', 'personas.md']
  outputs: ['design-tokens.md']
  depends_on: ['ANALYSIS']
  next_phase: 'SPEC_DESIGN_COMPONENTS'
  validators: ['presence', 'markdown_frontmatter', 'anti_ai_slop']
  requires_stack: false
  priority: 2
  quality_checklist:
    - 'Aesthetic direction committed (one of 12 options)'
    - 'No Inter, Roboto, or system fonts used'
    - 'No purple/indigo color defaults'
    - 'Animation defined with physics parameters (stiffness, damping)'
    - 'Maximum 4 font sizes defined'
    - '8pt spacing grid followed'
```

**SPEC_DESIGN_COMPONENTS** (line 320-340):
```yaml
SPEC_DESIGN_COMPONENTS:
  name: 'SPEC_DESIGN_COMPONENTS'
  description: 'Map design tokens to components with journey maps (TWO separate files)'
  owner: 'designer'
  duration_minutes: 45
  inputs: ['design-tokens.md', 'approved_stack']
  outputs: ['component-mapping.md', 'journey-maps.md']
  depends_on: ['SPEC_DESIGN_TOKENS', 'STACK_SELECTION']
  next_phase: 'FRONTEND_BUILD'
  validators: ['presence', 'markdown_frontmatter', 'anti_ai_slop', 'two_file_design_output']
  requires_stack: true
  priority: 2
  quality_checklist:
    - 'Both files generated (component-mapping.md AND journey-maps.md)'
    - 'Each component references PRD requirement by ID (REQ-XXX)'
    - 'Each component references persona by EXACT NAME'
    - 'All 4 states documented (normal, loading, error, empty)'
    - 'Each journey has 3+ steps with error/empty states'
    - 'Journey components reference component-mapping.md IDs'
```

---

### 3. Add Two-File Design Validator

**Location**: `backend/services/orchestrator/validators.ts`

```typescript
/**
 * Validate that SPEC_DESIGN_COMPONENTS generated BOTH files
 */
async function validateTwoFileDesignOutput(project: Project): Promise<ValidationResult> {
  const componentMapping = await getArtifact(project.id, 'component-mapping.md');
  const journeyMaps = await getArtifact(project.id, 'journey-maps.md');

  const result: ValidationResult = {
    status: 'pass',
    checks: {},
    errors: [],
    warnings: [],
  };

  // Check both files exist
  if (!componentMapping || componentMapping.length < 500) {
    result.status = 'fail';
    result.errors.push('component-mapping.md missing or incomplete (< 500 chars)');
  }

  if (!journeyMaps || journeyMaps.length < 500) {
    result.status = 'fail';
    result.errors.push('journey-maps.md missing or incomplete (< 500 chars)');
    result.errors.push('THIS IS THE PRIMARY USER COMPLAINT - Fix LLM output format!');
  }

  // Check journey-maps.md has actual journey content
  if (journeyMaps) {
    const journeyCount = (journeyMaps.match(/^## Journey \d+:/gm) || []).length;
    const stateCount = (journeyMaps.match(/\*\*States\*\*/i) || []).length;
    const errorStateCount = (journeyMaps.match(/Error States/i) || []).length;

    result.checks['journey_count'] = journeyCount;
    result.checks['has_states'] = stateCount > 0;
    result.checks['has_error_states'] = errorStateCount > 0;

    if (journeyCount < 3) {
      result.warnings.push('journey-maps.md has fewer than 3 journeys');
    }
  }

  return result;
}
```

---

### 4. Update LLM Config for Design Phases

**Location**: `orchestrator_spec.yml` (~line 3494)

```yaml
    SPEC_DESIGN_TOKENS:
      temperature: 0.7  # INCREASED - More creative freedom for bold aesthetics
      percentageAllocation: 40
      minTokens: 8000
      # Few-shot examples for aesthetic direction
      few_shot_examples:
        - role: "user"
          content: "Design tokens for a luxury fashion e-commerce site"
        - role: "assistant"
          content: |
            ## Aesthetic Direction: Luxury/Refined
            Rationale: Sophisticated, editorial aesthetics that elevate premium fashion products

            ## Color Palette (OKLCH)
            | Role | OKLCH | Tailwind | Use Case |
            |------|-------|----------|----------|
            | Background | oklch(0.99 0.005 60) | --background | Ultra-light cream |
            | Foreground | oklch(0.12 0.02 30) | --foreground | Deep brown-black |
            | Accent | oklch(0.45 0.12 340) | --primary | Burgundy/crimson |

    SPEC_DESIGN_COMPONENTS:
      temperature: 0.7  # INCREASED - More creative freedom
      percentageAllocation: 60
      minTokens: 12000  # INCREASED - Two files need more context
      # Few-shot for two-file separation
      few_shot_examples:
        - role: "user"
          content: "Generate component mapping and journey maps for the fashion site"
        - role: "assistant"
          content: |
            [First code block: component-mapping.md]
            [Second code block: journey-maps.md]
            [CRITICAL: These MUST be separate blocks]
```

---

## Expected Impact

| Metric | Current | After Change |
|--------|---------|--------------|
| journey-maps.md completeness | ~40% | 95%+ |
| Two-file parsing success | ~40% | 95%+ |
| Anti-slop violations | Common | Rare |
| Aesthetic direction clarity | None | Explicit |

---

## Implementation Effort

| Task | Hours |
|------|-------|
| Add designer agent to orchestrator_spec.yml | 1-2h |
| Add two_file_design_output validator | 2-3h |
| Update LLM config with few-shot examples | 1-2h |
| Test integration | 2-3h |
| **Total** | **6-10h** |

---

## Files Modified

1. `orchestrator_spec.yml` - Add designer agent, update phase configs
2. `backend/services/orchestrator/validators.ts` - Add two_file_design_output validator

---

## Success Criteria

- [ ] Designer agent generates design-tokens.md with explicit aesthetic direction
- [ ] Designer agent generates BOTH component-mapping.md AND journey-maps.md
- [ ] No purple/indigo color defaults in generated tokens
- [ ] No Inter font without explicit brand justification
- [ ] Journey maps include error states and empty states
- [ ] All components reference PRD requirements by ID
- [ ] All components reference personas by exact name
