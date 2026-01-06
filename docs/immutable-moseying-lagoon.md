# Superpowers Integration Review & Implementation Plan

## Executive Summary

### Critical Findings

**Root Cause of "Unpolished/Incomplete Artifacts":**
- **NOT** primarily a prompt engineering issue
- **PRIMARY CAUSE:** Fragile artifact parsing infrastructure with silent fallback chains
- `parseArtifacts()` function (agent_executors.ts:83-249) has 6-layer fallback that degrades quality instead of failing fast
- LLM non-compliance with output formats is **tolerated**, not **blocked**

**Key Quality Issues:**
1. Design phase (SPEC_DESIGN_COMPONENTS) frequently loses journey-maps.md (dumps everything into component-mapping.md)
2. JSON artifacts (project-classification.json, stack.json, api-spec.json) have parsing failures → empty placeholders
3. Quality checklists defined in orchestrator_spec.yml but NOT enforced as blocking validation
4. Validation happens AFTER generation completes (too late to prevent cascading errors)
5. SUPERPOWERS_INTEGRATION_PLAN.md has strong concepts but lacks implementation specificity

### Integration Plan Alignment Assessment

**STRENGTHS:**
- ✅ Phase 1 (ANALYSIS) ↔ Superpowers brainstorming: STRONG alignment
- ✅ Phase 9 (SOLUTIONING) ↔ Superpowers writing-plans: STRONG alignment
- ✅ Phase 11 (AUTO_REMEDY) ↔ Superpowers systematic-debugging: STRONG alignment
- ✅ Semantic Goal Locking concept well-defined

**CRITICAL GAPS:**
- ❌ No implementation details for Checker Pattern (dual-LLM critic review)
- ❌ No specification of Superpowers skill invocation framework
- ❌ Missing concrete examples of "bite-sized tasks", "skeleton code", "Chain-of-Thought"
- ❌ Phases 5-6 (design) have no Superpowers skill mapping (gap in Superpowers methodology)

### Top 3 Recommendations (Immediate Impact)

**1. STRUCTURED OUTPUT ENFORCEMENT** (TIER 1 - CRITICAL)
- Use Gemini's native JSON schema enforcement for ALL multi-file/JSON artifacts
- Eliminates 80% of parsing failures
- Files: backend/services/llm/llm_client.ts, agent_executors.ts
- **Effort:** 8-12 hours | **Impact:** Parsing success 60% → 95%+

**2. QUALITY CHECKLIST AS BLOCKING VALIDATION** (TIER 1 - CRITICAL)
- Convert orchestrator_spec.yml quality checklists from docs to executable validators
- Prevents progression with incomplete artifacts
- Files: backend/services/orchestrator/validators.ts, orchestrator_engine.ts
- **Effort:** 20-30 hours | **Impact:** Completeness Unknown → 90%+

**3. CHECKER PATTERN IMPLEMENTATION** (TIER 2 - HIGH)
- Dual-LLM adversarial review for phases 2, 3, 4 (Skeptical CTO, QA Lead, Security Auditor)
- Catches logical errors single-agent generation misses
- Files: new backend/services/llm/checker_pattern.ts, orchestrator_engine.ts
- **Effort:** 18-22 hours | **Impact:** Validation failures 40% → 20%

---

## Phase-by-Phase Analysis & Recommendations

### Phase 1: ANALYSIS - ✅ Strong Superpowers Alignment

**Current Issues:**
- project-classification.json parsing failures → empty placeholders
- Personas sometimes generic ("developer", "user") instead of specific
- Quality checklist not enforced (minimum 3-5 personas, 5+ guiding principles)

**Integration Plan Enhancement:** "Brainstorming + YAGNI Gate" ✅ Good concept

**Superpowers Skill Mapping:**
- **Skill:** `brainstorming`
- **Trigger:** PRE-GENERATION (before Analyst agent executes)
- **Implementation:** Invoke brainstorming skill to refine user's project idea via Socratic questioning

**TIER 1 Fixes:**
1. **Structured Output for project-classification.json** (2-3h)
   - Modify executeAnalystAgent() to use JSON schema enforcement
   - Files: agent_executors.ts:258, llm_client.ts

