# Phase Workflow Enhancement - Task List

**Created:** December 31, 2025  
**Source:** [PHASE_WORKFLOW_ENHANCEMENT_PLAN.md](./PHASE_WORKFLOW_ENHANCEMENT_PLAN.md)  
**Status:** Implementation Checklist

---

## 📋 Implementation Phases Overview

| Phase   | Focus                                  | Timeline | Priority    |
| ------- | -------------------------------------- | -------- | ----------- |
| Phase 1 | Feedback Loops & Continuous Validation | Week 1-2 | 🔴 CRITICAL |
| Phase 2 | Collaboration & Control                | Week 3-4 | 🟡 HIGH     |
| Phase 3 | Performance & Specialization           | Week 5-6 | 🟢 MEDIUM   |
| Phase 4 | Advanced Features                      | Week 7-8 | 🔵 OPTIONAL |

---

## Phase 1: Foundation (Weeks 1-2) - CRITICAL

### Enhancement #1: Feedback Loops & Iterative Refinement

> **Effort:** 3 days | **Impact:** 🟢🟢🟢🟢🟢

- [x] Implement `AUTO_REMEDY` phase logic

  - [x] Parse `validation-report.md` for specific failure types
  - [x] Create failure-to-remediation mapping:
    - [x] `missing_requirement_mapping` → re-run scrummaster with gap analysis
    - [x] `persona_mismatch` → re-run PM with persona consistency check
    - [x] `api_data_model_gap` → re-run architect SPEC phase
  - [x] Implement targeted agent re-runs (not full phase restart)
  - [x] Add max retry limit (max_attempts: 2)
  - [x] Create `MANUAL_REVIEW` fallback for failed auto-fixes

- [x] Implement phase outcomes system

  - [x] `all_pass` → proceed to DONE
  - [x] `warnings_only` → user choice to proceed
  - [x] `failures_detected` → trigger AUTO_REMEDY

- [x] Add AUTO_REMEDY safeguards
  - [x] Layer 1: User edit detection (content hash comparison)
  - [x] Layer 2: Diff preview with confirmation
  - [x] Layer 3: Git-style conflict markers
  - [x] Layer 4: Scope limits (max 50 lines, protected sections)

---

### Enhancement #3: Continuous Micro-Validation

> **Effort:** 2 days | **Impact:** 🟢🟢🟢🟢

- [x] Add inline validators per phase

  - [x] ANALYSIS: `presence`, `markdown_frontmatter`, `content_quality`, `no_unresolved_clarifications`
  - [x] STACK_SELECTION: `presence`, `stack_approved`, `stack_completeness`, `stack_json_check`
  - [x] SPEC phases: Add appropriate validators

- [x] Implement validation behaviors

  - [x] `on_failure: 'show_warning'` (non-blocking)
  - [x] `on_failure: 'block_progression'` (for critical phases)
  - [x] Track accumulated warnings

- [x] Build real-time validation dashboard
  - [x] Phase-by-phase status display
  - [x] Warning counter
  - [x] Critical blockers list
  - [x] Suggested fixes (database backend)

---

### Create Phase Dependency Graph

> **Effort:** 1 day | **Impact:** 🟢🟢🟢

- [x] Document artifact dependencies in code
  - [x] `constitution.md` affects: stack-decision, PRD, architecture, design-tokens
  - [x] `project-brief.md` affects: stack-analysis, PRD, personas
  - [x] `personas.md` affects: PRD, user-flows, design-tokens
  - [x] `PRD.md` affects: data-model, api-spec, epics, tasks, architecture
  - [x] `stack.json` affects: component-inventory, dependencies.json
  - [x] Complete remaining dependency mappings

---

## Phase 2: Collaboration & Control (Weeks 3-4) - HIGH

### Enhancement #2: Progressive Approval System

> **Effort:** 2 days | **Impact:** 🟢🟢🟢🟢

- [x] Implement new approval gates

  - [x] `stack_approved` gate at STACK_SELECTION (Technical Lead)
  - [x] `prd_approved` gate at SPEC (Product Owner / PM)
  - [x] `architecture_approved` gate at SPEC_ARCHITECT (Technical Lead / Architect)
  - [x] `handoff_acknowledged` gate at DONE (Development Team)

- [x] Configure gate behavior

  - [x] Make gates configurable via `workflow_tracks` (in orchestrator_spec.yml)
  - [x] Add auto-approve threshold (`constitutional_compliance_score >= 95`)
  - [x] Implement non-blocking warnings (yellow banner - in API responses)

- [x] Add stakeholder mapping
  - [x] `stack_approved` → Technical Lead / CTO
  - [x] `prd_approved` → Product Owner / PM
  - [x] `architecture_approved` → Technical Lead / Architect
  - [x] `handoff_acknowledged` → Development Team

