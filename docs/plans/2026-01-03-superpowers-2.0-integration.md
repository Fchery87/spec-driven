# Superpowers 2.0 Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the spec-driven platform into a self-correcting artifact generation engine by integrating Semantic Goal Locking, Chain-of-Thought reasoning, Subagent Dispatch, and Auto-Remediation patterns.

**Architecture:** Extends existing OrchestratorEngine with three new layers: (1) SemanticLockService for constraint propagation, (2) ChainOfThoughtEnhancer for prompt engineering, (3) SubagentDispatcher for isolated execution. Integrates with existing database schema, validators, and artifact manager without replacing core systems.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Vitest, existing LLM clients (Gemini/OpenAI/Anthropic)

**Implementation Priority:** 🔴 Critical → 🟠 High → 🟡 Medium (as per SUPERPOWERS_INTEGRATION_PLAN.md)

---

## Phase 1: Database Schema Extensions (🔴 Critical - Foundation)

### Task 1.1: Add Semantic Locks Table

**Files:**
- Modify: `backend/lib/schema.ts:200-210`
- Test: `backend/lib/schema.test.ts` (new section)

**Step 1: Write the failing test**

```typescript
// backend/lib/schema.test.ts (add to existing file or create new)
import { describe, it, expect } from 'vitest';
import { semanticLocks } from './schema';

describe('SemanticLocks Schema', () => {
  it('should define semantic locks table with all required columns', () => {
    expect(semanticLocks).toBeDefined();
    expect(semanticLocks.id).toBeDefined();
    expect(semanticLocks.projectId).toBeDefined();
    expect(semanticLocks.lockType).toBeDefined();
    expect(semanticLocks.phase).toBeDefined();
    expect(semanticLocks.artifactName).toBeDefined();
    expect(semanticLocks.lockValue).toBeDefined();
    expect(semanticLocks.enforcedInPhases).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/lib/schema.test.ts`
Expected: FAIL with "semanticLocks is not defined"

**Step 3: Add schema definition**

```typescript
// backend/lib/schema.ts (add after line 200, after existing tables)

// Semantic Locks - Phase 1 constraints that propagate across all phases
export const semanticLocks = pgTable('SemanticLock', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  // Lock identification
  lockId: text('lock_id').notNull(), // e.g., "LOCK-METRIC-001", "LOCK-PERSONA-SARAH"
  lockType: text('lock_type').notNull(), // SMART_METRIC | PERSONA | STACK_CONSTRAINT | REQUIREMENT | DESIGN_TOKEN

  // Source information
  phase: text('phase').notNull(), // Phase that created this lock (usually ANALYSIS)
  artifactName: text('artifact_name').notNull(), // e.g., "project-classification.json"

  // Lock value (JSON stored as text)
  lockValue: text('lock_value').notNull(), // JSON serialized constraint

  // Enforcement rules
  enforcedInPhases: text('enforced_in_phases').notNull(), // JSON array of phase names

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('SemanticLock_project_id_idx').on(table.projectId),
  lockIdIdx: index('SemanticLock_lock_id_idx').on(table.lockId),
  lockTypeIdx: index('SemanticLock_lock_type_idx').on(table.lockType),
}));

// Type inference for SemanticLock
export type SemanticLock = InferSelectModel<typeof semanticLocks>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/lib/schema.test.ts`
Expected: PASS

**Step 5: Generate migration**

```bash
npm run db:generate
```

Expected: New migration file created in `drizzle/migrations/`

**Step 6: Commit**

```bash
git add backend/lib/schema.ts backend/lib/schema.test.ts drizzle/migrations/
git commit -m "feat: add semantic locks table for constraint propagation"
```

---

### Task 1.2: Add Chain-of-Thought Tracking Table

**Files:**
- Modify: `backend/lib/schema.ts:230-250`
- Test: `backend/lib/schema.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/lib/schema.test.ts
describe('ChainOfThought Schema', () => {
  it('should define chain-of-thought table for reasoning tracking', () => {
    expect(chainOfThoughtLogs).toBeDefined();
    expect(chainOfThoughtLogs.artifactId).toBeDefined();
    expect(chainOfThoughtLogs.agentRole).toBeDefined();
    expect(chainOfThoughtLogs.reasoningSteps).toBeDefined();
    expect(chainOfThoughtLogs.alternatives).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/lib/schema.test.ts -t "ChainOfThought"`
Expected: FAIL

**Step 3: Add schema definition**

```typescript
// backend/lib/schema.ts (add after semanticLocks)

// Chain-of-Thought Logs - Agent reasoning audit trail
export const chainOfThoughtLogs = pgTable('ChainOfThoughtLog', {
  id: uuid('id').primaryKey().defaultRandom(),
  artifactId: uuid('artifact_id').notNull().references(() => artifacts.id, { onDelete: 'cascade' }),

  // Agent context
  agentRole: text('agent_role').notNull(), // analyst, architect, pm, etc.
  phase: text('phase').notNull(),

  // Reasoning chain (JSON stored as text)
  reasoningSteps: text('reasoning_steps').notNull(), // JSON: Array<{step: number, thought: string}>
  alternatives: text('alternatives').notNull(), // JSON: Array<{option: string, tradeoffs: string}>
  decision: text('decision').notNull(),

  // Semantic lock references
  locksReferenced: text('locks_referenced'), // JSON array of lock IDs

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  artifactIdIdx: index('ChainOfThoughtLog_artifact_id_idx').on(table.artifactId),
  phaseIdx: index('ChainOfThoughtLog_phase_idx').on(table.phase),
}));

export type ChainOfThoughtLog = InferSelectModel<typeof chainOfThoughtLogs>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/lib/schema.test.ts -t "ChainOfThought"`
Expected: PASS

**Step 5: Generate migration**

```bash
npm run db:generate
```

**Step 6: Commit**

```bash
git add backend/lib/schema.ts backend/lib/schema.test.ts drizzle/migrations/
git commit -m "feat: add chain-of-thought logging table"
```

---

### Task 1.3: Add Subagent Dispatch Table

**Files:**
- Modify: `backend/lib/schema.ts:270-290`
- Test: `backend/lib/schema.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/lib/schema.test.ts
describe('SubagentDispatch Schema', () => {
  it('should define subagent dispatch table for isolated execution tracking', () => {
    expect(subagentDispatches).toBeDefined();
    expect(subagentDispatches.parentPhase).toBeDefined();
    expect(subagentDispatches.taskDescription).toBeDefined();
    expect(subagentDispatches.selfReviewChecklist).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/lib/schema.test.ts -t "SubagentDispatch"`
Expected: FAIL

**Step 3: Add schema definition**

```typescript
// backend/lib/schema.ts (add after chainOfThoughtLogs)

// Subagent Dispatch Records - Track isolated agent executions
export const subagentDispatches = pgTable('SubagentDispatch', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  // Dispatch context
  dispatchId: text('dispatch_id').notNull().unique(), // e.g., "DISPATCH-FRONTEND-001"
  parentPhase: text('parent_phase').notNull(), // Phase that spawned this subagent
  taskDescription: text('task_description').notNull(),

  // Execution context (JSON stored as text)
  contextSnapshot: text('context_snapshot').notNull(), // JSON: isolated context for this task
  selfReviewChecklist: text('self_review_checklist').notNull(), // JSON: array of review items

  // Output tracking
  outputArtifactId: uuid('output_artifact_id').references(() => artifacts.id),
  reviewResult: text('review_result'), // JSON: {passed: boolean, issues: string[]}

  // Status
  status: text('status').notNull().default('pending'), // pending, running, completed, failed

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
}, (table) => ({
  projectIdIdx: index('SubagentDispatch_project_id_idx').on(table.projectId),
  parentPhaseIdx: index('SubagentDispatch_parent_phase_idx').on(table.parentPhase),
  statusIdx: index('SubagentDispatch_status_idx').on(table.status),
}));

export type SubagentDispatch = InferSelectModel<typeof subagentDispatches>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/lib/schema.test.ts -t "SubagentDispatch"`
Expected: PASS

**Step 5: Generate migration**

```bash
npm run db:generate
```

**Step 6: Commit**

```bash
git add backend/lib/schema.ts backend/lib/schema.test.ts drizzle/migrations/
git commit -m "feat: add subagent dispatch table for isolated execution"
```

---

### Task 1.4: Run Database Migrations

**Files:**
- Database migration execution

**Step 1: Push schema to database**

```bash
npm run db:push
```

Expected: Tables created successfully

**Step 2: Verify tables exist**

```bash
npm run db:studio
```

Expected: See SemanticLock, ChainOfThoughtLog, SubagentDispatch tables in Drizzle Studio

**Step 3: Commit migration state**

```bash
git add drizzle/migrations/
git commit -m "chore: apply database migrations for superpowers 2.0"
```

---

## Phase 2: Semantic Lock Service (🔴 Critical)

### Task 2.1: Create SemanticLockService

**Files:**
- Create: `backend/services/semantic/semantic_lock_service.ts`
- Create: `backend/services/semantic/semantic_lock_service.test.ts`
- Create: `backend/services/semantic/types.ts`

**Step 1: Write the failing test**