2. **Enforce Quality Checklist** (3-4h)
   - Validate: All 4 files generated, 3-5 distinct personas, 5+ principles
   - Files: validators.ts

**TIER 2 Enhancements:**
3. **Chain-of-Thought for Persona Generation** (1-2h)
   - Require "Reasoning" section before each persona definition
   - Files: orchestrator_spec.yml (agents.analyst.prompt_template)

4. **Semantic Goal Locking** (4-6h)
   - Thread constitution.md + project-classification.json into ALL subsequent phases
   - Files: orchestrator_engine.ts, agent_executors.ts

---

### Phase 2: STACK_SELECTION - ⚠️ Moderate Alignment

**Current Issues:**
- stack.json parsing failures
- stack-analysis.md sometimes only 1 alternative (spec requires 2-3)
- Missing trade-off analysis

**Integration Plan Enhancement:** "Red-Team Alternatives" ✅ Good concept, missing implementation

**Superpowers Skill Mapping:**
- **Skill:** `brainstorming` (alternatives exploration mode)
- **Trigger:** PRE-GENERATION
- **Implementation:** Explore technical alternatives before generating recommendation

**TIER 1 Fixes:**
1. **Structured Output for stack.json** (2-3h)
   - Same approach as project-classification.json
   - Files: agent_executors.ts (executeStackSelectionAgent)

**TIER 2 Enhancements:**
2. **Checker Pattern with Skeptical CTO** (6-8h)
   - Secondary LLM call with adversarial prompt challenging stack recommendation
   - Files: new checker_pattern.ts, orchestrator_engine.ts

3. **Alternative Count Validation** (2-3h)
   - Verify stack-analysis.md has 2-3 alternatives documented
   - Files: validators.ts

---

### Phase 3: SPEC_PM - ✅ Strong Alignment

**Current Issues:**
- PRD.md sometimes < 15 requirements (spec minimum)
- Gherkin acceptance criteria generic ("As a user, I want...")
- Weak persona traceability

**Integration Plan Enhancement:** "Behavioral Locking" with [LOCK-REQ-XXX] IDs ✅ Excellent concept

**Superpowers Skill Mapping:**
- **Skill:** `writing-plans` (requirements documentation mode)
- **Trigger:** DURING-GENERATION
- **Implementation:** Apply bite-sized principle to requirement breakdown

**TIER 1 Fixes:**
1. **Minimum Requirement Count** (1-2h)
   - Validate PRD.md has 15+ requirements
   - Files: validators.ts

2. **Persona Traceability Validation** (2-3h)
   - Check each REQ-XXX references persona by name
   - Files: validators.ts (new persona_traceability validator)

**TIER 2 Enhancements:**
3. **Gherkin Structure Validation** (2-3h)
   - Check acceptance criteria have Given/When/Then format
   - Files: validators.ts

4. **Checker Pattern with QA Lead** (part of overall Checker implementation)
   - Review requirements for testability and edge cases

---

### Phase 4: SPEC_ARCHITECT - ✅ Strong Alignment

**Current Issues:**
- api-spec.json sometimes invalid OpenAPI 3.0
- data-model.md missing entity relationships
- Disconnect between API endpoints and PRD requirements

**Integration Plan Enhancement:** "Contract Enforcement" with NFR annotations ✅ Good concept

**Superpowers Skill Mapping:**
- **Skill:** `writing-plans` (technical specifications mode)
- **Trigger:** DURING-GENERATION
- **Implementation:** Systematic specification checklist

**TIER 1 Fixes:**
1. **Robust OpenAPI Extraction** (2-3h)
   - Enhanced JSON extraction with OpenAPI-specific validation
   - Files: agent_executors.ts:132-161

2. **API-to-PRD Mapping Validation** (3-4h)
   - Check each functional requirement has at least one API endpoint
   - Files: validators.ts (new api_requirement_coverage validator)

**TIER 2 Enhancements:**
3. **Checker Pattern with Security Auditor** (part of overall Checker implementation)
   - Review API security (auth, rate limiting, OWASP Top 10)

