# Phase 3 Architecture: Performance & Specialization

**Created:** January 1, 2026
**Focus:** Parallel Execution, Design Agent, Smart Regeneration
**Timeline:** Weeks 5-6
**Priority:** 🟢 MEDIUM

---

## 📋 Overview

Phase 3 introduces performance optimizations and specialized agent capabilities:

1. **Parallel Phase Execution** - Execute independent phases concurrently to reduce workflow time by 31%
2. **Dedicated Design Agent** - Specialized UI/UX designer for consistent design system
3. **Smart Artifact Regeneration** - Impact analysis and intelligent regeneration workflow

---

## 🏗️ Component Architecture

### New Components

#### 1. Parallel Execution Engine
**File:** `backend/services/orchestrator/parallel_execution.ts`

**Responsibilities:**
- Manage execution wave logic (7 waves total)
- Coordinate parallel phase runs
- Validate dependencies before starting waves
- Measure execution time (for metrics)
- Handle parallel phase failures

**Key Methods:**
```typescript
class ParallelExecutionEngine {
  executeWaves(projectId: string, phases: Phase[]): Promise<WaveExecutionResult[]>
  validateWaveDependencies(wave: Wave, completedPhases: string[]): boolean
  measureSequentialTime(waves: Wave[]): number
  calculateTimeSavings(sequentialTime: number, parallelTime: number): TimeSavings
}
```

**Waves:**
- `wave_1_sequential`: ANALYSIS (foundation)
- `wave_2_parallel`: STACK_SELECTION + SPEC_DESIGN_TOKENS
- `wave_3_sequential`: SPEC_PM (requirements first)
- `wave_3b_parallel`: SPEC_ARCHITECT + SPEC_DESIGN_COMPONENTS
- `wave_4_parallel`: DEPENDENCIES + SOLUTIONING_EPICS
- `wave_5_sequential`: SOLUTIONING_TASKS
- `wave_6_sequential`: VALIDATE
- `wave_7_sequential`: DONE

---

#### 2. Design Agent Executor
**File:** `backend/services/llm/agent_executors.ts` (add `getDesignerExecutor()`)

**Role:** UI/UX Designer and Design Systems Architect
**Perspective:** Head of Design

**Responsibilities:**
- Generate stack-agnostic design tokens
- Create interaction patterns (journey maps)
- Map tokens to component inventory (post-stack)
- Enforce anti-AI-slop principles

**Key Methods:**
```typescript
function getDesignerExecutor(config: AgentConfig): AgentExecutor {
  return {
    role: 'designer',
    perspective: 'head_of_design',
    expertise: ['ui_ux_design', 'design_systems', 'accessibility', 'color_theory'],
    generateArtifacts: async (context) => {
      // SPEC_DESIGN_TOKENS (stack-agnostic)
      const designTokens = await generateDesignTokens(context);
      
      // SPEC_DESIGN_COMPONENTS (requires stack)
      if (context.phase === 'SPEC_DESIGN_COMPONENTS') {
        const componentMapping = await mapTokensToComponents(context);
        const journeyMaps = await generateJourneyMaps(context);
      }
    },
    validateArtifacts: (artifacts) => validateAntiAISlop(artifacts)
  };
}
```

**Generated Artifacts:**
- `design-tokens.md` (stack-agnostic)
  - OKLCH color system (60/30/10 rule)
  - 8pt grid system
  - 4 typography sizes
  - Animation tokens
- `component-mapping.md` (post-stack)
  - Map design tokens to stack components
  - shadcn component references
- `journey-maps.md`
  - User interaction patterns
  - Flow diagrams (Mermaid)

**Anti-AI-Slop Validation:**
- ❌ Forbidden: purple gradients, Inter font default, blob backgrounds
- ✅ Required: OKLCH colors, 60/30/10 rule, 8pt grid, 4 typography sizes

---

#### 3. Artifact Change Detector
**File:** `backend/services/artifacts/change_detector.ts`

