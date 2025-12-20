# Stack Selection & Dependencies Phase Improvement Plan

## Executive Summary

Transform the STACK_SELECTION and DEPENDENCIES phases from template-driven to AI-driven with intelligent defaults, while maintaining transparency and user control. Remove the redundant dependencies approval gate to streamline the workflow.

## User Preferences (from clarification)

- **Stack Selection**: AI suggests optimal stack but shows 2-3 relevant templates as alternatives
- **Dependencies**: Auto-generate without approval gate (stack approval implies dependency approval)
- **Defaults**: Intelligent defaults based on project type (web → Next.js+Bun, mobile → Expo+Supabase, etc.)

---

## ⚠️ ERRATA & KNOWN GAPS (Review Findings)

> [!CAUTION]
> This section documents critical gaps identified during code review. These MUST be addressed before implementation.

### Severity Legend

- 🔴 **HIGH**: Will cause build failures, runtime errors, or broken workflows
- 🟡 **MEDIUM**: Inconsistencies that cause confusion or partial failures
- 🟢 **LOW**: Documentation/style issues

---

### 🔴 HIGH: Removing `dependencies_approved` Gate is Under-Scoped

**Problem**: The plan only mentions DB column, endpoint, and UI removal, but the gate is wired through **15+ files** across backend services, orchestrator logic, API payloads, dashboard, and tests.

**Complete File Audit** (all files requiring updates):

| Category                | File                                                        | Lines Affected                                                                |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Database Schema**     | `backend/lib/schema.ts`                                     | L16 (`dependenciesApproved` column)                                           |
| **Database Schema**     | `drizzle/meta/0000_snapshot.json`                           | L537-538                                                                      |
| **Orchestrator Spec**   | `orchestrator_spec.yml`                                     | L192 (gates), L194 (validators), L2152-2156 (validator def), L2555 (defaults) |
| **Config Loader**       | `backend/services/orchestrator/config_loader.ts`            | L134, L136, L343-346, L420                                                    |
| **Orchestrator Engine** | `backend/services/orchestrator/orchestrator_engine.ts`      | L920-921 (`isGatePassed`)                                                     |
| **DB Service**          | `backend/services/database/drizzle_project_db_service.ts`   | L425                                                                          |
| **Projects Service**    | `backend/services/projects/projects_service.ts`             | L23, L64, L110, L172, L303                                                    |
| **Project Storage**     | `backend/services/file_system/project_storage.ts`           | L70                                                                           |
| **Project Utils**       | `src/app/api/lib/project-utils.ts`                          | L25, L126, L442                                                               |
| **Main Project Page**   | `src/app/project/[slug]/page.tsx`                           | L42, L122, L416, L422, L847, L855, L1141, L1412                               |
| **Phase Status Utils**  | `src/utils/phase-status.ts`                                 | L22, L40-41, L122, L132                                                       |
| **Revert Phase API**    | `src/app/api/projects/[slug]/revert-phase/route.ts`         | L143, L164                                                                    |
| **Execute Phase API**   | `src/app/api/projects/[slug]/execute-phase/route.ts`        | L122                                                                          |
| **Reset API**           | `src/app/api/projects/[slug]/reset/route.ts`                | L107, L119                                                                    |
| **Approve Deps API**    | `src/app/api/projects/[slug]/approve-dependencies/route.ts` | L400, L426 (DELETE entire file)                                               |
| **Projects List API**   | `src/app/api/projects/route.ts`                             | Multiple lines                                                                |
| **Admin Dashboard**     | `src/app/admin/projects/page.tsx`                           | L24, L181-183                                                                 |
| **Tests**               | `src/app/api/__tests__/projects.test.ts`                    | L85                                                                           |
| **Tests**               | `src/app/api/__tests__/error-handling.test.ts`              | L68                                                                           |
| **Tests**               | `src/app/api/__tests__/approval-gates.test.ts`              | L56                                                                           |
| **Tests**               | `src/app/api/__tests__/integration.test.ts`                 | L74, L277, L311                                                               |
| **Migration Helper**    | `backend/lib/migration_helper.ts`                           | L95                                                                           |

**Also remove/deprecate**:

- `dependencyApprovals` table in schema.ts (L81-89)
- `dependencyApprovalsRelations` (L210-215)
- Type export: `DependencyApproval` (L243)

---

### 🔴 HIGH: `stack-analysis.md` Replacing `stack-proposal.md` Breaks Artifact Expectations

**Status**: ✅ DECISION MADE - **Use `stack-analysis.md` as the new artifact name**

**Migration Strategy** (Explicit Decision):

1. ✅ **CHOSEN**: Rename `stack-proposal.md` → `stack-analysis.md` in ALL 12 files listed below
2. Update all file references during Phase 1 implementation

**Complete File Audit** (all files requiring updates):

| Category               | File                                                 | Lines Affected                                       |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Orchestrator Spec**  | `orchestrator_spec.yml`                              | L134 (outputs), L1022-1024 (architect prompt), L2442 |
| **Config Loader**      | `backend/services/orchestrator/config_loader.ts`     | L109                                                 |
| **Artifact Manager**   | `backend/services/orchestrator/artifact_manager.ts`  | L255                                                 |
| **Validators**         | `backend/services/orchestrator/validators.ts`        | L1713                                                |
| **Agent Executors**    | `backend/services/llm/agent_executors.ts`            | L246, L277                                           |
| **Handoff Generator**  | `backend/services/file_system/handoff_generator.ts`  | L110, L232, L372                                     |
| **Archiver**           | `backend/services/file_system/archiver.ts`           | L272, L398, L473                                     |
| **Phase Route API**    | `src/app/api/projects/[slug]/phase/route.ts`         | L13                                                  |
| **Approve Stack API**  | `src/app/api/projects/[slug]/approve-stack/route.ts` | L385, L399                                           |
| **Main Project Page**  | `src/app/project/[slug]/page.tsx`                    | L1399                                                |
| **Phase Status Utils** | `src/utils/phase-status.ts`                          | L31                                                  |
| **Lib Config**         | `src/lib/config.ts`                                  | L39                                                  |