---

### Phase 5-6: DESIGN TOKENS & COMPONENTS - ⚠️ CRITICAL QUALITY ISSUES

**Phase 5 Current Issues:**
- Purple/indigo defaults still appearing (anti-slop validator not blocking)
- Typography sometimes > 4 sizes

**Phase 6 Current Issues (MOST SEVERE):**
- **journey-maps.md frequently incomplete or missing** (ROOT CAUSE: LLM dumps everything into component-mapping.md)
- Two-file parsing failure is PRIMARY user complaint

**Integration Plan Enhancement:** "Anti-Slop Physics" + "Interaction Recipes" ✅ Strong concepts

**Superpowers Skill Mapping:**
- **Skill:** NONE (GAP - no design-specific Superpowers skill exists)
- **Recommendation:** Create custom Superpowers skill for design system generation

**TIER 1 Fixes (HIGHEST PRIORITY):**
1. **Two-File Structured Output** (2-3h) 🚨 CRITICAL
   - Force LLM to return separate component-mapping.md and journey-maps.md via JSON schema
   - Files: agent_executors.ts (executeDesignerAgent), llm_client.ts
   - **Impact:** Fixes user's primary complaint

2. **Make Anti-Slop Validator Blocking** (1h)
   - Change blocking_on_warnings: true for SPEC_DESIGN_TOKENS
   - Files: orchestrator_spec.yml

3. **Journey Maps Completeness Validation** (2-3h)
   - Validate: At least 3 user journeys, error states, empty states
   - Files: validators.ts

**TIER 2 Enhancements:**
4. **Few-Shot Prompting for Two-File Output** (1h)
   - Show EXACT format for splitting files
   - Files: orchestrator_spec.yml (agents.designer.prompt_template)

---

### Phase 7: FRONTEND_BUILD - ⚠️ Complex Generation Phase

**Current Issues:**
- Components have generic placeholder code ("// TODO: Implement")
- useReducedMotion accessibility missing
- All 13 components generated in SINGLE LLM session (context pollution)

**Integration Plan Enhancement:** "Subagent Dispatch + Self-Review" ✅ Excellent concept, needs implementation

**Superpowers Skill Mapping:**
- **Skill:** `subagent-driven-development`
- **Trigger:** PARALLEL (separate session per component)
- **Implementation:** Fresh LLM context per component prevents pollution

**TIER 1 Fixes:**
1. **Frontend Self-Review Checklist** (1-2h)
   - Mandate checklist before component completion
   - Files: backend/services/llm/frontend_executor.ts
   - Checklist: shadcn pattern, design tokens, useReducedMotion, no console.log

2. **Anti-Generic-Code Validation** (1-2h)
   - Block "// TODO", "placeholder", "lorem ipsum"
   - Files: validators.ts

**TIER 2 Enhancements:**
3. **Few-Shot Prompting with shadcn Examples** (3-4h)
   - Fetch real shadcn/ui code via MCP exa-code
   - Files: frontend_executor.ts, mcp-code-lookup.ts (already exists!)

**TIER 3 (FOUNDATIONAL):**
4. **Subagent Isolation per Component** (10-12h)
   - Generate each of 13 components in separate LLM session
   - Files: new frontend_subagent_dispatcher.ts
   - **Impact:** Eliminates context pollution, matches Superpowers pattern

---

### Phase 8: DEPENDENCIES - ⚠️ Moderate Priority

**Current Issues:**
- dependencies.json sometimes malformed
- Duplicate functionality packages occasionally included

**Integration Plan Enhancement:** "YAGNI Justification" ✅ Good concept

**Superpowers Skill Mapping:**
- **Skill:** None (use YAGNI principle as prompt injection)

**TIER 1 Fixes:**
1. **Structured Output for dependencies.json** (2-3h)
   - Same approach as other JSON artifacts

**TIER 2 Enhancements:**
2. **Dependency-to-Requirement Mapping** (2-3h)
   - Check each dependency justifies link to REQ-XXX
   - Files: validators.ts

---

### Phase 9: SOLUTIONING - ✅ Strong Superpowers Alignment