**Responsibilities:**
- Monitor artifact files for changes
- Calculate content hashes (SHA-256)
- Detect user edits between versions
- Maintain version history
- Track section-level changes

**Key Methods:**
```typescript
class ArtifactChangeDetector {
  detectChanges(projectId: string, artifactId: string): Promise<ChangeDetectionResult>
  calculateContentHash(content: string): string
  compareArtifacts(oldContent: string, newContent: string): SectionChange[]
  trackChange(change: ArtifactChange): Promise<void>
  getChangeHistory(artifactId: string, options: PaginationOptions): Promise<ArtifactChange[]>
}
```

**Change Detection Logic:**
```typescript
interface ChangeDetectionResult {
  hasChanged: boolean;
  oldContentHash: string;
  newContentHash: string;
  sectionsChanged: SectionChange[];
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  changedBy: 'user' | 'system';
  changedAt: Date;
}

interface SectionChange {
  sectionName: string;
  oldContent?: string;
  newContent?: string;
  changeType: 'added' | 'modified' | 'deleted';
}
```

---

#### 4. Impact Analyzer
**File:** `backend/services/artifacts/impact_analyzer.ts`

**Responsibilities:**
- Parse dependency graph for affected artifacts
- Determine impact level for each affected artifact
- Provide regeneration recommendations
- Track transitive dependencies

**Key Methods:**
```typescript
class ImpactAnalyzer {
  analyzeImpact(triggerChange: ArtifactChange): Promise<ImpactAnalysis>
  determineAffectedArtifacts(artifactId: string): Promise<string[]>
  calculateImpactLevel(change: SectionChange, affectedArtifactId: string): ImpactLevel
  getRegenerationRecommendations(impactAnalysis: ImpactAnalysis): RegenerationRecommendation[]
}

interface ImpactAnalysis {
  triggerChange: ArtifactChange;
  affectedArtifacts: AffectedArtifact[];
  regenerationStrategy: RegenerationStrategy;
  estimatedDurationMs: number;
}

interface AffectedArtifact {
  artifactId: string;
  artifactName: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  dependencies: string[];
}

enum ImpactLevel {
  HIGH = 'requirements_added_removed',
  MEDIUM = 'requirements_modified',
  LOW = 'cosmetic_changes'
}
```

**Impact Level Logic:**
- **HIGH**: Requirements added/removed in PRD or architecture (affects many downstream artifacts)
- **MEDIUM**: Requirements modified (affects dependent artifacts but not structural)
- **LOW**: Cosmetic changes (typos, formatting - minimal impact)

---

#### 5. Regeneration Orchestrator
**File:** `backend/services/artifacts/regeneration_orchestrator.ts`

**Responsibilities:**
- Manage regeneration workflows
- Coordinate with Impact Analyzer
- Handle user choice workflow
- Integrate with OrchestratorEngine
- Track regeneration runs

**Key Methods:**
```typescript
class RegenerationOrchestrator {
  initiateRegeneration(projectId: string, options: RegenerationOptions): Promise<RegenerationRun>
  executeRegeneration(runId: string): Promise<RegenerationResult>
  selectArtifactsToRegenerate(impactAnalysis: ImpactAnalysis, strategy: RegenerationStrategy): string[]
  coordinateWithOrchestratorEngine(artifactIds: string[]): Promise<void>
}

interface RegenerationOptions {
  triggerChangeId: string;
  strategy: 'regenerate_all' | 'high_impact_only' | 'manual_review' | 'ignore';
  artifactIds?: string[]; // for manual_review
  userId?: string;
}

interface RegenerationRun {
  id: string;
  projectId: string;
  triggerChangeId: string;
  impactAnalysis: ImpactAnalysis;
  selectedStrategy: RegenerationStrategy;
  artifactsToRegenerate: string[];
  artifactsRegenerated: string[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  success: boolean;
}
```

**User Choice Workflow:**
1. User edits artifact
2. Change Detector detects change
3. Impact Analyzer determines impact
4. Regeneration Orchestrator shows modal with options:
   - "Regenerate All" (safest)
   - "Regenerate Only High Impact" (balanced)
   - "Manual Review" (user control)
   - "Ignore" (risky, requires confirmation)