> [!IMPORTANT]
> All 12 files listed above MUST be updated in Phase 1 before testing. Add this as a checklist item in the implementation order.

---

### 🔴 HIGH: ~~Proposed Orchestrator Spec Uses Different Schema Than Loader Expects~~

**Status**: ✅ RESOLVED - Plan now uses current schema format (string arrays)

> **Historical Note**: The original plan proposed object-style outputs/gates. This was changed to match the existing schema to avoid `config_loader.ts` modifications. No action required.

---

### 🔴 HIGH: ~~Missing `dependency_quality` Validator Definition~~

**Status**: ✅ DECISION MADE - **Defer `dependency_quality` validator to Phase 5 (Testing)**

The current `presence` and `dependencies_json_check` validators are sufficient for initial implementation. The quality checks (version pinning, vulnerability scanning, license compliance) are documented in the DevOps prompt and will be enforced by the LLM during generation.

**Future Enhancement** (add in Phase 5 if needed):

- Add `dependency_quality` validator to `validators.ts`
- Enable it in DEPENDENCIES phase config
- This is tracked as a non-blocking enhancement

---

### 🟡 MEDIUM: ~~STACK_SELECTION Scoring References PRD But PRD Not in Inputs~~

**Status**: ✅ RESOLVED - Changed to "from project-brief.md" in the plan body (L544)

---

### 🟡 MEDIUM: ~~`backend_heavy` Project Type Not in ANALYSIS Classification Enum~~

**Status**: ✅ RESOLVED - Added `backend_heavy` to classification enum at L381

---

### 🟡 MEDIUM: ~~Integration Test Step Contradicts Stack Approval Gate Requirement~~

**Status**: ✅ RESOLVED - Fixed at L887 to say "**after** stack_approved gate is passed"

---

### 🟡 MEDIUM: ~~Implementation Order Missing `recommended_stack` and `workflow_version` Columns~~

**Status**: ✅ RESOLVED - Added to Phase 1 Backend Foundation at L966

---

### 🟡 MEDIUM: ~~Template Count "14" Still Appears in Multiple Sections~~

**Status**: ✅ RESOLVED - All instances in plan body changed to "13 templates"

---

### 🟡 MEDIUM: ~~Path Inconsistencies Throughout Document~~

**Status**: ✅ RESOLVED - All paths corrected throughout the plan body and Summary section

---

### 🟡 MEDIUM: ~~Dependency Presets JSON Contains Invalid Syntax~~

**Status**: ✅ RESOLVED - Converted to TypeScript with proper multi-runtime support (`pythonDeps` field)

---

### 🟡 MEDIUM: Missing Database Schema Updates for New Metadata

**Problem**: Plan mentions storing `project_type`, `scale_tier`, `recommended_stack` but doesn't specify:

1. Column types
2. Migration strategy
3. Which table (projects? new table?)

**Required Schema Addition** to `backend/lib/schema.ts`:

```typescript
// Add to projects table
projectType: text('project_type'), // 'web_app' | 'mobile_app' | etc.
scaleTier: text('scale_tier'),     // 'prototype' | 'startup' | 'growth' | 'enterprise'
recommendedStack: text('recommended_stack'), // Template ID from AI
workflowVersion: integer('workflow_version').notNull().default(2), // AI-driven workflow version
```

---

### 🟢 LOW: ~~Consider Keeping `stack-rationale.md`~~

**Status**: ✅ RESOLVED - Decision: **Keep `stack-rationale.md` as a separate artifact** (included in phase outputs at L526). It provides detailed reasoning that complements the summary in `stack-analysis.md`.

---

### 🟢 LOW: Pinned Versions Inconsistency

**Problem**: Plan says "All versions pinned (exact or caret)" but examples use caret `^` which allows minor updates. Clarify:

- **Exact pinning**: `"next": "14.2.0"` (no caret)
- **Caret pinning**: `"next": "^14.2.0"` (allows 14.x.x)

**Recommendation**: Use caret for production deps to get security patches.

---

## Phase 1: Enhance ANALYSIS Phase for Better Stack Intelligence

### Objective

Improve requirement gathering to enable smarter stack selection decisions.

### Changes to `orchestrator_spec.yml`

**Add new analysis artifacts:**

- `project-classification.json` - Machine-readable project type, scale tier, platform targets
- Enhanced `project-brief.md` - Include explicit project type classification

**Enhance analyst prompt to classify:**

1. **Project Type**: `web_app`, `mobile_app`, `api_platform`, `static_site`, `fullstack_with_mobile`, `backend_heavy`
2. **Scale Tier**: `prototype` (<1k users), `startup` (1k-10k), `growth` (10k-100k), `enterprise` (100k+)
3. **Platform Targets**: Array of `web`, `ios`, `android`, `desktop`
4. **Backend Complexity**: `simple_crud`, `moderate_business_logic`, `complex_realtime`, `ml_ai_intensive`

> [!NOTE] > `backend_heavy` triggers when ANALYSIS detects ML/AI keywords or Python-specific requirements.

**Critical Files:**