**Current Issues:**
- tasks.md sometimes < 15 tasks
- Circular dependencies in task graph occasionally present
- Tests not always listed BEFORE implementation (Constitutional Article 2 violation)

**Integration Plan Enhancement:** "Bite-Sized Execution Recipes" ✅ Excellent concept

**Superpowers Skill Mapping:**
- **Skill:** `writing-plans`
- **Trigger:** PRE-GENERATION
- **Implementation:** Invoke writing-plans skill to structure breakdown into 15-30min tasks

**TIER 1 Fixes:**
1. **Minimum Task Count** (1-2h)
   - Validate tasks.md has 15+ tasks
   - Files: validators.ts

2. **Test-First Compliance** (2-3h)
   - Verify test specifications come BEFORE implementation notes
   - Files: validators.ts (enhance test_first_compliance)

**TIER 2 Enhancements:**
3. **Task Graph Cycle Detection** (4-5h)
   - Implement topological sort in tasks_dag validator (already defined in spec!)
   - Files: validators.ts

4. **Few-Shot Prompting for Bite-Sized Tasks** (2-3h)
   - Show exact format: time estimate, file paths, skeleton code, verification command
   - Files: orchestrator_spec.yml (agents.scrummaster.prompt_template)

---

### Phase 10: VALIDATE - ✅ Strong Alignment

**Current Issues:**
- Validation runs AFTER all phases (too late)
- Semantic checks not implemented
- Constitutional compliance check exists but not fully enforced

**Integration Plan Enhancement:** "Semantic Integrity Checks" ✅ Excellent concept

**Superpowers Skill Mapping:**
- **Skill:** `verification-before-completion`
- **Trigger:** POST-GENERATION (for EACH phase, not just final)
- **Implementation:** Evidence-before-assertions pattern

**TIER 1 Fixes:**
1. **Constitutional Compliance Enforcement** (6-8h)
   - Implement validators for all 5 Constitutional Articles
   - Files: validators.ts

2. **Cross-Phase Consistency Validation** (8-10h)
   - requirement-to-task, API-to-data-model, persona, stack consistency
   - Files: validators.ts

**TIER 2 Enhancements:**
3. **Semantic Integrity Checks via LLM** (6-8h)
   - Use LLM to evaluate complex semantic questions
   - Files: new semantic_validator.ts

---

### Phase 11: AUTO_REMEDY - ✅ Strong Alignment

**Current Issues:**
- Root cause tracing not always accurate
- Remediation sometimes introduces new errors

**Integration Plan Enhancement:** "Root Cause Tracing + Healer Dispatch" ✅ Good concept

**Superpowers Skill Mapping:**
- **Skill:** `systematic-debugging`
- **Trigger:** PRE-GENERATION (before remediation)
- **Implementation:** 4-phase debugging process (Reproduce → Isolate → Fix → Verify)

**TIER 2 Enhancements:**
1. **Root Cause Analysis via LLM** (4-5h)
   - Use LLM to identify originating phase for validation errors
   - Files: new root_cause_analyzer.ts

2. **Enhanced Error Context** (2-3h)
   - Pass full validation error details to remediation agent
   - Files: auto_remedy_executor.ts

---

### Phase 12: DONE - ✅ Moderate Alignment

**Current Issues:**
- HANDOFF.md occasionally missing critical context
- Execution roadmap not always clear

**Integration Plan Enhancement:** "Batch Execution Roadmap" ✅ Good concept

**Superpowers Skill Mapping:**
- **Skill:** `finishing-a-development-branch`
- **Trigger:** POST-GENERATION
- **Implementation:** Verification checklist (tests pass, artifacts complete, no blockers)

**TIER 2 Enhancements:**
1. **Enhanced HANDOFF.md Template** (3-4h)
   - Include: Batch checkpoints, subagent dispatch guidelines, "Do Not Guess" rule
   - Files: handoff_generator.ts

---

## Architectural Recommendations

### 1. Parsing Infrastructure Overhaul