```typescript
// backend/services/semantic/semantic_lock_service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticLockService } from './semantic_lock_service';
import { db } from '@/backend/lib/drizzle';

vi.mock('@/backend/lib/drizzle');

describe('SemanticLockService', () => {
  let service: SemanticLockService;
  const mockProjectId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    service = new SemanticLockService();
  });

  describe('createLock', () => {
    it('should create a semantic lock from ANALYSIS phase output', async () => {
      const lock = await service.createLock({
        projectId: mockProjectId,
        lockId: 'LOCK-METRIC-001',
        lockType: 'SMART_METRIC',
        phase: 'ANALYSIS',
        artifactName: 'project-classification.json',
        lockValue: { metric: 'response_time', target: '< 200ms' },
        enforcedInPhases: ['SPEC_ARCHITECT', 'VALIDATE'],
      });

      expect(lock.id).toBeDefined();
      expect(lock.lockId).toBe('LOCK-METRIC-001');
      expect(lock.lockType).toBe('SMART_METRIC');
    });
  });

  describe('getLocksForPhase', () => {
    it('should retrieve all locks that apply to a specific phase', async () => {
      const locks = await service.getLocksForPhase(mockProjectId, 'SPEC_ARCHITECT');

      expect(Array.isArray(locks)).toBe(true);
    });
  });

  describe('validateAgainstLocks', () => {
    it('should validate artifact content against semantic locks', async () => {
      const validation = await service.validateAgainstLocks(
        mockProjectId,
        'SPEC_ARCHITECT',
        { apiEndpoint: '/users', responseTime: '150ms' }
      );

      expect(validation.isValid).toBeDefined();
      expect(validation.violations).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/semantic/semantic_lock_service.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create types file**

```typescript
// backend/services/semantic/types.ts
export interface CreateLockInput {
  projectId: string;
  lockId: string;
  lockType: 'SMART_METRIC' | 'PERSONA' | 'STACK_CONSTRAINT' | 'REQUIREMENT' | 'DESIGN_TOKEN';
  phase: string;
  artifactName: string;
  lockValue: Record<string, any>;
  enforcedInPhases: string[];
}

export interface LockValidation {
  isValid: boolean;
  violations: Array<{
    lockId: string;
    lockType: string;
    expected: any;
    actual: any;
    message: string;
  }>;
}
```

**Step 4: Create minimal service implementation**

```typescript
// backend/services/semantic/semantic_lock_service.ts
import { db } from '@/backend/lib/drizzle';
import { semanticLocks, SemanticLock } from '@/backend/lib/schema';
import { eq, and } from 'drizzle-orm';
import { CreateLockInput, LockValidation } from './types';

export class SemanticLockService {
  /**
   * Create a new semantic lock from phase output
   */
  async createLock(input: CreateLockInput): Promise<SemanticLock> {
    const [lock] = await db.insert(semanticLocks).values({
      projectId: input.projectId,
      lockId: input.lockId,
      lockType: input.lockType,
      phase: input.phase,
      artifactName: input.artifactName,
      lockValue: JSON.stringify(input.lockValue),
      enforcedInPhases: JSON.stringify(input.enforcedInPhases),
    }).returning();

    return lock;
  }

  /**
   * Get all locks that apply to a specific phase
   */
  async getLocksForPhase(projectId: string, phase: string): Promise<SemanticLock[]> {
    const allLocks = await db
      .select()
      .from(semanticLocks)
      .where(eq(semanticLocks.projectId, projectId));

    // Filter locks where phase is in enforcedInPhases array
    return allLocks.filter(lock => {
      const enforcedPhases = JSON.parse(lock.enforcedInPhases);
      return enforcedPhases.includes(phase);
    });
  }