5. User selects strategy
6. Regeneration Orchestrator executes workflow

---

## 🔗 Integration Points

### Parallel Execution Engine → OrchestratorEngine
```typescript
// In OrchestratorEngine
import { ParallelExecutionEngine } from './parallel_execution';

class OrchestratorEngine {
  private parallelEngine: ParallelExecutionEngine;

  async runWorkflow(projectId: string, options: WorkflowOptions): Promise<WorkflowResult> {
    // Check if parallel mode enabled
    if (options.enableParallelExecution) {
      return await this.parallelEngine.executeWaves(projectId, this.phases);
    } else {
      // Fall back to sequential execution
      return await this.executeSequential(projectId, this.phases);
    }
  }
}
```

### Design Agent → OrchestratorEngine
```typescript
// In agent_executors.ts
export function getDesignerExecutor(config: AgentConfig): AgentExecutor {
  return {
    role: 'designer',
    // ... (see Design Agent section above)
  };
}

// In OrchestratorEngine
import { getDesignerExecutor } from './agent_executors';

this.phaseExecutors = {
  SPEC_DESIGN_TOKENS: getDesignerExecutor({ perspective: 'head_of_design' }),
  SPEC_DESIGN_COMPONENTS: getDesignerExecutor({ perspective: 'head_of_design' }),
  // ... other executors
};
```

### Smart Regeneration → OrchestratorEngine
```typescript
// In Regeneration Orchestrator
async coordinateWithOrchestratorEngine(artifactIds: string[]): Promise<void> {
  // For each artifact to regenerate, call OrchestratorEngine.runPhaseAgent
  for (const artifactId of artifactIds) {
    const phase = this.getPhaseForArtifact(artifactId);
    await this.orchestratorEngine.runPhaseAgent(this.projectId, phase, {
      regenerateArtifact: artifactId
    });
  }
}
```

### All New Components → Existing Systems

**Integration with Validation System (Phase 1):**
- Parallel Execution: Validate each phase before starting next wave
- Smart Regeneration: Validate regenerated artifacts
- Design Agent: Anti-AI-slop validation as inline validators

**Integration with Rollback System (Phase 2):**
- Parallel Execution: Create snapshots after each wave completes
- Smart Regeneration: Create snapshot before regeneration
- Design Agent: Create snapshot after design phases

**Integration with Git System (Phase 2):**
- Parallel Execution: Commit artifacts after each wave (or after all waves in wave complete)
- Smart Regeneration: Create fixup commits for regenerated artifacts
- Design Agent: Commit design tokens and mapping

**Integration with Approval Gates (Phase 2):**
- Parallel Execution: Check gates after phases that have gates
- Design Agent: No gates required (non-critical phase)
- Smart Regeneration: Re-approve gates if regenerated artifacts affect approval status

---

## 🗄️ Database Schema

### New Tables

#### 1. artifact_changes
**Purpose:** Track user artifact edits and system changes

```typescript
{
  id: string (UUID, pk)
  projectId: string (fk)
  artifactId: string (fk to artifact_versions)
  artifactName: string
  oldContentHash: string (SHA-256)
  newContentHash: string (SHA-256)
  changedBy: string (userId or 'system')
  changedAt: timestamp
  sectionsChanged: json (array of SectionChange objects)
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  detectedAt: timestamp
}
```

**Indexes:**
- `idx_artifact_changes_project_id` on projectId
- `idx_artifact_changes_artifact_id` on artifactId
- `idx_artifact_changes_changed_at` on changedAt

---

#### 2. regeneration_runs
**Purpose:** Track regeneration workflows and strategies