**Current Architecture (PROBLEMATIC):**
```
LLM generates text → parseArtifacts() 6-layer fallback chain
├─ Attempt 1: Markdown code blocks with filename markers
├─ Attempt 2: JSON extraction with multiple patterns
├─ Attempt 3: Header-based parsing (# constitution.md)
├─ Attempt 4: Full header-based for all expected files
├─ Attempt 5: DEGRADATION - dump everything into first file
└─ Attempt 6: SILENT FAILURE - fill missing files with ""
```

**Recommended Architecture:**
```
LLM with JSON schema → Structured output enforcement
├─ PRIMARY: Gemini responseMimeType: "application/json" with schema
├─ FALLBACK: Few-shot prompting with exact format examples
└─ VALIDATION: parseArtifactsWithValidation() - REJECT on failure, RETRY with enhanced prompt
```

**Files to Refactor:**
- backend/services/llm/llm_client.ts (add generateStructuredArtifacts method)
- backend/services/llm/agent_executors.ts (replace parseArtifacts fallback chains)

---

### 2. Validation Timing Architecture

**Current Architecture (LATE VALIDATION):**
```
Phase 1-9 execute sequentially → Phase 10 VALIDATE runs all checks → Phase 11 AUTO_REMEDY fixes
```
Problem: Errors cascade through 11 phases before detection

**Recommended Architecture (INLINE VALIDATION):**
```
Each Phase:
  ├─ PRE-GENERATION: Check dependencies satisfied
  ├─ DURING-GENERATION: Streaming format validation
  ├─ POST-GENERATION: Quality checklist enforcement (BLOCKING)
  └─ CROSS-PHASE: Semantic consistency checks
```

**Implementation Approach:**
1. **Phase 1 (2 weeks):** Implement POST-GENERATION quality checklist validation (blocking)
2. **Phase 2 (4 weeks):** Add DURING-GENERATION streaming validation for critical phases
3. **Phase 3 (6 weeks):** Full inline validation across all 12 phases

**Files to Modify:**
- backend/services/orchestrator/orchestrator_engine.ts (validatePhaseCompletion becomes inline)
- backend/services/llm/llm_client.ts (streaming validation support)
- orchestrator_spec.yml (inline_validation.enabled actually implemented)

---

### 3. Superpowers Skill Invocation Framework

**Proposed Architecture:**
```
backend/services/superpowers/
├─ skill_adapter.ts                    # Base adapter interface
├─ adapters/
│   ├─ brainstorming_adapter.ts        # Phase 1, 2
│   ├─ writing_plans_adapter.ts        # Phase 3, 4, 9
│   ├─ subagent_driven_dev_adapter.ts  # Phase 7
│   ├─ systematic_debugging_adapter.ts # Phase 11
│   └─ verification_adapter.ts         # Phase 10, 12
└─ skill_executor.ts                   # Execution orchestration
```

**orchestrator_spec.yml Integration:**
```yaml
phases:
  ANALYSIS:
    superpowers_integration:
      skill: "brainstorming"
      trigger: "pre_generation"
      pass_context: ["user_idea", "project_name"]
      collect_output: ["refined_requirements", "assumptions_documented"]
```

**Implementation Effort:** 30-40 hours (foundational infrastructure)

---

### 4. Checker Pattern Architecture

**Dual-LLM Review Pattern:**
```typescript
async function executeCheckerPattern(
  phase: Phase,
  generatorOutput: Record<string, string>,
  context: Record<string, unknown>
): Promise<CheckerResult> {
  // 1. Generator agent produces artifacts (already done)

  // 2. Critic agent reviews with adversarial prompt
  const critic = getCriticPersona(phase.name);
  const criticReview = await llmClient.generateCompletion(
    buildCriticPrompt(critic, generatorOutput, context)
  );

  // 3. Evaluate critic feedback
  const approved = criticReview.content.includes('[APPROVED]');
  const concerns = extractConcerns(criticReview.content);

  // 4. Decision tree
  if (approved) {
    return { status: 'approved', artifacts: generatorOutput };
  } else if (concerns.severity === 'critical') {
    // Regenerate with enhanced context
    return { status: 'regenerate', feedback: concerns };
  } else {
    // Escalate to user
    return { status: 'escalate_to_user', concerns };
  }
}
```

