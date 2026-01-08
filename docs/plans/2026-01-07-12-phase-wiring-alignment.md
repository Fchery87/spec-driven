# 12-Phase Wiring Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the 12-phase workflow across spec, backend, frontend, and docs so phase order/outputs/validators are consistent and enforced.

**Architecture:** Use a shared, code-level phase map that mirrors `orchestrator_spec.yml` outputs; update all hard-coded lists to import it. Keep legacy `SPEC` support in backend where explicitly required.

**Tech Stack:** Next.js 14, TypeScript, Vitest, Node.js backend services.

### Task 1: Add a shared phase outputs map and use it in frontend/APIs

**Files:**
- Create: `src/lib/phase-outputs.ts`
- Modify: `src/lib/config.ts`
- Modify: `src/utils/phase-status.ts`
- Modify: `src/app/api/projects/[slug]/phase/route.ts`
- Modify: `src/app/api/projects/[slug]/execute-phase/route.ts`
- Modify: `src/app/api/projects/[slug]/revert-phase/route.ts`
- Modify: `src/app/project/[slug]/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/admin/projects/page.tsx`
- Test: `src/lib/phase-outputs.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/phase-outputs.test.ts
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { PHASE_OUTPUTS, PHASES } from '@/lib/phase-outputs';

describe('phase outputs alignment', () => {
  it('matches orchestrator_spec.yml outputs for the 12 phases', () => {
    const raw = readFileSync('orchestrator_spec.yml', 'utf8');
    const spec = yaml.load(raw) as { phases: Record<string, { outputs?: string[] }> };

    const specOutputs = Object.fromEntries(
      Object.entries(spec.phases)
        .filter(([phase]) => PHASES.includes(phase))
        .map(([phase, cfg]) => [phase, cfg.outputs ?? []])
    );

    expect(specOutputs).toEqual(PHASE_OUTPUTS);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/phase-outputs.test.ts`
Expected: FAIL with output mismatch (AUTO_REMEDY outputs, SPEC_ARCHITECT missing architecture-decisions, FRONTEND_BUILD output paths).

**Step 3: Write minimal implementation**

```ts
// src/lib/phase-outputs.ts
export const PHASE_OUTPUTS = {
  ANALYSIS: [
    'constitution.md',
    'project-brief.md',
    'project-classification.json',
    'personas.md',
  ],
  STACK_SELECTION: [
    'stack-analysis.md',
    'stack-decision.md',
    'stack-rationale.md',
    'stack.json',
  ],
  SPEC_PM: ['PRD.md'],
  SPEC_ARCHITECT: ['data-model.md', 'api-spec.json', 'architecture-decisions.md'],
  SPEC_DESIGN_TOKENS: ['design-tokens.md'],
  SPEC_DESIGN_COMPONENTS: ['component-mapping.md', 'journey-maps.md'],
  FRONTEND_BUILD: [
    'components/ui/button.tsx',
    'components/ui/card.tsx',
    'components/ui/input.tsx',
    'components/ui/badge.tsx',
    'components/ui/dialog.tsx',
    'components/ui/dropdown-menu.tsx',
    'components/ui/tabs.tsx',
    'components/ui/select.tsx',
    'components/ui/textarea.tsx',
    'components/ui/form.tsx',
    'components/ui/alert.tsx',
    'components/ui/toast.tsx',
    'lib/motion.ts',
  ],
  DEPENDENCIES: ['DEPENDENCIES.md', 'dependencies.json'],
  SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
  VALIDATE: ['validation-report.md', 'coverage-matrix.md'],
  AUTO_REMEDY: ['remediation-report.md'],
  DONE: ['README.md', 'HANDOFF.md', 'project.zip'],
} as const;

export const PHASES = Object.keys(PHASE_OUTPUTS) as Array<keyof typeof PHASE_OUTPUTS>;
```

```ts
// src/lib/config.ts
import { PHASE_OUTPUTS, PHASES } from '@/lib/phase-outputs';

export const PHASE_CONFIG = {
  phases: PHASES,
  requiredFiles: PHASE_OUTPUTS,
} as const;
```

```ts
// src/utils/phase-status.ts
import { PHASE_OUTPUTS, PHASES } from '@/lib/phase-outputs';

const REQUIRED_ARTIFACTS: Record<string, string[]> = PHASE_OUTPUTS;
```

```ts
// src/app/api/projects/[slug]/phase/route.ts
import { PHASE_OUTPUTS, PHASES } from '@/lib/phase-outputs';

const getPhaseOutputs = (phase: string): string[] =>
  (PHASE_OUTPUTS as Record<string, string[]>)[phase] || [];
```