```typescript
{
  id: string (UUID, pk)
  projectId: string (fk)
  triggerArtifactId: string
  triggerChangeId: string (fk to artifact_changes)
  impactAnalysis: json (ImpactAnalysis object)
  selectedStrategy: 'regenerate_all' | 'high_impact_only' | 'manual_review' | 'ignore'
  artifactsToRegenerate: json (array of artifact IDs)
  artifactsRegenerated: json (array of regenerated artifact IDs)
  startedAt: timestamp
  completedAt: timestamp (nullable)
  durationMs: number (nullable)
  success: boolean (nullable)
  errorMessage: string (nullable)
}
```

**Indexes:**
- `idx_regeneration_runs_project_id` on projectId
- `idx_regeneration_runs_trigger_change_id` on triggerChangeId
- `idx_regeneration_runs_started_at` on startedAt

---

#### 3. parallel_execution_runs
**Purpose:** Track parallel wave execution and performance metrics

```typescript
{
  id: string (UUID, pk)
  projectId: string (fk)
  waveNumber: number
  phasesInWave: json (array of phase names)
  startedAt: timestamp
  completedAt: timestamp
  durationMs: number
  sequentialDurationMs: number (estimated if sequential)
  timeSavedMs: number
  phasesCompleted: json (array of completed phase names)
  phasesFailed: json (array of failed phase names and errors)
}
```

**Indexes:**
- `idx_parallel_execution_runs_project_id` on projectId
- `idx_parallel_execution_runs_wave_number` on waveNumber
- `idx_parallel_execution_runs_started_at` on startedAt

---

## 🌐 API Endpoints

### Smart Artifact Regeneration Endpoints

#### 1. GET /api/projects/[slug]/artifacts/[artifactId]/changes
**Purpose:** Get change history for an artifact

**Query Parameters:**
- `limit`: number (default: 10)
- `offset`: number (default: 0)

**Response:**
```typescript
{
  success: true,
  data: {
    changes: ArtifactChange[],
    total: number,
    limit: number,
    offset: number
  }
}
```

---

#### 2. GET /api/projects/[slug]/artifacts/[artifactId]/impact-analysis
**Purpose:** Get impact analysis for recent changes

**Query Parameters:**
- `changeId`: string (UUID) - analyze specific change
- (if not provided, use latest change)

**Response:**
```typescript
{
  success: true,
  data: {
    triggerChange: ArtifactChange,
    affectedArtifacts: AffectedArtifact[],
    impactSummary: {
      high: number,
      medium: number,
      low: number
    },
    regenerationStrategy: 'regenerate_all' | 'high_impact_only',
    recommendedAction: string,
    estimatedDurationMs: number
  }
}
```

---

#### 3. POST /api/projects/[slug]/artifacts/regenerate
**Purpose:** Trigger regeneration workflow

**Request Body:**
```typescript
{
  changeId: string,
  strategy: 'regenerate_all' | 'high_impact_only' | 'manual_review' | 'ignore',
  artifactIds?: string[] // required if strategy is 'manual_review',
  userId?: string
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    regenerationRunId: string,
    estimatedDurationMs: number,
    artifactsToRegenerate: string[],
    status: 'queued' | 'running' | 'completed' | 'failed'
  }
}
```

---

#### 4. GET /api/projects/[slug]/regeneration-runs
**Purpose:** Get regeneration history for project

**Query Parameters:**
- `limit`: number (default: 20)
- `offset`: number (default: 0)

**Response:**
```typescript
{
  success: true,
  data: {
    runs: RegenerationRun[],
    total: number,
    limit: number,
    offset: number
  }
}
```

---

#### 5. GET /api/projects/[slug]/regeneration-runs/[runId]
**Purpose:** Get regeneration run details

**Response:**
```typescript
{
  success: true,
  data: RegenerationRun
}
```

---

### Parallel Execution Metrics Endpoints

#### 6. GET /api/projects/[slug]/execution-metrics
**Purpose:** Get performance metrics for project

**Query Parameters:**
- `startDate`: timestamp (optional)
- `endDate`: timestamp (optional)

**Response:**
```typescript
{
  success: true,
  data: {
    sequentialDurationMs: number,
    parallelDurationMs: number,
    timeSavedMs: number,
    timeSavedPercent: number,
    waveBreakdown: {
      waveNumber: number,
      durationMs: number,
      phasesInWave: string[],
      parallelPhases: string[],
      sequentialPhases: string[]
    }[],
    runsAnalyzed: number
  }
}
```