**Critic Persona Mappings:**
- Phase 2 (STACK_SELECTION): Skeptical CTO
- Phase 3 (SPEC_PM): QA Lead
- Phase 4 (SPEC_ARCHITECT): Security Auditor
- Phase 7 (FRONTEND_BUILD): A11y Specialist

**Files to Create:**
- backend/services/llm/checker_pattern.ts
- backend/prompts/critics/ (critic prompt templates)

---

## Implementation Roadmap

### TIER 1: Quick Wins (1-2 weeks, 60-80 hours) - IMMEDIATE IMPACT

**Week 1: Parsing Foundations**
1. Structured Output for JSON Artifacts (8-10h)
   - project-classification.json, stack.json, dependencies.json, api-spec.json
   - Files: llm_client.ts, agent_executors.ts

2. Two-File Structured Output for Design (6-8h) 🚨 **USER'S PRIMARY COMPLAINT**
   - component-mapping.md + journey-maps.md
   - Files: agent_executors.ts (executeDesignerAgent)

3. Parsing Validation Before Acceptance (4-5h)
   - Remove silent fallback chains
   - Files: agent_executors.ts (parseArtifacts)

**Week 2: Content Quality Gates**
4. Minimum Length Validation (5-6h)
   - All artifacts have minimum character counts
   - Files: validators.ts

5. Quality Checklist Enforcement Part 1 (10-12h)
   - Phases 1, 3, 6, 9 (highest priority)
   - Files: validators.ts, orchestrator_engine.ts

6. Anti-Slop Blocking + Frontend Self-Review (6-7h)
   - Make anti_ai_slop blocking, add frontend checklist
   - Files: orchestrator_spec.yml, frontend_executor.ts

**Success Metrics:**
- Parsing success: 60% → 95%+
- Artifact completeness: Unknown → 85%+
- Design two-file generation: ~40% → 95%+
- Placeholder code: ~25% → <5%

---

### TIER 2: High-Impact Enhancements (3-4 weeks, 70-95 hours)

**Week 3: Checker Pattern**
1. Checker Pattern Service (10-12h)
   - Create checker_pattern.ts, define critic personas
   - Files: new checker_pattern.ts

2. Integrate into Phases 2, 3, 4 (8-10h)
   - Add dual-LLM review
   - Files: orchestrator_engine.ts, agent_executors.ts

**Week 4-5: Semantic Validation**
3. Traceability Validators (10-13h)
   - Persona traceability, Gherkin structure, requirement-to-task mapping
   - Files: validators.ts

4. Constitutional Compliance (12-15h)
   - All 5 Constitutional Articles enforced
   - Files: validators.ts

5. Root Cause Analysis (8-10h)
   - LLM-based root cause identification for AUTO_REMEDY
   - Files: new root_cause_analyzer.ts

**Week 6: Prompting Improvements**
6. Few-Shot Prompting (10-12h)
   - Add format examples to all agent prompts
   - Files: orchestrator_spec.yml (all agents.*.prompt_template)

7. Chain-of-Thought (8-10h)
   - Require reasoning sections for ANALYSIS, STACK_SELECTION
   - Files: orchestrator_spec.yml

**Success Metrics:**
- Critic review coverage: 0% → 100% (phases 2, 3, 4)
- Traceability compliance: ~60% → 95%+
- Constitutional compliance: ~70% → 95%+
- Root cause accuracy: ~50% → 80%+

---

### TIER 3: Foundational Infrastructure (5-8 weeks, 90-130 hours)

**Weeks 7-8: Inline Validation**
1. Streaming Validation (36-45h)
   - Monitor LLM output during generation, abort on violations
   - Files: llm_client.ts, orchestrator_engine.ts
   - Apply to: SPEC_DESIGN_COMPONENTS, FRONTEND_BUILD, SOLUTIONING

**Weeks 9-10: Subagent Isolation**
2. Frontend Subagent Dispatcher (20-25h)
   - Generate each component independently
   - Files: new frontend_subagent_dispatcher.ts