```ts
// src/app/api/projects/[slug]/execute-phase/route.ts
import { PHASES } from '@/lib/phase-outputs';

const allPhases = [...PHASES];
```

```ts
// src/app/api/projects/[slug]/revert-phase/route.ts
import { PHASES } from '@/lib/phase-outputs';

const PHASE_ORDER = [...PHASES];
```

```ts
// src/app/project/[slug]/page.tsx
import { PHASES } from '@/lib/phase-outputs';
```

```ts
// src/app/dashboard/page.tsx
import { PHASES } from '@/lib/phase-outputs';
```

```ts
// src/app/admin/projects/page.tsx
import { PHASES } from '@/lib/phase-outputs';
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/phase-outputs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/phase-outputs.ts src/lib/phase-outputs.test.ts src/lib/config.ts src/utils/phase-status.ts src/app/api/projects/[slug]/phase/route.ts src/app/api/projects/[slug]/execute-phase/route.ts src/app/api/projects/[slug]/revert-phase/route.ts src/app/project/[slug]/page.tsx src/app/dashboard/page.tsx src/app/admin/projects/page.tsx
git commit -m "refactor(phases): centralize phase outputs and lists"
```

### Task 2: Align backend phase maps with the 12-phase workflow

**Files:**
- Modify: `backend/services/orchestrator/root_cause_analyzer.ts`
- Modify: `backend/services/orchestrator/orchestrator_engine.ts`
- Modify: `backend/services/orchestrator/artifact_manager.ts`
- Modify: `backend/services/orchestrator/inline_validation.ts`
- Modify: `backend/lib/migration_helper.ts`
- Test: `backend/services/orchestrator/phase-maps.test.ts`

**Step 1: Write the failing test**

```ts
// backend/services/orchestrator/phase-maps.test.ts
import { describe, it, expect } from 'vitest';
import { getPhaseArtifactMap } from './root_cause_analyzer';
import { getArtifactPhaseMap } from './artifact_manager';

// Expose the maps via tiny getters for testing.

describe('phase map alignment', () => {
  it('includes SPEC_ARCHITECT architecture-decisions and new design phases', () => {
    const phaseMap = getPhaseArtifactMap();
    expect(phaseMap.SPEC_ARCHITECT).toContain('architecture-decisions.md');
    expect(phaseMap.SPEC_DESIGN_TOKENS).toContain('design-tokens.md');
    expect(phaseMap.SPEC_DESIGN_COMPONENTS).toContain('component-mapping.md');
  });

  it('maps architecture-decisions.md to SPEC_ARCHITECT', () => {
    const artifactMap = getArtifactPhaseMap();
    expect(artifactMap['architecture-decisions.md']).toBe('SPEC_ARCHITECT');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- backend/services/orchestrator/phase-maps.test.ts`
Expected: FAIL with missing mappings.

**Step 3: Write minimal implementation**

```ts
// backend/services/orchestrator/root_cause_analyzer.ts
export const getPhaseArtifactMap = () => ({
  STACK_SELECTION: ['stack.json'],
  SPEC_PM: ['PRD.md'],
  SPEC_ARCHITECT: ['api-spec.json', 'data-model.md', 'architecture-decisions.md'],
  SPEC_DESIGN_TOKENS: ['design-tokens.md'],
  SPEC_DESIGN_COMPONENTS: ['component-mapping.md', 'journey-maps.md'],
  FRONTEND_BUILD: ['components/ui/', 'lib/motion.ts'],
});

const PHASE_ARTIFACT_MAP = getPhaseArtifactMap();

const ERROR_TO_PHASE_MAP: Record<ErrorType, string[]> = {
  parsing: ['SPEC_PM', 'SPEC_ARCHITECT', 'SPEC_DESIGN_TOKENS', 'SPEC_DESIGN_COMPONENTS', 'FRONTEND_BUILD'],
  missing_file: ['SPEC_PM', 'SPEC_ARCHITECT', 'SPEC_DESIGN_TOKENS', 'SPEC_DESIGN_COMPONENTS', 'STACK_SELECTION'],
  content_quality: ['SPEC_PM', 'SPEC_ARCHITECT', 'SPEC_DESIGN_TOKENS', 'SPEC_DESIGN_COMPONENTS'],
  constitutional: ['STACK_SELECTION', 'SPEC_PM', 'SPEC_ARCHITECT'],
  unknown: ['VALIDATE'],
};
```