- [orchestrator_spec.yml](orchestrator_spec.yml) - ANALYSIS phase config (repo root)
- [backend/services/llm/agent_executors.ts](backend/services/llm/agent_executors.ts) - `runAnalystAgent` function

---

## Phase 2: Redesign STACK_SELECTION Phase (AI-Driven)

### Objective

AI analyzes requirements and automatically recommends optimal stack, while showing 2-3 alternative templates for transparency.

### New Stack Selection Workflow

```
1. Architect reads: project-brief.md, project-classification.json, constitution.md
2. Architect evaluates ALL templates against project requirements
3. Architect scores each template on:
   - Platform coverage (web/mobile/desktop alignment)
   - Scale appropriateness (infrastructure for expected load)
   - Team familiarity (if mentioned in constitution)
   - Backend complexity match
   - Integration requirements fit
4. Architect outputs:
   - PRIMARY_RECOMMENDATION (highest scoring template)
   - ALTERNATIVE_1 (2nd highest score)
   - ALTERNATIVE_2 (3rd highest score OR CUSTOM)
   - Decision matrix showing scores and reasoning
5. User reviews and can:
   - Accept primary (default)
   - Choose alternative 1 or 2
   - Request full customization
```

### Intelligent Defaults (Fallback System)

If ANALYSIS phase didn't gather enough info, use these defaults:

| Project Type            | Default Stack           | Rationale                                            |
| ----------------------- | ----------------------- | ---------------------------------------------------- |
| `web_app`               | `nextjs_web_app`        | Next.js 14 + Bun + Neon + Drizzle + R2 + Better Auth |
| `mobile_app`            | `react_native_supabase` | React Native + Expo + Supabase (cross-platform)      |
| `fullstack_with_mobile` | `nextjs_fullstack_expo` | Unified TypeScript stack for web + mobile            |
| `api_platform`          | `serverless_edge`       | Edge functions for global performance                |
| `static_site`           | `astro_static`          | Astro for content-driven sites                       |
| `backend_heavy`         | `hybrid_nextjs_fastapi` | Python backend for ML/AI workloads                   |

### New Artifacts Structure

**`stack-analysis.md`** (replaces `stack-proposal.md`):

```markdown
# Stack Analysis Report

## Project Classification

- Type: web_app
- Scale Tier: startup
- Platforms: [web]
- Backend Complexity: moderate_business_logic

## Evaluation Results

### 🏆 Primary Recommendation: nextjs_web_app

**Score: 95/100**

- ✅ Platform Coverage: Perfect match for web-only
- ✅ Scale Appropriateness: Excellent for 1k-10k users
- ✅ Backend Complexity: Serverless functions handle moderate logic
- ✅ Developer Experience: Unified TypeScript stack
- ✅ Infrastructure: Vercel-optimized, Neon autoscaling

**Stack Details:**

- Frontend: Next.js 14 + React 18 + TypeScript
- Styling: Tailwind CSS + Shadcn UI
- Database: Neon PostgreSQL + Drizzle ORM
- Storage: Cloudflare R2
- Auth: Better Auth
- Package Manager: Bun (3x faster than npm)

### 🥈 Alternative 1: hybrid_nextjs_fastapi

**Score: 78/100**

- ✅ Backend Complexity: Python excels at complex logic
- ⚠️ Platform Coverage: Adds deployment complexity
- ⚠️ Team Expertise: Requires Python + TypeScript knowledge
- ❌ Infrastructure: Need to manage 2 services

**Use if:** You need Python-specific libraries (ML, data science)

### 🥉 Alternative 2: CUSTOM

**Score: N/A**

- Full control over every layer
- Requires manual configuration of all stack components

**Use if:** None of the templates fit your unique requirements

## Decision Matrix

[Detailed comparison table]

## Recommendation

Accept the **nextjs_web_app** stack for fastest time-to-market with proven technology.
```