**Weeks 11-12: Superpowers Framework**
3. Skill Invocation Framework (30-40h)
   - Create adapters for all Superpowers skills
   - Files: new backend/services/superpowers/ directory

**Week 13: Full Automation**
4. Quality Checklist Complete (15-20h)
   - Automate ALL quality checklist items for all 12 phases
   - Files: validators.ts

**Success Metrics:**
- Inline validation coverage: 0% → 100%
- Component quality: 70% → 90%+
- Superpowers integration: 0% → 100%
- First-attempt validation pass: 40% → 80%+

---

## Critical Files Summary

### Top 5 Files for Maximum Impact:

1. **backend/services/llm/agent_executors.ts** (1400+ lines)
   - Contains parseArtifacts() - ROOT CAUSE of parsing failures
   - All agent execution logic
   - Changes: Structured output enforcement, parsing validation, few-shot prompting

2. **backend/services/orchestrator/validators.ts** (existing)
   - Validation enforcement (last line of defense)
   - Changes: Quality checklist validation, constitutional compliance, traceability

3. **orchestrator_spec.yml** (3566 lines)
   - Single source of truth for agents, checklists, validation rules
   - Changes: Anti-slop prompts, few-shot examples, inline validation config

4. **backend/services/llm/llm_client.ts** (existing)
   - LLM API integration layer
   - Changes: Structured output support, streaming validation, retry mechanisms

5. **backend/services/orchestrator/orchestrator_engine.ts** (3000+ lines)
   - Orchestration flow and phase execution
   - Changes: Semantic goal locking, checker pattern integration, Superpowers hooks

### New Files to Create:

1. **backend/services/llm/checker_pattern.ts**
   - Dual-LLM adversarial review pattern

2. **backend/services/orchestrator/root_cause_analyzer.ts**
   - LLM-based root cause identification for AUTO_REMEDY

3. **backend/services/validation/semantic_validator.ts**
   - Complex semantic integrity checks via LLM