---

### Enhancement #4: Git Workflow Integration

> **Effort:** 4 days | **Impact:** 🟢🟢🟢🟢🟢

- [x] Implement spec branch strategy

  - [x] On project create: `git branch spec/{project-slug}`
  - [x] Initialize with `.specignore` and README

- [x] Add phase commit hooks

  - [x] On phase complete: stage artifacts, commit with standard message
  - [x] Include metadata (phase, agent, duration, artifacts)
  - [x] Add `Co-authored-by: {agent-role}` tag

- [x] Implement validation failure handling

  - [x] Create fixup commits
  - [x] Tag with `validation-failure-{timestamp}` (handoff tag created)

- [x] Add handoff completion hooks

  - [x] Create tag: `handoff-v{version}` via GitService
  - [ ] Generate GitHub Release with project.zip (not implemented, but tag system exists)

- [x] Create Git operational modes
  - [x] `full_integration`: full Git workflow with remote ops
  - [x] `local_only`: commits only, no push
  - [x] `disabled`: filesystem snapshots backup

---

### Enhancement #7: Rollback & State Management

> **Effort:** 3 days | **Impact:** 🟢🟢🟢

- [x] Create phase snapshot system

  - [x] Snapshot on phase complete (integrated into OrchestratorEngine)
  - [x] Snapshot on gate approval (approved gate triggers snapshot)
  - [x] Snapshot on validation pass (snapshot created after phase)

- [x] Store snapshot contents

  - [x] All generated artifacts (artifacts_json)
  - [x] Phase metadata (duration, agent, version)
  - [x] User inputs and decisions (user_inputs field)
  - [x] Validation results (validation_results field)

- [x] Implement rollback capability

  - [x] Max rollback depth: 3 phases (MAX_ROLLBACK_DEPTH = 3)
  - [x] Preserve user edits on rollback (snapshot-based)
  - [x] Require confirmation with diff preview (canRollback validation)

- [x] Create database schema
  - [x] `phase_snapshots` table (in schema.ts with all columns)
  - [x] Columns: id, projectId, phaseName, snapshotNumber, artifactsJson, metadata, userInputs, validationResults, gitCommitHash, gitBranch, createdAt

---

## Phase 3: Performance & Specialization (Weeks 5-6) - MEDIUM

### Enhancement #5: Parallel Phase Execution

> **Effort:** 5 days | **Impact:** 🟢🟢🟢🟢

- [x] Implement execution graph waves

  - [x] `wave_1_sequential`: ANALYSIS (foundation)
  - [x] `wave_2_parallel`: STACK_SELECTION + SPEC_DESIGN_TOKENS
  - [x] `wave_3_sequential`: SPEC_PM (requirements first)
  - [x] `wave_3b_parallel`: SPEC_ARCHITECT + SPEC_DESIGN_COMPONENTS
  - [x] `wave_4_parallel`: DEPENDENCIES + SOLUTIONING_EPICS
  - [x] `wave_5_sequential`: SOLUTIONING_TASKS
  - [x] `wave_6_sequential`: VALIDATE
  - [x] `wave_7_sequential`: DONE

- [x] Update phase dependencies

  - [x] SPEC_ARCHITECT depends on SPEC_PM
  - [x] SPEC_DESIGN_COMPONENTS depends on SPEC_PM + STACK_SELECTION

- [x] Measure workflow time reduction (target: 31% faster)

---

### Enhancement #6: Dedicated Design Agent

> **Effort:** 2 days | **Impact:** 🟢🟢🟢

- [x] Create `designer` agent

  - [x] Role: UI/UX Designer and Design Systems Architect
  - [x] Perspective: Head of Design

- [x] Define designer responsibilities

  - [x] Create design-tokens.md (stack-agnostic)
  - [x] Map tokens to component-inventory.md (post-stack)
  - [x] Generate journey-maps.md (interaction patterns)
  - [x] Enforce anti-AI-slop principles

- [x] Add anti-AI-slop validation

  - [x] Forbidden: purple gradients, Inter font default, blob backgrounds
  - [x] Required: OKLCH colors, 60/30/10 rule, 8pt grid, 4 typography sizes

- [x] Split SPEC_DESIGN into two sub-phases
  - [x] SPEC_DESIGN_TOKENS (stack-agnostic, can start early)
  - [x] SPEC_DESIGN_COMPONENTS (requires stack selection)

---

### Enhancement #8: Smart Artifact Regeneration

> **Effort:** 3 days | **Impact:** 🟢🟢

- [x] Implement change detection

  - [x] Detect user artifact edits
  - [x] Calculate diff (what sections changed)
  - [x] Parse dependency graph for affected artifacts