---

## 🧪 Test Strategy

### Unit Tests

#### Parallel Execution Engine (8-10 tests)
```typescript
describe('ParallelExecutionEngine', () => {
  it('should execute wave 1 sequentially (ANALYSIS)')
  it('should execute wave 2 in parallel (STACK_SELECTION + SPEC_DESIGN_TOKENS)')
  it('should validate wave dependencies before execution')
  it('should handle phase failures in parallel execution')
  it('should measure execution time accurately')
  it('should calculate time savings correctly')
  it('should fall back to sequential if parallel execution fails')
  it('should create snapshot after each wave')
})
```

#### Design Agent Executor (4-5 tests)
```typescript
describe('Design Agent Executor', () => {
  it('should generate stack-agnostic design tokens')
  it('should map tokens to components after stack selection')
  it('should generate journey maps with interaction patterns')
  it('should validate anti-AI-slop principles')
  it('should enforce required design rules (OKLCH, 8pt grid, etc.)')
})
```

#### Artifact Change Detector (6-8 tests)
```typescript
describe('ArtifactChangeDetector', () => {
  it('should detect content changes via hash comparison')
  it('should track section-level changes')
  it('should calculate SHA-256 hash correctly')
  it('should maintain change history')
  it('should identify changed by user vs system')
  it('should assign impact level based on change type')
})
```

#### Impact Analyzer (8-10 tests)
```typescript
describe('ImpactAnalyzer', () => {
  it('should parse dependency graph correctly')
  it('should determine affected artifacts for a change')
  it('should assign HIGH impact for requirements added/removed')
  it('should assign MEDIUM impact for requirements modified')
  it('should assign LOW impact for cosmetic changes')
  it('should track transitive dependencies')
  it('should handle circular dependencies gracefully')
  it('should provide regeneration recommendations')
})
```

#### Regeneration Orchestrator (10-12 tests)
```typescript
describe('RegenerationOrchestrator', () => {
  it('should coordinate impact analysis workflow')
  it('should select artifacts based on strategy (regenerate_all)')
  it('should select artifacts based on strategy (high_impact_only)')
  it('should select artifacts based on strategy (manual_review)')
  it('should coordinate with OrchestratorEngine for regeneration')
  it('should track regeneration run progress')
  it('should handle regeneration failures gracefully')
  it('should validate regenerated artifacts')
  it('should create snapshot before regeneration')
  it('should integrate with Git for fixup commits')
})
```

**Total Unit Tests:** 36-45 tests

---

### Integration Tests

#### Parallel Execution + OrchestratorEngine (4-5 tests)
```typescript
describe('Parallel Execution Integration', () => {
  it('should execute full workflow in waves')
  it('should preserve phase ordering with dependencies')
  it('should integrate with Git commits (parallel waves)')
  it('should integrate with rollback (snapshots per wave)')
  it('should measure and report time savings')
})
```

#### Smart Regeneration Workflow (6-8 tests)
```typescript
describe('Smart Regeneration Integration', () => {
  it('should complete workflow: edit → detect → analyze → regenerate')
  it('should integrate with validation system')
  it('should integrate with rollback system')
  it('should integrate with Git system (fixup commits)')
  it('should show impact analysis modal to user')
  it('should handle user choice workflow correctly')
  it('should track regeneration runs in database')
})
```

#### Design Agent Integration (3-4 tests)
```typescript
describe('Design Agent Integration', () => {
  it('should generate design tokens in SPEC_DESIGN_TOKENS phase')
  it('should map components in SPEC_DESIGN_COMPONENTS phase')
  it('should integrate with other SPEC phases (PRD, architecture)')
  it('should enforce anti-AI-slop validation')
})
```

**Total Integration Tests:** 13-17 tests

---

### E2E Tests