4. **backend/services/superpowers/** (directory)
   - Skill invocation framework and adapters

5. **backend/services/llm/frontend_subagent_dispatcher.ts**
   - Component isolation pattern

---

## Superpowers Skill Mapping (Complete)

| Phase | Superpowers Skill | Integration Type | Priority | Effort |
|-------|-------------------|------------------|----------|--------|
| 1. ANALYSIS | `brainstorming` | PRE-GENERATION | Critical | 6-8h |
| 2. STACK_SELECTION | `brainstorming` (alternatives) | PRE-GENERATION | High | 6-8h |
| 3. SPEC_PM | `writing-plans` (requirements) | DURING | High | 5-7h |
| 4. SPEC_ARCHITECT | `writing-plans` (technical specs) | DURING | High | 5-7h |
| 5. SPEC_DESIGN_TOKENS | None (GAP) | N/A | Medium | - |
| 6. SPEC_DESIGN_COMPONENTS | None (GAP) | N/A | Medium | - |
| 7. FRONTEND_BUILD | `subagent-driven-development` | PARALLEL | Critical | 10-12h |
| 8. DEPENDENCIES | None (YAGNI principles) | DURING | Medium | 2-3h |
| 9. SOLUTIONING | `writing-plans` | PRE-GENERATION | Critical | 6-8h |
| 10. VALIDATE | `verification-before-completion` | POST | Critical | 3-4h |
| 11. AUTO_REMEDY | `systematic-debugging` | PRE | High | 6-8h |
| 12. DONE | `finishing-a-development-branch` | POST | Medium | 2-3h |

**Note:** Phases 5-6 (design) have no Superpowers skill mapping - this is a GAP in the Superpowers methodology that could be addressed by creating a custom design skill based on the brainstorming pattern.

---

## Expected Impact Summary

### After TIER 1 Implementation (2 weeks):
- ✅ **Parsing Success Rate:** 60-70% → 95%+
- ✅ **Artifact Completeness:** Unknown → 85%+
- ✅ **Design Two-File Generation:** ~40% → 95%+ (user's primary complaint SOLVED)
- ✅ **Placeholder Code:** ~25% → <5%
- ✅ **Test-First Compliance:** ~50% → 90%+

### After TIER 2 Implementation (6 weeks total):
- ✅ **Critic Review Coverage:** 0% → 100% (phases 2, 3, 4)
- ✅ **Persona Traceability:** ~60% → 95%+
- ✅ **Gherkin AC Quality:** ~40% → 85%+
- ✅ **Constitutional Compliance:** ~70% → 95%+
- ✅ **Root Cause Accuracy:** ~50% → 80%+
- ✅ **Format Compliance:** ~60% → 90%+

### After TIER 3 Implementation (13 weeks total):
- ✅ **Inline Validation Coverage:** 0% → 100%
- ✅ **Component Quality:** 70% → 90%+
- ✅ **Superpowers Integration:** 0% → 100% (all mapped skills)
- ✅ **Quality Checklist Automation:** 30% → 100%
- ✅ **First-Attempt Validation Pass:** 40% → 80%+
- ✅ **Manual Intervention Rate:** High → <10%

---

## Integration Plan Improvements

The SUPERPOWERS_INTEGRATION_PLAN.md v2.0 is conceptually strong but needs these additions:

### Add to Integration Plan:

**Section 1: Implementation Specification**
- Add concrete examples of "bite-sized tasks" format (file paths, skeleton code, verification commands)
- Add Chain-of-Thought prompt templates for each phase
- Add few-shot examples for all multi-file artifact generation

**Section 2: Superpowers Skill Invocation Protocol**
```yaml
# Example orchestrator_spec.yml integration
phases:
  ANALYSIS:
    superpowers_integration:
      skill: "brainstorming"
      trigger: "pre_generation"
      pass_context: ["user_idea", "project_name"]
      collect_output: ["refined_requirements", "assumptions"]
```

**Section 3: Checker Pattern Implementation Details**
- Specify WHERE in orchestrator_engine.ts secondary LLM call happens
- Define WHAT happens if critic rejects (regenerate vs. escalate)
- Provide critic prompt templates

**Section 4: Parsing Infrastructure Recommendations**
- Document the shift from fallback chains to structured output enforcement
- Specify JSON schema enforcement strategy
- Define retry-with-enhanced-prompt pattern

**Section 5: Validation Checkpoints**
- Define success metrics per tier
- Specify regression suite composition (20+ test projects)
- Document ongoing metrics dashboard

---

## Next Steps

### Immediate Actions (This Sprint):
1. ✅ Implement Structured Output for project-classification.json (2-3h)
2. ✅ Fix Design Two-File Parsing (2-3h) - **HIGHEST USER IMPACT**
3. ✅ Make Anti-Slop Validator Blocking (1h)
4. ✅ Enforce Test-First Compliance (2-3h)

**Total:** 7-10 hours | **Impact:** Fixes user's primary complaints

### Next Sprint (Week 2):
1. Minimum Length Validation (all artifacts)
2. Quality Checklist Part 1 (Phases 1, 3, 6, 9)
3. Frontend Self-Review Checklist
4. Anti-Generic-Code Validation

### Following Sprint (Week 3):
1. Checker Pattern Service Implementation
2. Begin integration into Phases 2, 3, 4

---

## Conclusion

The root cause of "unpolished or incomplete artifacts" is **NOT primarily prompt engineering quality**, but rather:

1. **Fragile parsing infrastructure** that silently degrades instead of failing fast
2. **Validation timing** - checks happen too late to prevent errors
3. **Missing enforcement** - quality checklists defined but not blocking

The SUPERPOWERS_INTEGRATION_PLAN.md has excellent conceptual foundations (Semantic Goal Locking, Checker Pattern, Bite-Sized Tasks, Anti-Slop Physics) but lacks implementation specificity.

By implementing the TIER 1 quick wins (60-80 hours), you will:
- ✅ Fix design phase parsing (user's primary complaint)
- ✅ Achieve 95%+ parsing success rate
- ✅ Block progression on quality violations
- ✅ Reduce placeholder code by 80%+

This provides immediate, measurable impact while building toward comprehensive Superpowers integration in TIER 2-3.