**`stack-decision.md`** (user's final choice - unchanged format)

**`stack.json`** (machine-readable contract - unchanged format)

### Changes to orchestrator_spec.yml

> [!IMPORTANT]
> The YAML examples below use the **current schema format** (string arrays for outputs, gates array for approval). The errata section documents a potential schema migration if object-style outputs are desired.

**Update STACK_SELECTION phase config:**

```yaml
# Using CURRENT schema format (compatible with existing config_loader.ts)
STACK_SELECTION:
  name: 'STACK_SELECTION'
  description: 'AI-driven stack recommendation with alternatives'
  owner: 'architect'
  duration_minutes: 20
  inputs:
    - project-brief.md
    - project-classification.json
    - constitution.md
    - personas.md
  outputs:
    - stack-analysis.md # NEW: replaces stack-proposal.md (see errata for migration)
    - stack-decision.md
    - stack-rationale.md
    - stack.json
  depends_on:
    - ANALYSIS
  gates:
    - stack_approved # KEEP: User must still approve stack choice
  next_phase: SPEC
  validators:
    - presence
    - stack_approved
    - stack_completeness
    - stack_json_check
  mode: ai_recommend_with_alternatives
  prompt_sections:
    - role: system
      content: |
        You are a Staff Architect evaluating technology stacks.

        WORKFLOW:
        1. Read project-classification.json for automated project type
        2. Use intelligent defaults as baseline (see DEFAULTS table)
        3. Evaluate ALL 13 templates against requirements
        4. Score each template on 5 criteria (0-20 points each):
           - Platform coverage (web/mobile/desktop match)
           - Scale appropriateness (infrastructure for load)
           - Backend complexity fit (CRUD vs realtime vs ML)
           - Team expertise alignment (from constitution)
           - Integration requirements (from project-brief.md)
        5. Select top 3 scoring templates
        6. Generate stack-analysis.md with PRIMARY, ALT1, ALT2

        INTELLIGENT DEFAULTS:
        - web_app → nextjs_web_app (Next.js + Bun + Neon + R2)
        - mobile_app → react_native_supabase (Expo + Supabase)
        - fullstack_with_mobile → nextjs_fullstack_expo (unified TS)
        - api_platform → serverless_edge (edge functions)
        - static_site → astro_static (Astro)
        - backend_heavy → hybrid_nextjs_fastapi (Python backend)
```

**Critical Files:**

- [orchestrator_spec.yml](orchestrator_spec.yml) - STACK_SELECTION phase (repo root)
- [backend/services/llm/agent_executors.ts](backend/services/llm/agent_executors.ts) - `runArchitectAgent` for STACK_SELECTION
- [backend/services/orchestrator/orchestrator_engine.ts](backend/services/orchestrator/orchestrator_engine.ts) - Phase transition logic

---

## Phase 3: Streamline DEPENDENCIES Phase (Auto-Generate)

### Objective

Remove dependencies approval gate. Dependencies are deterministically generated from approved stack + PRD requirements.

### Rationale for Removing Approval Gate

**Current friction:**

1. User approves stack in STACK_SELECTION phase
2. DEPENDENCIES phase generates dependencies from that stack
3. User must approve again (redundant)

**New streamlined flow:**

1. User approves stack (which implies dependency approval)
2. DEPENDENCIES phase auto-generates with no gate
3. Dependencies are documented in DEPENDENCIES.md for reference
4. User can see dependencies in final handoff but doesn't need to approve

### Changes to orchestrator_spec.yml

**Update DEPENDENCIES phase:**

```yaml
# Using CURRENT schema format (compatible with existing config_loader.ts)
DEPENDENCIES:
  name: 'DEPENDENCIES'
  description: 'Auto-generate dependencies from approved stack (no approval gate)'
  owner: 'devops'
  duration_minutes: 15
  inputs:
    - PRD.md
    - stack-decision.md
    - stack.json
  outputs:
    - DEPENDENCIES.md
    - dependencies.json
  depends_on:
    - SPEC
  # REMOVED: gates: ["dependencies_approved"]  <-- This line is deleted
  next_phase: SOLUTIONING
  validators:
    - presence
    - dependencies_json_check
    # dependency_quality deferred to Phase 5 (see errata) - quality enforced by LLM prompt for now
  prompt_sections:
    - role: system
      content: |
        You are a DevOps Engineer generating project dependencies.

        WORKFLOW:
        1. Read stack.json for approved stack configuration
        2. Load template-specific dependency presets
        3. Read PRD.md for additional feature requirements
        4. Generate dependencies deterministically
        5. No approval needed - stack approval implies dependency approval

        TEMPLATE PRESETS:
        Each template has a CORE preset + OPTIONAL modules based on PRD features.

        Example for nextjs_web_app:
        CORE (always included):
        - next@14.x, react@18.x, typescript@5.x
        - tailwindcss@3.x, @radix-ui/react-*
        - drizzle-orm, @neondatabase/serverless
        - better-auth, bcryptjs

        OPTIONAL (feature-driven):
        - If PRD mentions "real-time" → add pusher-js or socket.io-client
        - If PRD mentions "file upload" → add @aws-sdk/client-s3
        - If PRD mentions "payments" → add @stripe/stripe-js
        - If PRD mentions "analytics" → add @vercel/analytics

        QUALITY REQUIREMENTS:
        ✅ All versions pinned (caret ^x.y.z for security patches)
        ✅ Every prod dependency maps to PRD requirement
        ✅ No HIGH/CRITICAL vulnerabilities
        ✅ All licenses MIT/Apache/BSD compatible
        ✅ All packages updated within 12 months
```

### Dependency Presets System

> [!NOTE]
> Use TypeScript instead of JSON to enable inheritance and avoid invalid JSON syntax.

Create new file: `backend/config/dependency-presets.ts`

```typescript
// backend/config/dependency-presets.ts
// TypeScript file enables inheritance and type safety

const BASE_NEXTJS_CORE = {
  next: '^14.2.0',
  react: '^18.2.0',
  'react-dom': '^18.2.0',
  typescript: '^5.3.0',
  tailwindcss: '^3.4.0',
  'drizzle-orm': '^0.29.0',
  '@neondatabase/serverless': '^0.9.0',
  'better-auth': '^1.0.0',
};

const BASE_PYTHON_BACKEND = {
  fastapi: '^0.109.0',
  pydantic: '^2.5.0',
  sqlalchemy: '^2.0.0',
  uvicorn: '^0.27.0',
  alembic: '^1.13.0',
};

export interface FeaturePreset {
  deps: string[];
  triggerKeywords: string[];
}

export interface TemplatePreset {
  core: Record<string, string>; // npm/bun dependencies
  pythonDeps?: Record<string, string>; // pip dependencies for hybrid stacks
  devDependencies?: Record<string, string>;
  features: Record<string, FeaturePreset>;
}

export const DEPENDENCY_PRESETS: Record<string, TemplatePreset> = {
  nextjs_web_app: {
    core: BASE_NEXTJS_CORE,
    devDependencies: {
      'drizzle-kit': '^0.20.0',
      '@types/react': '^18.2.0',
      '@types/node': '^20.0.0',
    },
    features: {
      payments: {
        deps: ['stripe', '@stripe/stripe-js'],
        triggerKeywords: ['payment', 'subscription', 'billing', 'checkout'],
      },
      real_time: {
        deps: ['pusher-js'],
        triggerKeywords: ['real-time', 'live', 'websocket', 'notifications'],
      },
      file_upload: {
        deps: ['@aws-sdk/client-s3'],
        triggerKeywords: ['upload', 'file', 'media', 'images', 'storage'],
      },
      email: {
        deps: ['resend', '@react-email/components'],
        triggerKeywords: ['email', 'newsletter', 'transactional'],
      },
      analytics: {
        deps: ['@vercel/analytics'],
        triggerKeywords: ['analytics', 'tracking', 'metrics'],
      },
    },
  },
  hybrid_nextjs_fastapi: {
    core: BASE_NEXTJS_CORE,
    pythonDeps: BASE_PYTHON_BACKEND, // Now properly used!
    features: {
      ml: {
        deps: ['scikit-learn', 'pandas', 'numpy'], // Python deps
        triggerKeywords: ['machine learning', 'AI', 'prediction', 'model'],
      },
      async_tasks: {
        deps: ['celery', 'redis'],
        triggerKeywords: ['background', 'async', 'queue', 'workers'],
      },
    },
  },
  // Add remaining 11 templates...
};

// Helper to detect features from PRD content
export function detectFeaturesFromPRD(
  prdContent: string,
  templateId: string
): string[] {
  const preset = DEPENDENCY_PRESETS[templateId];
  if (!preset) return [];

  const detectedFeatures: string[] = [];
  const lowerPRD = prdContent.toLowerCase();

  for (const [featureName, feature] of Object.entries(preset.features)) {
    if (feature.triggerKeywords.some((kw) => lowerPRD.includes(kw))) {
      detectedFeatures.push(featureName);
    }
  }

  return detectedFeatures;
}
```

### Database Schema Update

**Database Schema Update (dependencies_approved removal):**

```sql
-- New flow only: drop approval gate column
ALTER TABLE projects DROP COLUMN IF EXISTS dependencies_approved;
```

**Critical Files:**

- [orchestrator_spec.yml](orchestrator_spec.yml) - DEPENDENCIES phase (repo root)
- [backend/services/llm/agent_executors.ts](backend/services/llm/agent_executors.ts) - `runDevOpsAgent`
- [backend/config/dependency-presets.ts](backend/config/dependency-presets.ts) - New TypeScript file (not JSON)
- Database migration to remove `dependencies_approved` column
- See errata for complete 22+ file list

---

## Phase 4: Update UI for New Stack Selection Flow

### Objective

Update frontend to display AI recommendations with alternatives instead of template grid.

### Current UI (to be changed)

File: `src/app/project/[slug]/page.tsx` (stack selection is inline, not a separate page)

Current component: `src/components/orchestration/StackSelection.tsx`

Likely shows:

- Template grid with 13 templates
- User must manually browse and select

### New UI Design

**Component Structure:**

```tsx
<StackRecommendationView>
  <ProjectClassification /> {/* Show detected project type */}
  <PrimaryRecommendation>
    <StackCard template={primary} score={95} isPrimary />
    <AcceptButton /> {/* Default action */}
  </PrimaryRecommendation>
  <AlternativesSection>
    <StackCard template={alternative1} score={78} />
    <StackCard template={alternative2} score={65} />
  </AlternativesSection>
  <CustomStackOption>
    <Button onClick={openCustomBuilder}>
      Need something different? Build custom stack
    </Button>
  </CustomStackOption>
  <StackComparisonTable /> {/* Detailed comparison matrix */}
</StackRecommendationView>
```

**StackCard component features:**

- Template name + description
- Score badge (0-100)
- Key technologies (Next.js, React, PostgreSQL, etc.)
- Pros/Cons list from stack-analysis.md
- "Select this stack" button

**Critical Files:**

- [src/app/project/[slug]/page.tsx](src/app/project/[slug]/page.tsx) - Main project page (stack selection is inline)
- [src/components/orchestration/StackSelection.tsx](src/components/orchestration/StackSelection.tsx) - Current component to refactor
- Create new component: `src/components/orchestration/StackRecommendationView.tsx`
- Create new component: `src/components/orchestration/StackCard.tsx`

---

## Phase 5: Update Backend API Endpoints

### Objective

Update API to support AI-driven stack selection flow.

### API Changes

**1. Parse stack-analysis.md artifact**

File: `backend/services/orchestrator/orchestrator_engine.ts`

Add new method:

```typescript
private parseStackAnalysis(content: string): StackAnalysisResult {
  // Parse markdown to extract:
  // - primary_recommendation
  // - alternative_1
  // - alternative_2
  // - scores for each
  // - decision matrix

  return {
    primary: { template: 'nextjs_web_app', score: 95, ... },
    alternatives: [
      { template: 'hybrid_nextjs_fastapi', score: 78, ... },
      { template: 'CUSTOM', score: null, ... }
    ],
    matrix: { /* comparison data */ }
  };
}
```

**2. Update project metadata**

When STACK_SELECTION completes, store:

- `project_type` (from project-classification.json)
- `scale_tier` (from project-classification.json)
- `recommended_stack` (from stack-analysis.md)

**3. Remove dependencies approval endpoint**

Delete or disable: `POST /api/projects/:id/approve-dependencies`

Dependencies no longer need approval, so this endpoint is obsolete.

**Critical Files:**

- [backend/services/orchestrator/orchestrator_engine.ts](backend/services/orchestrator/orchestrator_engine.ts) - Add parseStackAnalysis method
- [src/app/api/projects/route.ts](src/app/api/projects/route.ts) - Update routes
- [src/app/api/projects/[slug]/approve-dependencies/route.ts](src/app/api/projects/[slug]/approve-dependencies/route.ts) - DELETE this file
- Database migration to add `project_type`, `scale_tier`, `recommended_stack`, `workflow_version` columns

---

## Phase 6: Testing & Validation

### Test Cases

**ANALYSIS Phase:**

1. **Test minimal input**: "Build a web app"
   - Should classify as `web_app` type
   - Should use `nextjs_web_app` default
2. **Test mobile project**: "Create an iOS and Android app"
   - Should classify as `mobile_app` type
   - Should recommend `react_native_supabase`
3. **Test fullstack + mobile**: "Web dashboard with companion mobile app"
   - Should classify as `fullstack_with_mobile`
   - Should recommend `nextjs_fullstack_expo`

**STACK_SELECTION Phase:**

1. **Test recommendation quality**:
   - Verify primary recommendation matches project type
   - Verify alternatives are relevant
   - Verify scores are reasonable (primary > alt1 > alt2)
2. **Test intelligent defaults**:
   - For each project type, verify correct default is used
3. **Test custom stack flow**:
   - User should still be able to select CUSTOM and define layers manually

**DEPENDENCIES Phase:**

1. **Test auto-generation**:
   - Verify dependencies match approved stack
   - Verify no approval gate is shown
2. **Test feature detection**:
   - If PRD mentions "payments", verify Stripe SDK is included
   - If PRD mentions "real-time", verify WebSocket library is included
3. **Test quality validators**:
   - All versions should be pinned
   - No critical vulnerabilities
   - All licenses documented

### Integration Testing

Run full workflow end-to-end:

```bash
1. Create project with minimal input
2. Verify ANALYSIS classifies project correctly
3. Verify STACK_SELECTION shows 3 options (primary + 2 alts)
4. Accept primary recommendation
5. Verify SPEC phase proceeds **after** stack_approved gate is passed
6. Verify DEPENDENCIES auto-generates without approval (no dependencies_approved gate)
7. Verify SOLUTIONING receives correct stack + dependencies
```

**Critical Files:**

- Create test file: `backend/tests/integration/stack-selection-flow.test.ts`
- Create test file: `backend/tests/unit/dependency-presets.test.ts`

---

## Implementation Plan (Actionable Checklist)

> [!IMPORTANT]
> This plan assumes the errata file lists stay accurate. Re-run the sweeps when you start, then keep the plan in sync.

### Phase 0: Prep & Inventory (Day 0-1)

- [ ] Run `rg -n "stack-proposal.md"` and confirm only the 12 expected files remain.
- [ ] Run `rg -n "dependenciesApproved|dependencies_approved|dependencyApprovals"` and confirm the 22+ file list is complete.
- [ ] Update the errata file lists if new references are found.

### Phase 1: Backend Foundation (Days 1-2)

- [ ] **Rename `stack-proposal.md` → `stack-analysis.md`** in ALL 12 files:
  - `orchestrator_spec.yml` (L134, L1022-1024, L2442)
  - `backend/services/orchestrator/config_loader.ts` (L109)
  - `backend/services/orchestrator/artifact_manager.ts` (L255)
  - `backend/services/orchestrator/validators.ts` (L1713)
  - `backend/services/llm/agent_executors.ts` (L246, L277)
  - `backend/services/file_system/handoff_generator.ts` (L110, L232, L372)
  - `backend/services/file_system/archiver.ts` (L272, L398, L473)
  - `src/app/api/projects/[slug]/phase/route.ts` (L13)
  - `src/app/api/projects/[slug]/approve-stack/route.ts` (L385, L399)
  - `src/app/project/[slug]/page.tsx` (L1399)
  - `src/utils/phase-status.ts` (L31)
  - `src/lib/config.ts` (L39)
- [ ] Update `orchestrator_spec.yml` ANALYSIS outputs (add `project-classification.json`) and prompt text.
- [ ] Update `runAnalystAgent` to emit classification fields.
- [ ] Add `backend/config/dependency-presets.ts` (types + placeholder presets).
- [ ] Update database schema and migrations:
  - Add `project_type`, `scale_tier`, `recommended_stack`, `workflow_version` columns
  - Drop `dependencies_approved`
  - Remove `dependencyApprovals` table/relations/type exports
  - Update `drizzle/meta/0000_snapshot.json` and `backend/lib/migration_helper.ts`
- [ ] Ensure project/API types include the new metadata columns.

Exit criteria:
- `rg -n "stack-proposal.md"` returns zero results.
- Schema migration generated and snapshot updated.
- New metadata fields visible in API responses for a project.

### Phase 2: Stack Selection Logic (Days 3-4)

- [ ] Update `orchestrator_spec.yml` STACK_SELECTION phase for AI-driven workflow and outputs.
- [ ] Update `runArchitectAgent` scoring logic to emit `stack-analysis.md`.
- [ ] Implement intelligent defaults fallback system.
- [ ] Add `parseStackAnalysis` in `orchestrator_engine.ts` and wire to phase completion.
- [ ] Persist project metadata on STACK_SELECTION completion:
  - `project_type` and `scale_tier` from `project-classification.json`
  - `recommended_stack` from `stack-analysis.md`
  - `workflow_version` set to 2

Exit criteria:
- `stack-analysis.md` generated with primary + alternatives.
- Project metadata is stored for new runs.

### Phase 3: Dependencies Automation (Day 5)

- [ ] **Remove `dependencies_approved` from ALL 22+ files** (see errata for complete list).
- [ ] Delete `src/app/api/projects/[slug]/approve-dependencies/route.ts`.
- [ ] Update `orchestrator_spec.yml` DEPENDENCIES phase (remove approval gate).
- [ ] Update `runDevOpsAgent` to use dependency presets.
- [ ] Implement feature detection (parse PRD keywords → optional deps).

Exit criteria:
- No approval UI/gate exists for dependencies.
- DEPENDENCIES artifacts are generated automatically.

### Phase 4: Frontend Updates (Days 6-7)

- [ ] Create `StackRecommendationView` component.
- [ ] Create `StackCard` component.
- [ ] Update stack-selection UI to use the new components and progressive disclosure.
- [ ] Remove dependencies approval UI.

### Phase 5: Testing & Refinement (Days 8-9)

- [ ] Write integration tests for full workflow.
- [ ] Write unit tests for dependency presets.
- [ ] Update API tests affected by gate removal.
- [ ] Manual testing of all project types.
- [ ] Refinements from test results.

### Phase 6: Documentation (Day 10)

- [ ] Update user-facing docs on the new stack selection flow.
- [ ] Update developer docs on dependency presets.

---

## Risk Mitigation

### Risk 1: AI chooses wrong stack

**Mitigation:**

- Show 2 alternatives so user can easily switch
- Keep CUSTOM option for full control
- Maintain stack_approved gate so user must explicitly confirm

### Risk 2: Missing dependencies for edge cases

**Mitigation:**

- Comprehensive dependency presets covering common features
- Feature detection from PRD keywords
- SOLUTIONING phase can identify missing deps and notify user

### Risk 3: Users miss dependency changes

**Mitigation:**

- DEPENDENCIES.md is still generated for documentation
- HANDOFF.md at end includes full dependency list
- Dependencies shown in README.md during DONE phase

## Success Metrics

### User Experience Improvements

- **Time to stack selection**: Reduce from ~10 minutes (browsing templates) to ~2 minutes (review AI recommendation)
- **Decision confidence**: Users see AI reasoning and alternatives
- **Workflow speed**: Removing dependencies approval gate saves ~5-10 minutes

### Technical Quality

- **Stack appropriateness**: AI should choose correct stack 90%+ of time
- **Dependency accuracy**: Generated dependencies should match requirements 95%+ of time
- **Security compliance**: 100% of dependencies should pass security audit

### Adoption

- **Default acceptance rate**: Target 70%+ users accept primary recommendation
- **Custom stack usage**: Should drop from 30% to <10% (better defaults = less customization needed)

---

## Future Enhancements (Out of Scope)

1. **Machine learning model** for stack scoring (instead of rule-based)
2. **Dependency version updates** - Auto-update deps to latest stable versions
3. **Cost estimation** - Show infrastructure costs for each stack option
4. **Template marketplace** - Community-contributed templates with ratings
5. **A/B testing** - Compare AI recommendations vs user manual choices

---

## Additional Recommendations (Review Feedback)

> [!NOTE]
> The following recommendations are based on analysis of the current system implementation, specifically the existing `StackSelection.tsx` component (13 template grid), the `orchestrator_spec.yml` configuration, and the `dependencies_approved` gate throughout the codebase.

### UX Enhancements for Stack Selection

#### 1. Progressive Disclosure for Alternatives

Don't show all 3 options immediately. Show the primary recommendation prominently with a "See alternatives" expander. Most users will accept the primary recommendation, so avoid cluttering the initial view.

```tsx
// Recommended component structure
<StackRecommendationView>
  <ProjectClassificationBanner type='web_app' confidence={95} />
  <PrimaryRecommendation stack='nextjs_web_app' score={95}>
    <StackCard highlighted />
    <AcceptButton primary /> {/* One-click accept */}
  </PrimaryRecommendation>
  <Collapsible title='See Alternatives' defaultOpen={false}>
    <StackCard template='hybrid_nextjs_fastapi' score={78} />
    <StackCard template='react_express' score={65} />
  </Collapsible>
  <CustomStackButton /> {/* Keep escape hatch */}
</StackRecommendationView>
```

#### 2. Loading State with Context

Show a meaningful animation while the architect agent scores templates:

```tsx
<AnalyzingState>
  <BrainIcon className='animate-pulse' />
  <Text>🧠 Analyzing your requirements...</Text>
  <ProgressSteps>
    <Step completed>Reading project classification</Step>
    <Step active>Scoring 13 templates</Step>
    <Step>Generating recommendations</Step>
  </ProgressSteps>
</AnalyzingState>
```

#### 3. Confidence Indicator on Primary Recommendation

Show a score badge (e.g., "95% match") on the primary recommendation so users understand why the AI chose it. This builds trust and reduces second-guessing.

#### 4. Fallback to Full Template Grid

Add a "Not what you need? Browse all templates" link that opens the full template grid as a fallback. This ensures power users can still access the old flow if they prefer manual selection.

#### 5. First-Time User Onboarding Tooltip

First-time users might not understand the AI recommendation. Add a tooltip:

> "Our AI analyzed your project requirements and recommends this stack. Click to accept or explore alternatives."

### Optimized Implementation Order

Based on the 10-day timeline, here's an optimized sequence that minimizes blockers:

| Day | Focus                                         | Deliverable                                                    | Blocked By |
| --- | --------------------------------------------- | -------------------------------------------------------------- | ---------- |
| 1-2 | **Phase 0 + 1**: Inventory + ANALYSIS updates | Sweeps complete, `project-classification.json` artifacts       | Nothing    |
| 3-4 | **Phase 2**: Stack selection AI               | Scoring logic, `stack-analysis.md`, intelligent defaults       | Phase 1    |
| 5   | **Phase 3**: Dependencies automation          | Remove gate, add presets, feature detection                    | Phase 2    |
| 6-7 | **Phase 4**: Frontend UI                      | `StackRecommendationView`, `StackCard` components              | Phase 2    |
| 8-9 | **Testing**                                   | Integration tests, manual testing all project types            | All phases |
| 10  | **Documentation**                             | Update user docs and rollout notes                             | Testing    |

> [!IMPORTANT]
> **Day 1-2 is critical path.** The `project-classification.json` artifact is the foundation for all AI-driven decisions. Start here to unblock everything else.

### Additional Risk Mitigations

#### Risk: Users Miss Dependency Changes

**Enhanced mitigation**: Add a collapsible "View Dependencies" section in the HANDOFF.md summary that shows:

- Core dependencies with versions
- Feature-specific dependencies (what triggered their inclusion)
- License summary
- Security audit status

### Dependency Presets Structure

> [!NOTE]
> Use TypeScript for presets to enable inheritance and type safety. See `backend/config/dependency-presets.ts` in Phase 3 for the full implementation.

Complete the presets for all 13 templates using this structure:

```typescript
// Example: Complete preset for hybrid_nextjs_fastapi
// Shows how to use pythonDeps for multi-runtime stacks

export const DEPENDENCY_PRESETS: Record<string, TemplatePreset> = {
  // ... nextjs_web_app (shown in Phase 3)

  hybrid_nextjs_fastapi: {
    core: BASE_NEXTJS_CORE, // npm deps
    pythonDeps: BASE_PYTHON_BACKEND, // pip deps (now properly typed!)
    devDependencies: {
      'drizzle-kit': '^0.20.0',
      '@types/react': '^18.2.0',
    },
    features: {
      ml: {
        deps: ['scikit-learn', 'pandas', 'numpy'], // Goes to requirements.txt
        triggerKeywords: ['machine learning', 'AI', 'prediction', 'model'],
      },
      async_tasks: {
        deps: ['celery', 'redis'],
        triggerKeywords: ['background', 'async', 'queue', 'workers'],
      },
    },
  },

  // Remaining templates follow the same pattern...
  // Full list: nextjs_fullstack_expo, react_express, vue_nuxt,
  // svelte_kit, astro_static, serverless_edge, django_htmx,
  // go_react, flutter_firebase, react_native_supabase
};
```

### Files to Update (Corrected Paths)

Based on actual project structure analysis:

| Planned Path                                           | Actual Path                                                | Notes                                        |
| ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------- |
| `app/dashboard/projects/[id]/stack-selection/page.tsx` | `src/app/project/[slug]/page.tsx`                          | Stack selection is inline, not separate page |
| `app/components/stack/StackRecommendationView.tsx`     | `src/components/orchestration/StackRecommendationView.tsx` | Follow existing component structure          |
| `app/components/stack/StackCard.tsx`                   | `src/components/orchestration/StackCard.tsx`               | Follow existing component structure          |

### Feedback Loop for Future Improvement

Even though ML-based scoring is out of scope, capture data for future analysis:

```typescript
// Log recommendation decisions
interface StackRecommendationLog {
  projectId: string;
  projectType: ProjectType;
  primaryRecommendation: string;
  alternatives: string[];
  userChoice: string; // What user actually selected
  wasAccepted: boolean; // Did user accept primary?
  timestamp: Date;
}

// Store in a simple table or analytics service
// This data will inform future default improvements
```

---

## Summary of Changes

### Files to Modify

1. [orchestrator_spec.yml](orchestrator_spec.yml) - ANALYSIS, STACK_SELECTION, DEPENDENCIES phases (repo root)
2. [backend/services/llm/agent_executors.ts](backend/services/llm/agent_executors.ts) - Agent functions
3. [backend/services/orchestrator/orchestrator_engine.ts](backend/services/orchestrator/orchestrator_engine.ts) - parseStackAnalysis method
4. [src/app/project/[slug]/page.tsx](src/app/project/[slug]/page.tsx) - UI update (stack selection is inline)
5. [src/components/orchestration/StackSelection.tsx](src/components/orchestration/StackSelection.tsx) - Refactor to StackRecommendationView
6. Database migration script - Schema updates (see errata for complete 22+ file list)

### Files to Create

1. [backend/config/dependency-presets.ts](backend/config/dependency-presets.ts) - Dependency presets (TypeScript, not JSON)
2. [src/components/orchestration/StackRecommendationView.tsx](src/components/orchestration/StackRecommendationView.tsx) - New component
3. [src/components/orchestration/StackCard.tsx](src/components/orchestration/StackCard.tsx) - New component
4. [backend/tests/integration/stack-selection-flow.test.ts](backend/tests/integration/stack-selection-flow.test.ts) - Integration tests
5. [backend/tests/unit/dependency-presets.test.ts](backend/tests/unit/dependency-presets.test.ts) - Unit tests

### Configuration Changes

- Remove `dependencies_approved` approval gate entirely (see errata for 22+ files)
- Add intelligent defaults mapping (project_type → template)
- Add dependency presets for all 13 templates
- Add scoring rubric for stack evaluation

---

## Conclusion

This plan transforms your 7-phase system from a template-driven workflow to an **intelligent, AI-driven system** that:

✅ **Reduces decision fatigue** - AI recommends optimal stack based on requirements
✅ **Maintains transparency** - Shows alternatives and scoring rationale
✅ **Streamlines workflow** - Removes redundant dependencies approval gate
✅ **Uses intelligent defaults** - Sensible fallbacks for minimal user input (Next.js+Bun for web apps)
✅ **Preserves user control** - Stack approval gate and CUSTOM option remain

The result is a **faster, smarter workflow** that guides users to the right stack while respecting their expertise and giving them visibility into the AI's reasoning.