- [x] Build impact analysis modal

  - [x] Show affected artifacts list
  - [x] Display impact levels: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW
  - [x] HIGH = requirements added/removed
  - [x] MEDIUM = requirements modified
  - [x] LOW = cosmetic changes

- [x] Implement user choice workflow
  - [x] "Regenerate All" (safest)
  - [x] "Regenerate Only High Impact"
  - [x] "Manual Review"
  - [x] "Ignore"

---

## Phase 4: Advanced Features (Weeks 7-8) - OPTIONAL

### Enhancement #9: CI/CD Pipeline Integration

> **Effort:** 3 days | **Impact:** 🟢🟢🟢

- [ ] Create GitHub Actions workflow

  - [ ] Trigger on push to `spec/**` branches
  - [ ] Trigger on PR to `specs/**` paths
  - [ ] Run `npm run spec:validate`
  - [ ] Run `npm run spec:constitutional-check`
  - [ ] Generate validation badge

- [ ] Add PR comment integration

  - [ ] Post validation results as PR comment
  - [ ] Include summary from validation-report.json

- [ ] Create GitLab CI config (alternative)
- [ ] Add Vercel deploy hook on handoff complete

---

### Artifact Diff Viewer

> **Effort:** 2 days | **Impact:** 🟢🟢

- [ ] Build diff display component
- [ ] Show changes between artifact versions
- [ ] Highlight additions and deletions
- [ ] Link to regeneration reason

---

### LLM Response Streaming

> **Effort:** 2 days | **Impact:** 🟢

- [ ] Stream artifact generation to frontend
- [ ] Show real-time progress indicators
- [ ] Improve perceived performance

---

## 📊 Database Schema Requirements

### New Tables

- [x] Create `validation_runs` table

  - [x] id, projectId, phase, passed, failureReasons, duration_ms, createdAt

- [x] Create `artifact_versions` table

  - [x] id, projectId, artifactId, version, contentHash, regenerationReason, createdAt

- [x] Create `auto_remedy_runs` table

  - [x] id, projectId, validationRunId, startedAt, completedAt, successful, changesApplied

- [x] Create `phase_snapshots` table
  - [x] id, projectId, phaseName, snapshotNumber, artifactsJson, metadata, userInputs, validationResults, gitCommitHash, gitBranch, createdAt

---

## 🎯 Success Metrics Targets

| Metric                     | Baseline | Target  |
| -------------------------- | -------- | ------- |
| Workflow Completion Rate   | ~70%     | >95%    |
| Validation Failure Rate    | ~40%     | <10%    |
| Time to First Artifact     | ~30 min  | <15 min |
| User Satisfaction (NPS)    | Unknown  | >50     |
| Spec-to-Code Alignment     | Unknown  | >90%    |
| Artifact Regeneration Rate | Unknown  | <20%    |
| Feedback Loop Closure Time | N/A      | <10 min |

---

## ✅ Exit Criteria by Phase

### Phase 1 Exit Criteria

- [x] VALIDATE phase failures automatically trigger targeted fixes
- [x] Real-time validation dashboards operational
- [x] Phase dependency graph documented

### Phase 2 Exit Criteria

- [x] PRD and Architecture approval gates functional
- [x] Specs tracked in Git with full history
- [x] Rollback to previous phase works

### Phase 3 Exit Criteria

- [x] Workflow completion time reduced by 30%
- [x] Design artifacts generated by specialized agent
- [x] Editing PRD shows impact analysis

### Phase 4 Exit Criteria

- [ ] GitHub Actions validate specs on push
- [ ] Users can see diffs between regenerations
- [ ] Artifact generation shows real-time progress

---

## 🚫 Anti-Patterns to Avoid

- [ ] ❌ Do NOT add mandatory gates everywhere
- [ ] ❌ Do NOT over-engineer rollback (simple snapshots suffice)
- [ ] ❌ Do NOT prematurely parallelize beneficial sequential phases
- [ ] ❌ Do NOT add excessive validators (focus on high-impact)
- [ ] ❌ Do NOT introduce breaking changes

---

## ✨ Core Strengths to Preserve

- [ ] ✅ Constitutional Articles (governance model)
- [ ] ✅ Hybrid Clarification Mode (speed + control balance)
- [ ] ✅ Test-First Discipline (strict enforcement)
- [ ] ✅ Anti-AI-Slop Design (market differentiator)
- [ ] ✅ Intelligent Defaults (expand to more areas)

---

**Document Version:** 1.0  
**Last Updated:** December 31, 2025  
**Generated From:** PHASE_WORKFLOW_ENHANCEMENT_PLAN.md v1.6