#### Parallel Performance Measurement (2-3 tests)
```typescript
describe('Parallel Performance E2E', () => {
  it('should complete workflow faster in parallel mode (target: 31% reduction)')
  it('should execute waves in correct order')
  it('should report accurate performance metrics')
})
```

#### Smart Regeneration UX (3-4 tests)
```typescript
describe('Smart Regeneration UX E2E', () => {
  it('should show impact analysis after editing artifact')
  it('should allow user to select regeneration strategy')
  it('should regenerate correct artifacts based on selection')
  it('should notify user of regeneration completion')
})
```

**Total E2E Tests:** 5-7 tests

---

## 📊 Expected Outcomes

### Performance Metrics

| Metric | Baseline | Target |
|---------|----------|--------|
| Workflow Completion Time | ~30 min | <15 min (50% reduction, better than 31%) |
| Regeneration Time | N/A | <5 min for typical change |
| Design Artifact Quality | Variable | Consistent (anti-AI-slop enforced) |

### Success Criteria (from ENHANCEMENT_TASKS.md)
- ✅ Workflow completion time reduced by 30%
- ✅ Design artifacts generated by specialized agent
- ✅ Editing PRD shows impact analysis

---

## 🚫 Anti-Patterns to Avoid

- ❌ Do NOT parallelize phases with strict dependencies
- ❌ Do NOT skip impact analysis (always show user choice)
- ❌ Do NOT allow "Ignore" strategy without confirmation for HIGH impact changes
- ❌ Do NOT break existing agent patterns (follow existing structure)
- ❌ Do NOT introduce race conditions in parallel execution

---

## ✅ Core Strengths to Preserve

- ✅ Constitutional Articles (governance model)
- ✅ Hybrid Clarification Mode (speed + control balance)
- ✅ Test-First Discipline (strict enforcement)
- ✅ Anti-AI-Slop Design (market differentiator)
- ✅ Intelligent Defaults (expand to more areas)
- ✅ Phase 1 & 2 foundations (validation, rollback, git, approval gates)

---

## 📝 Implementation Order (Weeks 5-6)

### Week 5: Lower Complexity Features
**Days 1-2:** Enhancement #6 - Dedicated Design Agent
- Create designer agent executor
- Implement artifact generation logic
- Add anti-AI-slop validation
- Split SPEC_DESIGN into two sub-phases
- Tests: unit (5) + integration (4) = 9 tests

**Days 3-5:** Enhancement #8 - Smart Artifact Regeneration
- Implement Artifact Change Detector
- Implement Impact Analyzer
- Implement Regeneration Orchestrator
- Create API endpoints (5 endpoints)
- Create database tables (2 tables: artifact_changes, regeneration_runs)
- Tests: unit (36) + integration (8) + E2E (4) = 48 tests

### Week 6: High Complexity Feature
**Days 1-5:** Enhancement #5 - Parallel Phase Execution
- Implement Parallel Execution Engine
- Create execution wave logic (7 waves)
- Update phase dependencies (SPEC_ARCHITECT depends on SPEC_PM)
- Integrate with OrchestratorEngine
- Create performance metrics endpoint
- Create database table (1 table: parallel_execution_runs)
- Tests: unit (10) + integration (5) + E2E (3) = 18 tests

---

## 📦 Deliverables Summary

**New Files:** ~15 files
- Services: 5 new files
- API routes: 6 new route files
- Tests: 4 new test files
- Database: 3 new migration files

**Code Added:** ~2,000 lines
- Services: ~800 lines
- API routes: ~600 lines
- Tests: ~600 lines

**Tests Added:** ~75 tests
- Unit: 36-45 tests
- Integration: 13-17 tests
- E2E: 5-7 tests

**Database Tables:** 3 new tables
- artifact_changes
- regeneration_runs
- parallel_execution_runs

**API Endpoints:** 6 new endpoints
- Smart regeneration: 5 endpoints
- Parallel metrics: 1 endpoint

---

**Document Version:** 1.0
**Last Updated:** January 1, 2026
**Status:** Ready for Implementation