```ts
// backend/services/orchestrator/artifact_manager.ts
export const getArtifactPhaseMap = () => ({
  // ...existing entries...
  'architecture-decisions.md': 'SPEC_ARCHITECT',
});

const artifactPhases: Record<string, string> = {
  ...getArtifactPhaseMap(),
};
```

```ts
// backend/services/orchestrator/inline_validation.ts
const required = [
  'project-brief.md',
  'constitution.md',
  'project-classification.json',
  'personas.md',
];

const clarificationPattern = /\[NEEDS CLARIFICATION:([^\]]+)\]/gi;
```

```ts
// backend/services/orchestrator/orchestrator_engine.ts
const parallelGroups: ParallelGroup[] = [
  { name: 'foundation', type: 'parallel', phases: ['ANALYSIS'] },
  { name: 'stack_and_tokens', type: 'parallel', phases: ['STACK_SELECTION', 'SPEC_DESIGN_TOKENS'] },
  { name: 'requirements', type: 'parallel', phases: ['SPEC_PM'] },
  { name: 'architecture_and_design', type: 'parallel', phases: ['SPEC_ARCHITECT', 'SPEC_DESIGN_COMPONENTS'] },
  { name: 'frontend_build', type: 'parallel', phases: ['FRONTEND_BUILD'] },
  { name: 'dependencies', type: 'parallel', phases: ['DEPENDENCIES'] },
  { name: 'solutioning', type: 'parallel', phases: ['SOLUTIONING'] },
];

const groupDependencies: Record<string, string[]> = {
  foundation: [],
  stack_and_tokens: ['ANALYSIS'],
  requirements: ['STACK_SELECTION'],
  architecture_and_design: ['SPEC_PM', 'SPEC_DESIGN_TOKENS'],
  frontend_build: ['SPEC_DESIGN_COMPONENTS'],
  dependencies: ['SPEC_ARCHITECT', 'FRONTEND_BUILD'],
  solutioning: ['DEPENDENCIES'],
};
```

```ts
// backend/lib/migration_helper.ts
const allPhases = [
  'ANALYSIS',
  'STACK_SELECTION',
  'SPEC_PM',
  'SPEC_ARCHITECT',
  'SPEC_DESIGN_TOKENS',
  'SPEC_DESIGN_COMPONENTS',
  'FRONTEND_BUILD',
  'DEPENDENCIES',
  'SOLUTIONING',
  'VALIDATE',
  'AUTO_REMEDY',
  'DONE',
  'SPEC', // legacy
];
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- backend/services/orchestrator/phase-maps.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/services/orchestrator/root_cause_analyzer.ts backend/services/orchestrator/artifact_manager.ts backend/services/orchestrator/inline_validation.ts backend/services/orchestrator/orchestrator_engine.ts backend/lib/migration_helper.ts backend/services/orchestrator/phase-maps.test.ts
git commit -m "fix(orchestrator): align backend phase maps with 12-phase spec"
```

### Task 3: Align spec and docs for AUTO_REMEDY + design outputs

**Files:**
- Modify: `orchestrator_spec.yml`
- Modify: `docs/USAGE_GUIDE.md`
- Test: `src/lib/phase-outputs.test.ts`

**Step 1: Write the failing test**

Use the existing `src/lib/phase-outputs.test.ts` from Task 1 (already failing).

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/phase-outputs.test.ts`
Expected: FAIL (AUTO_REMEDY outputs mismatch, spec outputs for design phases vs docs).

**Step 3: Write minimal implementation**

```yaml
# orchestrator_spec.yml (AUTO_REMEDY outputs)
AUTO_REMEDY:
  outputs: ['remediation-report.md']
```

```markdown
<!-- docs/USAGE_GUIDE.md outputs table -->
| SPEC_ARCHITECT         | Review technical architecture specs                      | data-model.md, api-spec.json, architecture-decisions.md  |
| SPEC_DESIGN_TOKENS     | Review brand colors, fonts, and motion tokens            | design-tokens.md                                         |
| SPEC_DESIGN_COMPONENTS | Review component mapping and user flows                  | component-mapping.md, journey-maps.md                    |
| FRONTEND_BUILD         | Monitor codebase generation                              | components/ui/*.tsx, lib/motion.ts                       |
| AUTO_REMEDY            | Review AI-generated fixes for validation failures        | remediation-report.md                                   |
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/phase-outputs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add orchestrator_spec.yml docs/USAGE_GUIDE.md
git commit -m "docs(spec): align AUTO_REMEDY and design outputs with implementation"
```