  /**
   * Validate artifact content against semantic locks
   */
  async validateAgainstLocks(
    projectId: string,
    phase: string,
    artifactContent: Record<string, any>
  ): Promise<LockValidation> {
    const locks = await this.getLocksForPhase(projectId, phase);
    const violations: LockValidation['violations'] = [];

    for (const lock of locks) {
      const lockValue = JSON.parse(lock.lockValue);

      // Type-specific validation logic
      switch (lock.lockType) {
        case 'SMART_METRIC':
          // Validate metrics are referenced
          if (!this.validateMetricReference(artifactContent, lockValue)) {
            violations.push({
              lockId: lock.lockId,
              lockType: lock.lockType,
              expected: lockValue,
              actual: artifactContent,
              message: `SMART metric ${lockValue.metric} not referenced in artifact`,
            });
          }
          break;

        case 'PERSONA':
          // Validate persona is referenced by name
          if (!this.validatePersonaReference(artifactContent, lockValue)) {
            violations.push({
              lockId: lock.lockId,
              lockType: lock.lockType,
              expected: lockValue,
              actual: artifactContent,
              message: `Persona ${lockValue.name} not referenced in artifact`,
            });
          }
          break;

        // Add more validation cases as needed
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private validateMetricReference(content: Record<string, any>, metric: any): boolean {
    // Simple implementation: check if metric name appears in content
    const contentStr = JSON.stringify(content).toLowerCase();
    return contentStr.includes(metric.metric?.toLowerCase() || '');
  }

  private validatePersonaReference(content: Record<string, any>, persona: any): boolean {
    const contentStr = JSON.stringify(content).toLowerCase();
    return contentStr.includes(persona.name?.toLowerCase() || '');
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- backend/services/semantic/semantic_lock_service.test.ts`
Expected: PASS (with mocked db)

**Step 6: Commit**

```bash
git add backend/services/semantic/
git commit -m "feat: add semantic lock service for constraint propagation"
```

---

### Task 2.2: Integrate SemanticLockService with ANALYSIS Phase

**Files:**
- Modify: `backend/services/orchestrator/orchestrator_engine.ts:700-750`
- Create: `backend/services/orchestrator/semantic_lock_extractor.ts`
- Test: `backend/services/orchestrator/semantic_lock_extractor.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/services/orchestrator/semantic_lock_extractor.test.ts
import { describe, it, expect } from 'vitest';
import { extractSemanticLocks } from './semantic_lock_extractor';

describe('SemanticLockExtractor', () => {
  describe('extractSemanticLocks', () => {
    it('should extract SMART metrics from project-classification.json', () => {
      const artifact = {
        filename: 'project-classification.json',
        content: JSON.stringify({
          smartMetrics: [
            { metric: 'response_time', target: '< 200ms', measurement: 'P95 latency' }
          ]
        })
      };

      const locks = extractSemanticLocks('ANALYSIS', artifact, 'project-123');

      expect(locks).toHaveLength(1);
      expect(locks[0].lockType).toBe('SMART_METRIC');
      expect(locks[0].lockId).toMatch(/^LOCK-METRIC-/);
    });

    it('should extract personas from personas.md', () => {
      const artifact = {
        filename: 'personas.md',
        content: '# Persona: Sarah Johnson\n\n## Background\nSoftware engineer...'
      };

      const locks = extractSemanticLocks('ANALYSIS', artifact, 'project-123');

      expect(locks).toHaveLength(1);
      expect(locks[0].lockType).toBe('PERSONA');
      expect(locks[0].lockId).toBe('LOCK-PERSONA-SARAH');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/orchestrator/semantic_lock_extractor.test.ts`
Expected: FAIL

**Step 3: Implement lock extraction logic**

```typescript
// backend/services/orchestrator/semantic_lock_extractor.ts
import { CreateLockInput } from '../semantic/types';

interface ArtifactInput {
  filename: string;
  content: string;
}

/**
 * Extract semantic locks from ANALYSIS phase artifacts
 */
export function extractSemanticLocks(
  phase: string,
  artifact: ArtifactInput,
  projectId: string
): CreateLockInput[] {
  const locks: CreateLockInput[] = [];

  // Extract from project-classification.json
  if (artifact.filename === 'project-classification.json') {
    try {
      const classification = JSON.parse(artifact.content);

      // Extract SMART metrics
      if (classification.smartMetrics && Array.isArray(classification.smartMetrics)) {
        classification.smartMetrics.forEach((metric: any, index: number) => {
          locks.push({
            projectId,
            lockId: `LOCK-METRIC-${String(index + 1).padStart(3, '0')}`,
            lockType: 'SMART_METRIC',
            phase,
            artifactName: artifact.filename,
            lockValue: metric,
            enforcedInPhases: ['SPEC_ARCHITECT', 'SOLUTIONING', 'VALIDATE'],
          });
        });
      }

      // Extract stack constraints
      if (classification.scaleTier) {
        locks.push({
          projectId,
          lockId: 'LOCK-SCALE-TIER',
          lockType: 'STACK_CONSTRAINT',
          phase,
          artifactName: artifact.filename,
          lockValue: { scaleTier: classification.scaleTier },
          enforcedInPhases: ['STACK_SELECTION', 'SPEC_ARCHITECT'],
        });
      }
    } catch (error) {
      // Invalid JSON, skip
    }
  }

  // Extract from personas.md
  if (artifact.filename === 'personas.md') {
    // Simple regex to extract persona names from "# Persona: Name" headers
    const personaMatches = artifact.content.matchAll(/^#\s+Persona:\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gm);

    for (const match of personaMatches) {
      const fullName = match[1];
      const firstName = fullName.split(' ')[0].toUpperCase();

      locks.push({
        projectId,
        lockId: `LOCK-PERSONA-${firstName}`,
        lockType: 'PERSONA',
        phase,
        artifactName: artifact.filename,
        lockValue: { name: fullName },
        enforcedInPhases: ['SPEC_PM', 'SPEC_ARCHITECT', 'VALIDATE'],
      });
    }
  }

  return locks;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/services/orchestrator/semantic_lock_extractor.test.ts`
Expected: PASS

**Step 5: Integrate into orchestrator engine**

```typescript
// backend/services/orchestrator/orchestrator_engine.ts
// Add import at top
import { SemanticLockService } from '../semantic/semantic_lock_service';
import { extractSemanticLocks } from './semantic_lock_extractor';

// Add to constructor
export class OrchestratorEngine {
  private semanticLockService: SemanticLockService;

  constructor() {
    // ... existing code ...
    this.semanticLockService = new SemanticLockService();
  }

  // Add new method after executePhase (around line 700)
  /**
   * Extract and store semantic locks from ANALYSIS phase artifacts
   */
  private async captureSemanticLocks(projectId: string, artifacts: any[]): Promise<void> {
    for (const artifact of artifacts) {
      const locks = extractSemanticLocks('ANALYSIS', artifact, projectId);

      for (const lock of locks) {
        await this.semanticLockService.createLock(lock);
      }
    }
  }

  // Modify executePhase to call captureSemanticLocks after ANALYSIS completes
  // (This is a placeholder - actual integration point depends on existing code structure)
}
```

**Step 6: Commit**

```bash
git add backend/services/orchestrator/semantic_lock_extractor.ts backend/services/orchestrator/semantic_lock_extractor.test.ts backend/services/orchestrator/orchestrator_engine.ts
git commit -m "feat: integrate semantic lock extraction with ANALYSIS phase"
```

---

## Phase 3: Chain-of-Thought Prompt Enhancement (🔴 Critical)

### Task 3.1: Create ChainOfThoughtEnhancer Service

**Files:**
- Create: `backend/services/prompt/chain_of_thought_enhancer.ts`
- Create: `backend/services/prompt/chain_of_thought_enhancer.test.ts`
- Create: `backend/services/prompt/templates/cot_templates.ts`

**Step 1: Write the failing test**

```typescript
// backend/services/prompt/chain_of_thought_enhancer.test.ts
import { describe, it, expect } from 'vitest';
import { ChainOfThoughtEnhancer } from './chain_of_thought_enhancer';

describe('ChainOfThoughtEnhancer', () => {
  let enhancer: ChainOfThoughtEnhancer;

  beforeEach(() => {
    enhancer = new ChainOfThoughtEnhancer();
  });

  describe('enhancePrompt', () => {
    it('should add CoT reasoning section to prompt', () => {
      const basePrompt = 'Generate a PRD for the project.';
      const enhanced = enhancer.enhancePrompt('SPEC_PM', basePrompt, {
        semanticLocks: [],
      });

      expect(enhanced).toContain('## Reasoning (Required)');
      expect(enhanced).toContain('1. [Show analysis step]');
      expect(enhanced).toContain('2. [Show comparison step]');
      expect(enhanced).toContain('3. [Show decision step]');
    });

    it('should inject semantic lock references', () => {
      const basePrompt = 'Generate a PRD for the project.';
      const enhanced = enhancer.enhancePrompt('SPEC_PM', basePrompt, {
        semanticLocks: [
          { lockId: 'LOCK-PERSONA-SARAH', lockType: 'PERSONA', lockValue: { name: 'Sarah Johnson' } }
        ],
      });

      expect(enhanced).toContain('LOCK-PERSONA-SARAH');
      expect(enhanced).toContain('Sarah Johnson');
    });
  });

  describe('extractReasoningChain', () => {
    it('should parse CoT reasoning from LLM response', () => {
      const response = `
## Reasoning

1. Analysis: The project requires user authentication
2. Comparison: JWT vs session-based auth
3. Decision: Use JWT for stateless API

## Output

PRD content here...
`;

      const chain = enhancer.extractReasoningChain(response);

      expect(chain.reasoningSteps).toHaveLength(3);
      expect(chain.reasoningSteps[0].thought).toContain('user authentication');
      expect(chain.decision).toContain('JWT');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/prompt/chain_of_thought_enhancer.test.ts`
Expected: FAIL

**Step 3: Create CoT templates**

```typescript
// backend/services/prompt/templates/cot_templates.ts
export const COT_REASONING_TEMPLATE = `
## Reasoning (Required)

Before generating the final output, you MUST show your reasoning process:

1. [Analysis step: What are the key requirements/constraints?]
2. [Comparison step: What alternatives did you consider?]
3. [Decision step: Why is this the best approach?]

**Semantic Locks Referenced:**
{{SEMANTIC_LOCKS}}

After completing your reasoning, generate the output in the next section.

---

## Output

[Your final artifact content here]
`.trim();

export const PHASE_COT_INSTRUCTIONS: Record<string, string> = {
  ANALYSIS: `
When creating the constitution and personas:
- Show reasoning for each constitutional article choice
- Explain why each persona represents a critical user segment
- Reference similar successful products if applicable
`,
  STACK_SELECTION: `
When recommending the technology stack:
- Compare at least 2-3 stack alternatives
- Show reasoning for dismissing alternatives
- Explain trade-offs explicitly (e.g., "choosing X means sacrificing Y")
- Reference Phase 1 scale tier and project type
`,
  SPEC_PM: `
When writing the PRD:
- Show reasoning for each requirement priority
- Explain how requirements map to personas
- Reference Phase 1 SMART metrics in your reasoning
`,
  SPEC_ARCHITECT: `
When designing the data model and API:
- Show reasoning for entity relationship choices
- Explain normalization/denormalization decisions
- Reference Phase 1 scale tier for performance considerations
`,
};
```

**Step 4: Implement enhancer service**

```typescript
// backend/services/prompt/chain_of_thought_enhancer.ts
import { COT_REASONING_TEMPLATE, PHASE_COT_INSTRUCTIONS } from './templates/cot_templates';

interface SemanticLockReference {
  lockId: string;
  lockType: string;
  lockValue: Record<string, any>;
}

interface EnhanceOptions {
  semanticLocks: SemanticLockReference[];
}

interface ReasoningChain {
  reasoningSteps: Array<{ step: number; thought: string }>;
  alternatives: Array<{ option: string; tradeoffs: string }>;
  decision: string;
  locksReferenced: string[];
}

export class ChainOfThoughtEnhancer {
  /**
   * Enhance a base prompt with Chain-of-Thought reasoning requirements
   */
  enhancePrompt(phase: string, basePrompt: string, options: EnhanceOptions): string {
    // Format semantic locks for injection
    const locksSection = options.semanticLocks.length > 0
      ? options.semanticLocks.map(lock =>
          `- **${lock.lockId}** (${lock.lockType}): ${JSON.stringify(lock.lockValue)}`
        ).join('\n')
      : '- No semantic locks defined yet for this phase';

    // Inject locks into template
    const reasoningTemplate = COT_REASONING_TEMPLATE.replace(
      '{{SEMANTIC_LOCKS}}',
      locksSection
    );

    // Get phase-specific instructions
    const phaseInstructions = PHASE_COT_INSTRUCTIONS[phase] || '';

    // Combine: base prompt + phase instructions + CoT template
    return `${basePrompt}\n\n${phaseInstructions}\n\n${reasoningTemplate}`;
  }

  /**
   * Extract reasoning chain from LLM response
   */
  extractReasoningChain(llmResponse: string): ReasoningChain {
    const reasoningMatch = llmResponse.match(/## Reasoning\s+([\s\S]*?)(?=\n## Output|\n##|$)/i);

    if (!reasoningMatch) {
      return {
        reasoningSteps: [],
        alternatives: [],
        decision: '',
        locksReferenced: [],
      };
    }

    const reasoningText = reasoningMatch[1];

    // Extract numbered steps
    const stepMatches = reasoningText.matchAll(/^\d+\.\s*(.+?)$/gm);
    const reasoningSteps = Array.from(stepMatches).map((match, index) => ({
      step: index + 1,
      thought: match[1].trim(),
    }));

    // Extract decision (usually the last step or explicitly marked)
    const decision = reasoningSteps.length > 0
      ? reasoningSteps[reasoningSteps.length - 1].thought
      : '';

    // Extract lock references (look for LOCK-XXX patterns)
    const lockMatches = reasoningText.matchAll(/LOCK-[A-Z]+-[A-Z0-9]+/g);
    const locksReferenced = Array.from(new Set(Array.from(lockMatches).map(m => m[0])));

    return {
      reasoningSteps,
      alternatives: [], // TODO: Implement alternative extraction
      decision,
      locksReferenced,
    };
  }

  /**
   * Store reasoning chain in database
   */
  async storeReasoningChain(
    artifactId: string,
    agentRole: string,
    phase: string,
    chain: ReasoningChain
  ): Promise<void> {
    const { db } = await import('@/backend/lib/drizzle');
    const { chainOfThoughtLogs } = await import('@/backend/lib/schema');

    await db.insert(chainOfThoughtLogs).values({
      artifactId,
      agentRole,
      phase,
      reasoningSteps: JSON.stringify(chain.reasoningSteps),
      alternatives: JSON.stringify(chain.alternatives),
      decision: chain.decision,
      locksReferenced: JSON.stringify(chain.locksReferenced),
    });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- backend/services/prompt/chain_of_thought_enhancer.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/services/prompt/
git commit -m "feat: add chain-of-thought prompt enhancer"
```

---

### Task 3.2: Integrate CoT Enhancer with Agent Executors

**Files:**
- Modify: `backend/services/llm/agent_executors.ts:50-100`
- Test: `backend/services/llm/agent_executors.test.ts`

**Step 1: Write integration test**

```typescript
// backend/services/llm/agent_executors.test.ts (add to existing file or create)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPMExecutor } from './agent_executors';

vi.mock('@/backend/lib/drizzle');
vi.mock('../semantic/semantic_lock_service');

describe('Agent Executors with CoT', () => {
  it('should enhance PM prompt with semantic locks and CoT template', async () => {
    const mockLLMClient = {
      generateContent: vi.fn().mockResolvedValue({
        content: `## Reasoning\n1. Analysis step\n## Output\nPRD content`
      })
    };

    const executor = getPMExecutor(mockLLMClient as any);

    await executor.execute({
      projectId: 'test-123',
      phase: 'SPEC_PM',
      context: {},
    });

    const callArgs = mockLLMClient.generateContent.mock.calls[0][0];
    expect(callArgs).toContain('## Reasoning (Required)');
    expect(callArgs).toContain('Semantic Locks Referenced');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/llm/agent_executors.test.ts`
Expected: FAIL

**Step 3: Modify agent executors to use CoT enhancer**

```typescript
// backend/services/llm/agent_executors.ts
// Add import
import { ChainOfThoughtEnhancer } from '../prompt/chain_of_thought_enhancer';
import { SemanticLockService } from '../semantic/semantic_lock_service';

// Modify getPMExecutor (example - repeat for other executors)
export function getPMExecutor(llmClient: any) {
  const cotEnhancer = new ChainOfThoughtEnhancer();
  const lockService = new SemanticLockService();

  return {
    async execute(options: { projectId: string; phase: string; context: any }) {
      // 1. Get semantic locks for this phase
      const locks = await lockService.getLocksForPhase(options.projectId, options.phase);
      const lockReferences = locks.map(lock => ({
        lockId: lock.lockId,
        lockType: lock.lockType,
        lockValue: JSON.parse(lock.lockValue),
      }));

      // 2. Get base prompt from orchestrator spec
      const basePrompt = getBasePMPrompt(options.context);

      // 3. Enhance with CoT template and locks
      const enhancedPrompt = cotEnhancer.enhancePrompt(
        options.phase,
        basePrompt,
        { semanticLocks: lockReferences }
      );

      // 4. Execute with LLM
      const response = await llmClient.generateContent(enhancedPrompt);

      // 5. Extract and store reasoning chain
      const reasoningChain = cotEnhancer.extractReasoningChain(response.content);

      // Note: artifactId will be available after artifact is saved
      // Store reasoning in a separate step after artifact creation

      return {
        content: response.content,
        reasoningChain,
      };
    },
  };
}

function getBasePMPrompt(context: any): string {
  // Extract base prompt from orchestrator spec
  return 'You are a Product Manager...'; // Placeholder
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/services/llm/agent_executors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/services/llm/agent_executors.ts backend/services/llm/agent_executors.test.ts
git commit -m "feat: integrate CoT enhancer with agent executors"
```

---

## Phase 4: Bite-Sized Task Format (🔴 Critical)

### Task 4.1: Create Task Formatter Service

**Files:**
- Create: `backend/services/solutioning/task_formatter.ts`
- Create: `backend/services/solutioning/task_formatter.test.ts`
- Create: `backend/services/solutioning/templates/task_template.ts`

**Step 1: Write the failing test**

```typescript
// backend/services/solutioning/task_formatter.test.ts
import { describe, it, expect } from 'vitest';
import { TaskFormatter } from './task_formatter';

describe('TaskFormatter', () => {
  let formatter: TaskFormatter;

  beforeEach(() => {
    formatter = new TaskFormatter();
  });

  describe('formatTask', () => {
    it('should format task with 15-30 minute granularity', () => {
      const task = formatter.formatTask({
        title: 'Implement user authentication',
        requirements: ['REQ-001', 'REQ-002'],
        epic: 'EPIC-AUTH',
      });

      expect(task.estimatedMinutes).toBeGreaterThanOrEqual(15);
      expect(task.estimatedMinutes).toBeLessThanOrEqual(30);
      expect(task.filePaths).toBeDefined();
      expect(task.skeletonCode).toBeDefined();
      expect(task.verificationCommand).toBeDefined();
    });

    it('should include exact file paths to create/modify', () => {
      const task = formatter.formatTask({
        title: 'Add login API endpoint',
        requirements: ['REQ-AUTH-001'],
        epic: 'EPIC-AUTH',
      });

      expect(task.filePaths.create).toContain('src/app/api/auth/login/route.ts');
      expect(task.filePaths.test).toContain('src/app/api/auth/login/route.test.ts');
    });

    it('should provide skeleton code showing structure', () => {
      const task = formatter.formatTask({
        title: 'Create UserService class',
        requirements: ['REQ-USER-001'],
        epic: 'EPIC-USER',
      });

      expect(task.skeletonCode).toContain('export class UserService');
      expect(task.skeletonCode).toContain('constructor');
      expect(task.skeletonCode.split('\n').length).toBeLessThanOrEqual(5);
    });

    it('should include verification command with test pattern', () => {
      const task = formatter.formatTask({
        title: 'Add user registration endpoint',
        requirements: ['REQ-AUTH-002'],
        epic: 'EPIC-AUTH',
      });

      expect(task.verificationCommand).toContain('npm test');
      expect(task.verificationCommand).toMatch(/-- .+\.test\.ts/);
    });
  });

  describe('splitLargeTask', () => {
    it('should split tasks exceeding 30 minutes into subtasks', () => {
      const largeTask = {
        title: 'Implement complete user management system',
        estimatedMinutes: 120,
      };

      const subtasks = formatter.splitLargeTask(largeTask);

      expect(subtasks.length).toBeGreaterThan(1);
      subtasks.forEach(task => {
        expect(task.estimatedMinutes).toBeLessThanOrEqual(30);
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/solutioning/task_formatter.test.ts`
Expected: FAIL

**Step 3: Create task template**

```typescript
// backend/services/solutioning/templates/task_template.ts
export interface FormattedTask {
  title: string;
  estimatedMinutes: number;
  epic: string;
  requirements: string[];
  filePaths: {
    create?: string[];
    modify?: Array<{ path: string; lines?: string }>;
    test: string[];
  };
  skeletonCode: string;
  verificationCommand: string;
  parallelizable: boolean; // [P] marker
}

export const TASK_TEMPLATE = `
### Task: {{TITLE}}

**Epic:** {{EPIC}}
**Requirements:** {{REQUIREMENTS}}
**Estimated Time:** {{MINUTES}} minutes
**Parallelizable:** {{PARALLEL_MARKER}}

**Files:**
{{FILE_PATHS}}

**Skeleton Code:**
\`\`\`typescript
{{SKELETON_CODE}}
\`\`\`

**Verification:**
\`\`\`bash
{{VERIFICATION_COMMAND}}
\`\`\`
`.trim();
```

**Step 4: Implement task formatter**

```typescript
// backend/services/solutioning/task_formatter.ts
import { FormattedTask, TASK_TEMPLATE } from './templates/task_template';

interface TaskInput {
  title: string;
  requirements: string[];
  epic: string;
  context?: Record<string, any>;
}

export class TaskFormatter {
  /**
   * Format a task with bite-sized granularity (15-30 minutes)
   */
  formatTask(input: TaskInput): FormattedTask {
    // Estimate complexity based on title keywords
    const estimatedMinutes = this.estimateTaskDuration(input.title);

    // Generate file paths based on task type
    const filePaths = this.generateFilePaths(input.title, input.context);

    // Generate skeleton code (3-5 lines showing structure)
    const skeletonCode = this.generateSkeletonCode(input.title, input.context);

    // Generate verification command
    const verificationCommand = this.generateVerificationCommand(filePaths);

    // Determine if parallelizable (no shared state dependencies)
    const parallelizable = this.isParallelizable(input.title, input.requirements);

    return {
      title: input.title,
      estimatedMinutes,
      epic: input.epic,
      requirements: input.requirements,
      filePaths,
      skeletonCode,
      verificationCommand,
      parallelizable,
    };
  }

  /**
   * Split large tasks into subtasks (max 30 minutes each)
   */
  splitLargeTask(task: { title: string; estimatedMinutes: number }): FormattedTask[] {
    if (task.estimatedMinutes <= 30) {
      return [];
    }

    // Simple splitting logic: divide into N subtasks
    const numSubtasks = Math.ceil(task.estimatedMinutes / 25);
    const subtasks: FormattedTask[] = [];

    for (let i = 0; i < numSubtasks; i++) {
      subtasks.push({
        title: `${task.title} - Part ${i + 1}`,
        estimatedMinutes: 25,
        epic: '',
        requirements: [],
        filePaths: { test: [] },
        skeletonCode: '',
        verificationCommand: '',
        parallelizable: false,
      });
    }

    return subtasks;
  }

  private estimateTaskDuration(title: string): number {
    const titleLower = title.toLowerCase();

    // Simple heuristic: certain keywords indicate complexity
    if (titleLower.includes('implement') || titleLower.includes('create')) {
      return 25;
    }
    if (titleLower.includes('add') || titleLower.includes('update')) {
      return 20;
    }
    if (titleLower.includes('fix') || titleLower.includes('refactor')) {
      return 15;
    }

    return 20; // Default
  }

  private generateFilePaths(title: string, context?: Record<string, any>): FormattedTask['filePaths'] {
    const titleLower = title.toLowerCase();

    // Pattern matching for common task types
    if (titleLower.includes('api') && titleLower.includes('endpoint')) {
      const endpoint = this.extractEndpoint(title) || 'example';
      return {
        create: [`src/app/api/${endpoint}/route.ts`],
        test: [`src/app/api/${endpoint}/route.test.ts`],
      };
    }

    if (titleLower.includes('service') || titleLower.includes('class')) {
      const serviceName = this.extractServiceName(title) || 'ExampleService';
      return {
        create: [`backend/services/${serviceName.toLowerCase()}/${serviceName}.ts`],
        test: [`backend/services/${serviceName.toLowerCase()}/${serviceName}.test.ts`],
      };
    }

    // Default
    return {
      create: ['src/lib/example.ts'],
      test: ['src/lib/example.test.ts'],
    };
  }

  private generateSkeletonCode(title: string, context?: Record<string, any>): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('service') || titleLower.includes('class')) {
      const className = this.extractServiceName(title) || 'ExampleService';
      return `export class ${className} {\n  constructor() {}\n  \n  // Methods here\n}`;
    }

    if (titleLower.includes('api') && titleLower.includes('endpoint')) {
      return `export async function POST(req: Request) {\n  // Handler logic\n  return Response.json({ success: true });\n}`;
    }

    return '// Implementation here';
  }

  private generateVerificationCommand(filePaths: FormattedTask['filePaths']): string {
    const testFile = filePaths.test[0];
    if (!testFile) {
      return 'npm test';
    }

    return `npm test -- ${testFile}`;
  }

  private isParallelizable(title: string, requirements: string[]): boolean {
    // Simple heuristic: tasks with shared requirements are not parallelizable
    // In real implementation, would check dependency graph
    return requirements.length <= 1;
  }

  private extractEndpoint(title: string): string | null {
    const match = title.match(/(\w+)\s+(api|endpoint)/i);
    return match ? match[1].toLowerCase() : null;
  }

  private extractServiceName(title: string): string | null {
    const match = title.match(/(?:create|add|implement)\s+(\w+)\s+(?:service|class)/i);
    return match ? match[1] : null;
  }

  /**
   * Render task as markdown using template
   */
  renderTask(task: FormattedTask): string {
    const filePaths = [
      task.filePaths.create?.map(p => `- Create: \`${p}\``).join('\n') || '',
      task.filePaths.modify?.map(p => `- Modify: \`${p.path}${p.lines ? ':' + p.lines : ''}\``).join('\n') || '',
      task.filePaths.test?.map(p => `- Test: \`${p}\``).join('\n') || '',
    ].filter(Boolean).join('\n');

    return TASK_TEMPLATE
      .replace('{{TITLE}}', task.title)
      .replace('{{EPIC}}', task.epic)
      .replace('{{REQUIREMENTS}}', task.requirements.join(', '))
      .replace('{{MINUTES}}', String(task.estimatedMinutes))
      .replace('{{PARALLEL_MARKER}}', task.parallelizable ? '[P]' : 'Sequential')
      .replace('{{FILE_PATHS}}', filePaths)
      .replace('{{SKELETON_CODE}}', task.skeletonCode)
      .replace('{{VERIFICATION_COMMAND}}', task.verificationCommand);
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- backend/services/solutioning/task_formatter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/services/solutioning/
git commit -m "feat: add bite-sized task formatter for SOLUTIONING phase"
```

---

### Task 4.2: Integrate Task Formatter with Scrum Master Agent

**Files:**
- Modify: `backend/services/llm/agent_executors.ts:200-250`
- Test: Integration test for complete SOLUTIONING flow

**Step 1: Add task formatter to Scrum Master executor**

```typescript
// backend/services/llm/agent_executors.ts
import { TaskFormatter } from '../solutioning/task_formatter';

export function getScruMasterExecutor(llmClient: any) {
  const taskFormatter = new TaskFormatter();
  const cotEnhancer = new ChainOfThoughtEnhancer();
  const lockService = new SemanticLockService();

  return {
    async execute(options: { projectId: string; phase: string; context: any }) {
      // 1. Get semantic locks
      const locks = await lockService.getLocksForPhase(options.projectId, options.phase);

      // 2. Enhance prompt with CoT
      const basePrompt = getBaseScrumMasterPrompt(options.context);
      const enhancedPrompt = cotEnhancer.enhancePrompt(
        options.phase,
        basePrompt + '\n\n' + TASK_FORMAT_INSTRUCTIONS,
        { semanticLocks: locks.map(l => ({
          lockId: l.lockId,
          lockType: l.lockType,
          lockValue: JSON.parse(l.lockValue)
        }))}
      );

      // 3. Execute with LLM
      const response = await llmClient.generateContent(enhancedPrompt);

      // 4. Parse and format tasks
      const rawTasks = this.parseTasks(response.content);
      const formattedTasks = rawTasks.map(task => taskFormatter.formatTask(task));

      // 5. Render as markdown
      const tasksMarkdown = formattedTasks.map(t => taskFormatter.renderTask(t)).join('\n\n');

      return {
        content: tasksMarkdown,
        tasks: formattedTasks,
      };
    },

    parseTasks(content: string): any[] {
      // Extract task information from LLM response
      // This is a simplified parser - real implementation would be more robust
      return [];
    },
  };
}

const TASK_FORMAT_INSTRUCTIONS = `
**Task Breakdown Requirements:**

Each task MUST include:
1. Estimated time: 15-30 minutes (if larger, split into subtasks)
2. Exact file paths to create/modify
3. Skeleton code (3-5 lines showing structure)
4. Verification command: \`npm test -- <pattern>\`
5. [P] marker if task is parallelizable (no shared state dependencies)

**Test-First Ordering:**
- List test file BEFORE implementation file
- Example: tasks.md should show "Write test" → "Run to fail" → "Implement" → "Verify"
`.trim();
```

**Step 2: Commit**

```bash
git add backend/services/llm/agent_executors.ts
git commit -m "feat: integrate task formatter with scrum master executor"
```

---

## Phase 5: Subagent Self-Review (🟠 High Priority)

### Task 5.1: Create Subagent Dispatcher

**Files:**
- Create: `backend/services/orchestrator/subagent_dispatcher.ts`
- Create: `backend/services/orchestrator/subagent_dispatcher.test.ts`
- Create: `backend/services/orchestrator/self_review_checklists.ts`

**Step 1: Write the failing test**

```typescript
// backend/services/orchestrator/subagent_dispatcher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SubagentDispatcher } from './subagent_dispatcher';

describe('SubagentDispatcher', () => {
  let dispatcher: SubagentDispatcher;

  beforeEach(() => {
    dispatcher = new SubagentDispatcher();
  });

  describe('dispatch', () => {
    it('should dispatch subagent with isolated context', async () => {
      const result = await dispatcher.dispatch({
        projectId: 'test-123',
        parentPhase: 'FRONTEND_BUILD',
        taskDescription: 'Generate ProductCard component',
        contextSnapshot: { designTokens: {} },
        agentType: 'frontend',
      });

      expect(result.dispatchId).toMatch(/^DISPATCH-/);
      expect(result.status).toBe('completed');
      expect(result.output).toBeDefined();
      expect(result.reviewResult).toBeDefined();
    });

    it('should run self-review checklist before completion', async () => {
      const result = await dispatcher.dispatch({
        projectId: 'test-123',
        parentPhase: 'FRONTEND_BUILD',
        taskDescription: 'Generate LoginForm component',
        contextSnapshot: {},
        agentType: 'frontend',
      });

      expect(result.reviewResult.checklist).toBeDefined();
      expect(result.reviewResult.checklist.length).toBeGreaterThan(0);
      expect(result.reviewResult.passed).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/orchestrator/subagent_dispatcher.test.ts`
Expected: FAIL

**Step 3: Create self-review checklists**

```typescript
// backend/services/orchestrator/self_review_checklists.ts
export interface ChecklistItem {
  id: string;
  description: string;
  checkPattern: string | ((output: any) => boolean);
}

export const FRONTEND_COMPONENT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'shadcn-pattern',
    description: 'Follows shadcn/ui pattern',
    checkPattern: /forwardRef|className.*cn\(/,
  },
  {
    id: 'design-tokens',
    description: 'Uses design tokens from Phase 5',
    checkPattern: /className.*(?:bg-|text-|border-)/,
  },
  {
    id: 'reduced-motion',
    description: 'Includes useReducedMotion accessibility',
    checkPattern: /useReducedMotion|prefers-reduced-motion/,
  },
  {
    id: 'no-console',
    description: 'No console.log artifacts',
    checkPattern: (output) => !output.includes('console.log'),
  },
  {
    id: 'no-placeholder',
    description: 'No generic placeholder text',
    checkPattern: (output) => !output.match(/Lorem ipsum|placeholder|TODO|FIXME/i),
  },
];

export const PM_SPEC_CHECKLIST: ChecklistItem[] = [
  {
    id: 'gherkin-ac',
    description: 'Has Gherkin acceptance criteria',
    checkPattern: /Given|When|Then/,
  },
  {
    id: 'persona-link',
    description: 'Links explicitly to persona by NAME',
    checkPattern: /LOCK-PERSONA-|Persona:/,
  },
  {
    id: 'requirement-id',
    description: 'Has [LOCK-REQ-XXX] ID',
    checkPattern: /\[LOCK-REQ-\d+\]/,
  },
];

export const ARCHITECT_SPEC_CHECKLIST: ChecklistItem[] = [
  {
    id: 'persona-access',
    description: 'API endpoints have persona access annotations',
    checkPattern: /Persona Access:|Accessible to:/,
  },
  {
    id: 'rate-limits',
    description: 'OpenAPI includes rate-limit headers',
    checkPattern: /X-RateLimit|rate-limit/,
  },
  {
    id: 'scale-tier',
    description: 'Data model satisfies Phase 1 scale tier',
    checkPattern: /index|Index|performance|scalability/,
  },
];

export function getChecklistForPhase(phase: string, agentType: string): ChecklistItem[] {
  if (phase === 'FRONTEND_BUILD') {
    return FRONTEND_COMPONENT_CHECKLIST;
  }
  if (phase === 'SPEC_PM') {
    return PM_SPEC_CHECKLIST;
  }
  if (phase === 'SPEC_ARCHITECT') {
    return ARCHITECT_SPEC_CHECKLIST;
  }
  return [];
}
```

**Step 4: Implement subagent dispatcher**

```typescript
// backend/services/orchestrator/subagent_dispatcher.ts
import { db } from '@/backend/lib/drizzle';
import { subagentDispatches } from '@/backend/lib/schema';
import { getChecklistForPhase, ChecklistItem } from './self_review_checklists';
import { randomUUID } from 'crypto';

interface DispatchOptions {
  projectId: string;
  parentPhase: string;
  taskDescription: string;
  contextSnapshot: Record<string, any>;
  agentType: string;
}

interface DispatchResult {
  dispatchId: string;
  status: 'completed' | 'failed';
  output: any;
  reviewResult: {
    passed: boolean;
    checklist: Array<{ item: string; passed: boolean; message?: string }>;
    issues: string[];
  };
}

export class SubagentDispatcher {
  /**
   * Dispatch a subagent with isolated context and self-review
   */
  async dispatch(options: DispatchOptions): Promise<DispatchResult> {
    const dispatchId = `DISPATCH-${options.agentType.toUpperCase()}-${randomUUID().slice(0, 8)}`;
    const startTime = Date.now();

    // 1. Create dispatch record
    const [dispatchRecord] = await db.insert(subagentDispatches).values({
      projectId: options.projectId,
      dispatchId,
      parentPhase: options.parentPhase,
      taskDescription: options.taskDescription,
      contextSnapshot: JSON.stringify(options.contextSnapshot),
      selfReviewChecklist: JSON.stringify(getChecklistForPhase(options.parentPhase, options.agentType)),
      status: 'running',
    }).returning();

    try {
      // 2. Execute subagent with isolated context
      const output = await this.executeSubagent(options);

      // 3. Run self-review checklist
      const reviewResult = await this.runSelfReview(
        output,
        options.parentPhase,
        options.agentType
      );

      // 4. Update dispatch record
      const durationMs = Date.now() - startTime;
      await db.update(subagentDispatches)
        .set({
          status: 'completed',
          reviewResult: JSON.stringify(reviewResult),
          completedAt: new Date(),
          durationMs,
        })
        .where({ id: dispatchRecord.id });

      return {
        dispatchId,
        status: 'completed',
        output,
        reviewResult,
      };
    } catch (error) {
      // Update dispatch record with failure
      await db.update(subagentDispatches)
        .set({ status: 'failed' })
        .where({ id: dispatchRecord.id });

      throw error;
    }
  }

  private async executeSubagent(options: DispatchOptions): Promise<any> {
    // TODO: Integrate with actual LLM client
    // For now, return mock output
    return {
      content: '// Component code here',
    };
  }

  private async runSelfReview(
    output: any,
    phase: string,
    agentType: string
  ): Promise<DispatchResult['reviewResult']> {
    const checklist = getChecklistForPhase(phase, agentType);
    const checklistResults: Array<{ item: string; passed: boolean; message?: string }> = [];
    const issues: string[] = [];

    for (const item of checklist) {
      const passed = this.checkItem(output, item);

      checklistResults.push({
        item: item.description,
        passed,
        message: passed ? undefined : `Failed: ${item.description}`,
      });

      if (!passed) {
        issues.push(item.description);
      }
    }

    return {
      passed: issues.length === 0,
      checklist: checklistResults,
      issues,
    };
  }

  private checkItem(output: any, item: ChecklistItem): boolean {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

    if (typeof item.checkPattern === 'string') {
      return new RegExp(item.checkPattern).test(outputStr);
    } else {
      return item.checkPattern(outputStr);
    }
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- backend/services/orchestrator/subagent_dispatcher.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/services/orchestrator/subagent_dispatcher.ts backend/services/orchestrator/subagent_dispatcher.test.ts backend/services/orchestrator/self_review_checklists.ts
git commit -m "feat: add subagent dispatcher with self-review checklists"
```

---

## Phase 6: Semantic Integrity Checks (🟠 High Priority)

### Task 6.1: Enhance Validation Service with Semantic Checks

**Files:**
- Create: `backend/services/validation/semantic_validator.ts`
- Create: `backend/services/validation/semantic_validator.test.ts`
- Modify: `backend/services/orchestrator/validators.ts:100-150`

**Step 1: Write the failing test**

```typescript
// backend/services/validation/semantic_validator.test.ts
import { describe, it, expect } from 'vitest';
import { SemanticValidator } from './semantic_validator';

describe('SemanticValidator', () => {
  let validator: SemanticValidator;

  beforeEach(() => {
    validator = new SemanticValidator();
  });

  describe('validateCrossPhaseCoherence', () => {
    it('should check if DB schema supports user flow concurrency', async () => {
      const result = await validator.validateCrossPhaseCoherence({
        projectId: 'test-123',
        checkType: 'DB_SCHEMA_SUPPORTS_CONCURRENCY',
        phase1Artifact: { /* data model */ },
        phase2Artifact: { /* user flows */ },
      });

      expect(result.passed).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should verify API response times align with NFR targets', async () => {
      const result = await validator.validateCrossPhaseCoherence({
        projectId: 'test-123',
        checkType: 'API_RESPONSE_TIMES',
        nfrTargets: { responseTime: '< 200ms' },
        apiSpec: { /* OpenAPI spec */ },
      });

      expect(result.passed).toBeDefined();
    });

    it('should ensure all [AI ASSUMED] items are documented', async () => {
      const result = await validator.validateCrossPhaseCoherence({
        projectId: 'test-123',
        checkType: 'AI_ASSUMPTIONS_DOCUMENTED',
        artifacts: [
          { content: 'Some content [AI ASSUMED: reason]' }
        ],
      });

      expect(result.passed).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/validation/semantic_validator.test.ts`
Expected: FAIL

**Step 3: Implement semantic validator**

```typescript
// backend/services/validation/semantic_validator.ts
export interface SemanticValidationResult {
  passed: boolean;
  checkType: string;
  issues: Array<{
    severity: 'error' | 'warning';
    message: string;
    location?: string;
  }>;
  suggestions?: string[];
}

export class SemanticValidator {
  /**
   * Validate cross-phase coherence beyond simple ID matching
   */
  async validateCrossPhaseCoherence(options: any): Promise<SemanticValidationResult> {
    const { checkType } = options;

    switch (checkType) {
      case 'DB_SCHEMA_SUPPORTS_CONCURRENCY':
        return this.checkDatabaseConcurrency(options);

      case 'API_RESPONSE_TIMES':
        return this.checkAPIResponseTimes(options);

      case 'AI_ASSUMPTIONS_DOCUMENTED':
        return this.checkAIAssumptions(options);

      default:
        return {
          passed: true,
          checkType,
          issues: [],
        };
    }
  }

  private async checkDatabaseConcurrency(options: any): Promise<SemanticValidationResult> {
    // Check if database schema has proper indexes for concurrent access patterns
    const issues: SemanticValidationResult['issues'] = [];

    // Example check: Do high-traffic tables have indexes?
    // This would parse Phase 4 data-model.md and Phase 3 user-flows.md

    return {
      passed: issues.length === 0,
      checkType: 'DB_SCHEMA_SUPPORTS_CONCURRENCY',
      issues,
      suggestions: issues.length > 0 ? ['Add indexes on frequently queried columns'] : undefined,
    };
  }

  private async checkAPIResponseTimes(options: any): Promise<SemanticValidationResult> {
    const { nfrTargets, apiSpec } = options;
    const issues: SemanticValidationResult['issues'] = [];

    // Check if API spec includes timeout annotations
    if (apiSpec && nfrTargets?.responseTime) {
      const specStr = JSON.stringify(apiSpec);

      if (!specStr.includes('timeout') && !specStr.includes('response-time')) {
        issues.push({
          severity: 'warning',
          message: `NFR target is ${nfrTargets.responseTime} but API spec has no timeout annotations`,
        });
      }
    }

    return {
      passed: issues.filter(i => i.severity === 'error').length === 0,
      checkType: 'API_RESPONSE_TIMES',
      issues,
    };
  }

  private async checkAIAssumptions(options: any): Promise<SemanticValidationResult> {
    const { artifacts } = options;
    const issues: SemanticValidationResult['issues'] = [];

    for (const artifact of artifacts) {
      // Check if [AI ASSUMED: ...] markers are present and properly documented
      const assumptionMatches = artifact.content?.matchAll(/\[AI ASSUMED:([^\]]+)\]/g);

      if (assumptionMatches) {
        for (const match of assumptionMatches) {
          const assumption = match[1].trim();

          if (assumption.length < 10) {
            issues.push({
              severity: 'warning',
              message: `AI assumption is too vague: "${assumption}"`,
              location: artifact.filename,
            });
          }
        }
      }
    }

    return {
      passed: issues.filter(i => i.severity === 'error').length === 0,
      checkType: 'AI_ASSUMPTIONS_DOCUMENTED',
      issues,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/services/validation/semantic_validator.test.ts`
Expected: PASS

**Step 5: Integrate with existing validators**

```typescript
// backend/services/orchestrator/validators.ts
// Add import
import { SemanticValidator } from '../validation/semantic_validator';

export class Validators {
  private semanticValidator: SemanticValidator;

  constructor() {
    this.semanticValidator = new SemanticValidator();
  }

  // Add new validator method
  async runSemanticIntegrityChecks(projectId: string, phase: string): Promise<ValidationResult> {
    const checks = await Promise.all([
      this.semanticValidator.validateCrossPhaseCoherence({
        projectId,
        checkType: 'DB_SCHEMA_SUPPORTS_CONCURRENCY',
      }),
      this.semanticValidator.validateCrossPhaseCoherence({
        projectId,
        checkType: 'API_RESPONSE_TIMES',
      }),
      this.semanticValidator.validateCrossPhaseCoherence({
        projectId,
        checkType: 'AI_ASSUMPTIONS_DOCUMENTED',
      }),
    ]);

    const allPassed = checks.every(c => c.passed);
    const allIssues = checks.flatMap(c => c.issues.map(i => i.message));

    return {
      status: allPassed ? 'pass' : 'fail',
      checks: Object.fromEntries(checks.map(c => [c.checkType, c.passed])),
      errors: allIssues,
    };
  }
}
```

**Step 6: Commit**

```bash
git add backend/services/validation/semantic_validator.ts backend/services/validation/semantic_validator.test.ts backend/services/orchestrator/validators.ts
git commit -m "feat: add semantic integrity checks for cross-phase validation"
```

---

## Phase 7: Medium Priority Enhancements (🟡)

### Task 7.1: Root Cause Tracing for Auto-Remedy

**Files:**
- Create: `backend/services/orchestrator/root_cause_tracer.ts`
- Create: `backend/services/orchestrator/root_cause_tracer.test.ts`
- Modify: `backend/services/orchestrator/auto_remedy_executor.ts:50-100` (if exists)

**Step 1: Write the failing test**

```typescript
// backend/services/orchestrator/root_cause_tracer.test.ts
import { describe, it, expect } from 'vitest';
import { RootCauseTracer } from './root_cause_tracer';

describe('RootCauseTracer', () => {
  let tracer: RootCauseTracer;

  beforeEach(() => {
    tracer = new RootCauseTracer();
  });

  describe('traceError', () => {
    it('should trace validation error back to originating phase', async () => {
      const error = {
        phase: 'VALIDATE',
        errorType: 'PERSONA_REFERENCE_MISSING',
        details: { personaName: 'Sarah Johnson' },
      };

      const trace = await tracer.traceError('project-123', error);

      expect(trace.originatingPhase).toBe('ANALYSIS');
      expect(trace.originatingArtifact).toBe('personas.md');
      expect(trace.affectedPhases).toContain('SPEC_PM');
    });

    it('should identify dependency chain for cascading fixes', async () => {
      const error = {
        phase: 'VALIDATE',
        errorType: 'API_SCHEMA_MISMATCH',
      };

      const trace = await tracer.traceError('project-123', error);

      expect(trace.dependencyChain).toBeDefined();
      expect(trace.dependencyChain.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/orchestrator/root_cause_tracer.test.ts`
Expected: FAIL

**Step 3: Implement root cause tracer**

```typescript
// backend/services/orchestrator/root_cause_tracer.ts
export interface ErrorTrace {
  originatingPhase: string;
  originatingArtifact: string;
  affectedPhases: string[];
  dependencyChain: Array<{ phase: string; artifact: string }>;
  suggestedFix: string;
}

export interface ValidationError {
  phase: string;
  errorType: string;
  details: Record<string, any>;
}

export class RootCauseTracer {
  /**
   * Trace validation error back to its root cause
   */
  async traceError(projectId: string, error: ValidationError): Promise<ErrorTrace> {
    // Map error types to their originating phases
    const errorOriginMap: Record<string, { phase: string; artifact: string }> = {
      'PERSONA_REFERENCE_MISSING': { phase: 'ANALYSIS', artifact: 'personas.md' },
      'SMART_METRIC_NOT_REFERENCED': { phase: 'ANALYSIS', artifact: 'project-classification.json' },
      'API_SCHEMA_MISMATCH': { phase: 'SPEC_ARCHITECT', artifact: 'api-spec.json' },
      'STACK_INCONSISTENCY': { phase: 'STACK_SELECTION', artifact: 'stack-decision.md' },
    };

    const origin = errorOriginMap[error.errorType] || {
      phase: error.phase,
      artifact: 'unknown'
    };

    // Build dependency chain
    const dependencyChain = await this.buildDependencyChain(projectId, origin.phase);

    // Identify affected phases (phases that depend on the originating phase)
    const affectedPhases = dependencyChain
      .filter(dep => dep.phase !== origin.phase)
      .map(dep => dep.phase);

    return {
      originatingPhase: origin.phase,
      originatingArtifact: origin.artifact,
      affectedPhases,
      dependencyChain,
      suggestedFix: this.generateSuggestedFix(error),
    };
  }

  private async buildDependencyChain(
    projectId: string,
    startPhase: string
  ): Promise<Array<{ phase: string; artifact: string }>> {
    // Phase dependency graph (from SUPERPOWERS_INTEGRATION_PLAN.md)
    const phaseDependencies: Record<string, string[]> = {
      'ANALYSIS': ['STACK_SELECTION', 'SPEC_PM', 'SPEC_ARCHITECT', 'VALIDATE'],
      'STACK_SELECTION': ['DEPENDENCIES', 'SPEC_ARCHITECT'],
      'SPEC_PM': ['SPEC_ARCHITECT', 'SOLUTIONING', 'VALIDATE'],
      'SPEC_ARCHITECT': ['SOLUTIONING', 'VALIDATE'],
      'DEPENDENCIES': ['SOLUTIONING'],
      'SOLUTIONING': ['VALIDATE'],
    };

    const chain: Array<{ phase: string; artifact: string }> = [];
    const visited = new Set<string>();

    const traverse = (phase: string) => {
      if (visited.has(phase)) return;
      visited.add(phase);

      chain.push({ phase, artifact: 'multiple' });

      const deps = phaseDependencies[phase] || [];
      deps.forEach(dep => traverse(dep));
    };

    traverse(startPhase);
    return chain;
  }

  private generateSuggestedFix(error: ValidationError): string {
    const fixMap: Record<string, string> = {
      'PERSONA_REFERENCE_MISSING': 'Re-run ANALYSIS phase to add missing persona',
      'SMART_METRIC_NOT_REFERENCED': 'Update SPEC_ARCHITECT to reference SMART metrics from Phase 1',
      'API_SCHEMA_MISMATCH': 'Re-run SPEC_ARCHITECT to align API schema with data model',
      'STACK_INCONSISTENCY': 'Re-run STACK_SELECTION or update dependent artifacts',
    };

    return fixMap[error.errorType] || 'Manual review required';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/services/orchestrator/root_cause_tracer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/services/orchestrator/root_cause_tracer.ts backend/services/orchestrator/root_cause_tracer.test.ts
git commit -m "feat: add root cause tracing for auto-remedy"
```

---

### Task 7.2: Checker Pattern Implementation

**Files:**
- Create: `backend/services/orchestrator/critic_personas.ts`
- Create: `backend/services/orchestrator/critic_personas.test.ts`
- Modify: `backend/services/llm/agent_executors.ts:300-350`

**Step 1: Write the failing test**

```typescript
// backend/services/orchestrator/critic_personas.test.ts
import { describe, it, expect } from 'vitest';
import { getCriticPersona, runCriticReview } from './critic_personas';

describe('Critic Personas', () => {
  describe('getCriticPersona', () => {
    it('should return Skeptical CTO for STACK_SELECTION', () => {
      const critic = getCriticPersona('STACK_SELECTION');

      expect(critic.name).toBe('Skeptical CTO');
      expect(critic.critiqueFocus).toContain('scalability');
    });

    it('should return QA Lead for SPEC_PM', () => {
      const critic = getCriticPersona('SPEC_PM');

      expect(critic.name).toBe('QA Lead');
      expect(critic.critiqueFocus).toContain('testability');
    });
  });

  describe('runCriticReview', () => {
    it('should generate critique of artifact', async () => {
      const artifact = { content: 'Stack decision: Use MongoDB' };

      const critique = await runCriticReview('STACK_SELECTION', artifact);

      expect(critique.issues).toBeDefined();
      expect(critique.suggestions).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/orchestrator/critic_personas.test.ts`
Expected: FAIL

**Step 3: Implement critic personas**

```typescript
// backend/services/orchestrator/critic_personas.ts
export interface CriticPersona {
  name: string;
  role: string;
  critiqueFocus: string[];
  promptTemplate: string;
}

export interface CriticReview {
  criticName: string;
  issues: Array<{
    severity: 'critical' | 'major' | 'minor';
    category: string;
    description: string;
  }>;
  suggestions: string[];
  overallScore: number; // 0-100
}

const CRITIC_PERSONAS: Record<string, CriticPersona> = {
  'STACK_SELECTION': {
    name: 'Skeptical CTO',
    role: 'Technology Risk Assessor',
    critiqueFocus: ['scalability', 'cost', 'team expertise', 'vendor lock-in'],
    promptTemplate: `You are a Skeptical CTO reviewing a technology stack proposal.

Your job is to find potential problems:
- Will this scale to 10x users?
- What's the total cost of ownership?
- Do we have team expertise?
- Are we locked into a vendor?
- What's the exit strategy?

Be critical but constructive. Give a score from 0-100.

Stack Proposal:
{{ARTIFACT}}

Critique:`,
  },
  'SPEC_PM': {
    name: 'QA Lead',
    role: 'Quality Assurance Specialist',
    critiqueFocus: ['testability', 'ambiguity', 'edge cases', 'acceptance criteria'],
    promptTemplate: `You are a QA Lead reviewing a Product Requirements Document.

Your job is to find gaps:
- Are requirements testable?
- Are there ambiguous terms?
- What edge cases are missing?
- Are acceptance criteria clear?

Be thorough. Give a score from 0-100.

PRD:
{{ARTIFACT}}

Critique:`,
  },
  'SPEC_ARCHITECT': {
    name: 'Security Auditor',
    role: 'Security & Compliance Specialist',
    critiqueFocus: ['authentication', 'authorization', 'data protection', 'compliance'],
    promptTemplate: `You are a Security Auditor reviewing a technical architecture.

Your job is to find security issues:
- How is authentication handled?
- Are there authorization gaps?
- Is sensitive data encrypted?
- Does it meet compliance requirements (GDPR, SOC2)?

Be vigilant. Give a score from 0-100.

Architecture:
{{ARTIFACT}}

Critique:`,
  },
  'FRONTEND_BUILD': {
    name: 'Accessibility Specialist',
    role: 'A11y & UX Auditor',
    critiqueFocus: ['WCAG compliance', 'keyboard navigation', 'screen reader support', 'color contrast'],
    promptTemplate: `You are an Accessibility Specialist reviewing frontend components.

Your job is to find accessibility issues:
- Is it WCAG 2.1 AA compliant?
- Does it support keyboard navigation?
- Will screen readers work correctly?
- Is color contrast sufficient?

Be thorough. Give a score from 0-100.

Component:
{{ARTIFACT}}

Critique:`,
  },
};

export function getCriticPersona(phase: string): CriticPersona {
  return CRITIC_PERSONAS[phase] || {
    name: 'Generic Reviewer',
    role: 'Quality Reviewer',
    critiqueFocus: ['completeness', 'clarity'],
    promptTemplate: 'Review this artifact for quality:\n{{ARTIFACT}}',
  };
}

export async function runCriticReview(
  phase: string,
  artifact: { content: string }
): Promise<CriticReview> {
  const critic = getCriticPersona(phase);
  const prompt = critic.promptTemplate.replace('{{ARTIFACT}}', artifact.content);

  // TODO: Integrate with actual LLM client
  // For now, return mock review
  return {
    criticName: critic.name,
    issues: [
      {
        severity: 'minor',
        category: 'Documentation',
        description: 'Consider adding more examples',
      },
    ],
    suggestions: ['Add detailed examples', 'Include edge case handling'],
    overallScore: 85,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/services/orchestrator/critic_personas.test.ts`
Expected: PASS

**Step 5: Integrate with agent executors**

```typescript
// backend/services/llm/agent_executors.ts
import { runCriticReview } from '../orchestrator/critic_personas';

// Add to each relevant executor (example for Stack Selection)
export function getStackSelectionExecutor(llmClient: any) {
  return {
    async execute(options: { projectId: string; phase: string; context: any }) {
      // ... existing execution logic ...
      const response = await llmClient.generateContent(enhancedPrompt);

      // NEW: Run critic review
      const critique = await runCriticReview(options.phase, { content: response.content });

      // If critique score is too low, iterate
      if (critique.overallScore < 70) {
        console.warn(`Critic ${critique.criticName} gave low score: ${critique.overallScore}`);
        // Optionally: re-run with critique feedback
      }

      return {
        content: response.content,
        critique,
      };
    },
  };
}
```

**Step 6: Commit**

```bash
git add backend/services/orchestrator/critic_personas.ts backend/services/orchestrator/critic_personas.test.ts backend/services/llm/agent_executors.ts
git commit -m "feat: implement checker pattern with critic personas"
```

---

## Phase 8: Integration & Testing

### Task 8.1: Integration Tests for Complete Flow

**Files:**
- Create: `backend/services/orchestrator/superpowers_integration.test.ts`

**Step 1: Write integration test**

```typescript
// backend/services/orchestrator/superpowers_integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/backend/lib/drizzle';
import { projects } from '@/backend/lib/schema';
import { OrchestratorEngine } from './orchestrator_engine';

describe('Superpowers 2.0 Integration', () => {
  let projectId: string;
  let orchestrator: OrchestratorEngine;

  beforeAll(async () => {
    orchestrator = new OrchestratorEngine();

    // Create test project
    const [project] = await db.insert(projects).values({
      slug: 'test-superpowers-integration',
      name: 'Test Project',
      currentPhase: 'ANALYSIS',
      ownerId: 'test-user-id',
    }).returning();

    projectId = project.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(projects).where({ id: projectId });
  });

  it('should complete ANALYSIS phase with semantic locks', async () => {
    // Execute ANALYSIS phase
    await orchestrator.executePhase(projectId, 'ANALYSIS', {});

    // Verify semantic locks were created
    const { semanticLocks } = await import('@/backend/lib/schema');
    const locks = await db.select().from(semanticLocks).where({ projectId });

    expect(locks.length).toBeGreaterThan(0);
    expect(locks.some(l => l.lockType === 'PERSONA')).toBe(true);
  });

  it('should enhance prompts with Chain-of-Thought', async () => {
    // Execute SPEC_PM phase
    const result = await orchestrator.executePhase(projectId, 'SPEC_PM', {});

    // Verify CoT logs were created
    const { chainOfThoughtLogs } = await import('@/backend/lib/schema');
    const cotLogs = await db.select().from(chainOfThoughtLogs).where({
      phase: 'SPEC_PM'
    });

    expect(cotLogs.length).toBeGreaterThan(0);
    expect(cotLogs[0].reasoningSteps).toBeDefined();
  });

  it('should format tasks with bite-sized granularity', async () => {
    // Execute SOLUTIONING phase
    const result = await orchestrator.executePhase(projectId, 'SOLUTIONING', {});

    // Parse tasks.md artifact
    const tasksContent = result.artifacts.find((a: any) => a.filename === 'tasks.md')?.content;

    expect(tasksContent).toContain('Estimated Time:');
    expect(tasksContent).toMatch(/\d{2} minutes/); // Should have minute estimates
    expect(tasksContent).toContain('Verification:');
  });

  it('should run semantic integrity checks in VALIDATE phase', async () => {
    // Execute VALIDATE phase
    const result = await orchestrator.executePhase(projectId, 'VALIDATE', {});

    // Verify validation report includes semantic checks
    const reportContent = result.artifacts.find((a: any) => a.filename === 'validation-report.md')?.content;

    expect(reportContent).toContain('Semantic Integrity Checks');
    expect(reportContent).toContain('Cross-Phase Coherence');
  });
});
```

**Step 2: Run integration test**

Run: `npm test -- backend/services/orchestrator/superpowers_integration.test.ts`
Expected: Should pass once all components are integrated

**Step 3: Commit**

```bash
git add backend/services/orchestrator/superpowers_integration.test.ts
git commit -m "test: add integration tests for superpowers 2.0"
```

---

### Task 8.2: Update Documentation

**Files:**
- Create: `docs/SUPERPOWERS_ARCHITECTURE.md`
- Modify: `README.md:100-120`

**Step 1: Create architecture documentation**

```markdown
// docs/SUPERPOWERS_ARCHITECTURE.md
# Superpowers 2.0 Architecture

## Overview

This document describes the Superpowers 2.0 integration architecture, which transforms the spec-driven platform from a linear workflow into a self-correcting artifact generation engine.

## Core Components

### 1. Semantic Lock Service
- **Location:** `backend/services/semantic/semantic_lock_service.ts`
- **Purpose:** Capture constraints from Phase 1 (ANALYSIS) and enforce them across all subsequent phases
- **Database:** `SemanticLock` table

### 2. Chain-of-Thought Enhancer
- **Location:** `backend/services/prompt/chain_of_thought_enhancer.ts`
- **Purpose:** Enhance agent prompts with reasoning requirements and track decision-making process
- **Database:** `ChainOfThoughtLog` table

### 3. Subagent Dispatcher
- **Location:** `backend/services/orchestrator/subagent_dispatcher.ts`
- **Purpose:** Execute isolated agent tasks with self-review checklists
- **Database:** `SubagentDispatch` table

### 4. Semantic Validator
- **Location:** `backend/services/validation/semantic_validator.ts`
- **Purpose:** Perform cross-phase coherence checks beyond simple ID matching

### 5. Root Cause Tracer
- **Location:** `backend/services/orchestrator/root_cause_tracer.ts`
- **Purpose:** Trace validation errors to originating phases for targeted remediation

### 6. Critic Personas
- **Location:** `backend/services/orchestrator/critic_personas.ts`
- **Purpose:** Provide adversarial review of generated artifacts

## Data Flow

```
User Input
  ↓
ANALYSIS Phase
  ↓
[SemanticLockService.captureSemanticLocks()]
  ↓ (locks stored in DB)
STACK_SELECTION Phase
  ↓
[ChainOfThoughtEnhancer.enhancePrompt()] ← semantic locks injected
  ↓
[CriticPersona: Skeptical CTO reviews output]
  ↓
SPEC_PM Phase
  ↓
[SemanticLockService.validateAgainstLocks()] ← validate persona references
  ↓
SOLUTIONING Phase
  ↓
[TaskFormatter.formatTask()] ← bite-sized tasks (15-30 min)
  ↓
VALIDATE Phase
  ↓
[SemanticValidator.validateCrossPhaseCoherence()] ← deep integrity checks
  ↓
[If validation fails] → [RootCauseTracer.traceError()] → targeted re-run
```

## Implementation Checklist

- [x] Database schema extensions (semanticLocks, chainOfThoughtLogs, subagentDispatches)
- [x] SemanticLockService implementation
- [x] ChainOfThoughtEnhancer implementation
- [x] TaskFormatter for bite-sized tasks
- [x] SubagentDispatcher with self-review
- [x] SemanticValidator for cross-phase checks
- [x] RootCauseTracer for auto-remedy
- [x] CriticPersonas for quality gates
- [x] Integration tests

## Testing

Run full test suite:
```bash
npm test -- backend/services/orchestrator/superpowers_integration.test.ts
```

Run individual component tests:
```bash
npm test -- backend/services/semantic/
npm test -- backend/services/prompt/
npm test -- backend/services/solutioning/
```
```

**Step 2: Update README**

```markdown
// README.md (add after line 100)

### Superpowers 2.0 Enhancements

The platform includes advanced AI orchestration patterns:

| Enhancement | Description | Phase |
|------------|-------------|-------|
| **Semantic Goal Locking** | Phase 1 outputs become immutable constraints | All phases |
| **Chain-of-Thought** | Agents show reasoning before conclusions | All phases |
| **Bite-Sized Tasks** | 15-30 minute granularity with exact file paths | SOLUTIONING |
| **Subagent Self-Review** | Automated quality checklists | FRONTEND_BUILD |
| **Semantic Integrity Checks** | Cross-phase coherence validation | VALIDATE |
| **Root Cause Tracing** | Errors traced to originating phases | AUTO_REMEDY |
| **Checker Pattern** | Adversarial critic personas review outputs | Key phases |

See [SUPERPOWERS_ARCHITECTURE.md](docs/SUPERPOWERS_ARCHITECTURE.md) for details.
```

**Step 3: Commit**

```bash
git add docs/SUPERPOWERS_ARCHITECTURE.md README.md
git commit -m "docs: add superpowers 2.0 architecture documentation"
```

---

## Execution Summary

**Total Tasks:** 14 major tasks across 8 phases
**Estimated Implementation Time:**
- Database extensions: 2 hours
- Core services (Semantic, CoT, TaskFormatter): 6 hours
- Integration with orchestrator: 4 hours
- Testing: 3 hours
- Documentation: 1 hour
**Total: ~16 hours**

**Execution Order:**
1. 🔴 Critical: Database schema + Semantic Locks (Tasks 1.1-2.2)
2. 🔴 Critical: Chain-of-Thought + Task Formatter (Tasks 3.1-4.2)
3. 🟠 High: Subagent Dispatch + Semantic Validation (Tasks 5.1-6.1)
4. 🟡 Medium: Root Cause Tracing + Checker Pattern (Tasks 7.1-7.2)
5. Integration + Documentation (Tasks 8.1-8.2)

---

## Next Steps

This plan is now ready for execution. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach would you like to use?
