# Superpowers 2.0: 12-Phase Enhancement Plan

> **Version**: 2.0 | **Date**: 2026-01-03 | **Status**: Final Draft

## Executive Summary

This plan transforms the Spec-Driven platform's 12-phase workflow into a **phenomenal artifact generation engine** by integrating advanced prompt engineering patterns from Superpowers methodology, Chain-of-Thought reasoning, and multi-agent orchestration research.

---

## Phase-by-Phase Enhancement Blueprint

### Phase 1: ANALYSIS

**Agent**: Analyst (CEO/CPO Perspective)  
**Current Output**: `constitution.md`, `project-brief.md`, `personas.md`, `project-classification.json`

#### Superpowers Enhancement: "Brainstorming + YAGNI Gate"

**Prompt Injection Strategy**:

```markdown
Before generating ANY document:

1. Ask: "What happens if we DON'T build this?" → Forces scope justification
2. Present design in 200-300 word SECTIONS → User validates each before continuing
3. Mark ALL assumptions with [AI ASSUMED: reason] markers
```

**Quality Amplifiers**:

- Chain-of-Thought: Force the agent to show reasoning for each persona created
- Autoconsistency: Generate 3 persona variations, select most coherent
- SMART metric lock: Success metrics become "immutable locks" for all following phases

---

### Phase 2: STACK_SELECTION

**Agent**: Architect (CTO Perspective)  
**Current Output**: `stack-analysis.md`, `stack-decision.md`, `stack-rationale.md`, `stack.json`

#### Superpowers Enhancement: "Red-Team Alternatives"

**Prompt Injection Strategy**:

```markdown
For EACH stack recommendation:

1. Generate "Why This Fails" section → Explicit failure mode analysis
2. Score against Phase 1 constraints → Must reference classification.json
3. Include "Migration Path" → What if we outgrow this stack?
```

**Quality Amplifiers**:

- Adversarial Critic: Secondary prompt adopts "Skeptical CTO" persona
- Trade-off Matrix: Ensure no false optimism in recommendations
- Constraint Echo: Reference exact Phase 1 SMART metrics in justification

---

### Phase 3: SPEC_PM

**Agent**: PM (CPO Perspective)  
**Current Output**: `PRD.md`

#### Superpowers Enhancement: "Behavioral Locking"

**Prompt Injection Strategy**:

```markdown
Each requirement MUST:

1. Have Gherkin AC granular enough to be unit test definitions
2. Link explicitly to a persona by NAME (not generic "user")
3. Be assigned a [LOCK-REQ-XXX] ID that validators can reference
```

**Quality Amplifiers**:

- Test-First Semantics: Gherkin steps ARE the test specs
- Traceability Guarantee: Every requirement traces to Phase 1 persona
- Dependency Graph: Visualize requirement dependencies as DAG

---

### Phase 4: SPEC_ARCHITECT

**Agent**: Architect (CTO Perspective)  
**Current Output**: `data-model.md`, `api-spec.json`

#### Superpowers Enhancement: "Contract Enforcement"

**Prompt Injection Strategy**:

```markdown
1. For each API endpoint, include "Persona Access" annotation
2. OpenAPI must include rate-limit headers for NFR compliance
3. Data model must satisfy Phase 1 scale tier (e.g., indexes for "enterprise")
```

**Quality Amplifiers**:

- Schema-to-Persona Mapping: Every entity links to a user story
- NFR Integration: Include response time annotations in OpenAPI
- Mermaid ER Validation: Auto-check relationship cardinality

---

### Phase 5: SPEC_DESIGN_TOKENS

**Agent**: Designer  
**Current Output**: `design-tokens.md`

#### Superpowers Enhancement: "Anti-Slop Physics"

**Prompt Injection Strategy**:

```markdown
1. NO purple/indigo defaults → Derive colors from project brief
2. Define animation as PHYSICS (spring stiffness, damping) not just duration
3. Use OKLCH color space for perceptual uniformity
```

**Quality Amplifiers**:

- Brand Extraction: Colors derived from constitution.md values
- Motion Physics: `{ stiffness: 400, damping: 30 }` not `"300ms"`
- Accessibility Lock: All color pairs checked for WCAG AA contrast

---

### Phase 6: SPEC_DESIGN_COMPONENTS

**Agent**: Designer  
**Current Output**: `component-mapping.md`, `journey-maps.md`

#### Superpowers Enhancement: "Interaction Recipes"

**Prompt Injection Strategy**:

```markdown
1. Map each component to Phase 3 user story
2. Include micro-interaction specs with exact physics parameters
3. Document error states and empty states explicitly
```

**Quality Amplifiers**:

- Journey-to-Requirement: Each journey map step links to REQ-XXX
- State Coverage: Normal, loading, error, empty for every component
- Responsive Behavior: Document breakpoint behavior

---

### Phase 7: FRONTEND_BUILD

**Agent**: Frontend Developer  
**Current Output**: React components, `lib/motion.ts`

#### Superpowers Enhancement: "Subagent Dispatch + Self-Review"

**Prompt Injection Strategy**:

```markdown
For EACH component:

1. Fresh subagent dispatch → No accumulated context pollution
2. Before reporting complete, run SELF-REVIEW CHECKLIST:
   - [ ] Follows shadcn/ui pattern
   - [ ] Uses design tokens from Phase 5
   - [ ] Includes useReducedMotion accessibility
   - [ ] No console.log artifacts
```

**Quality Amplifiers**:

- Component Isolation: Each component generated independently
- MCP Verification: Use exa-code to verify against real shadcn patterns
- Anti-Slop Gate: Reject generic placeholder text

---

### Phase 8: DEPENDENCIES

**Agent**: DevOps  
**Current Output**: `DEPENDENCIES.md`, `dependencies.json`

#### Superpowers Enhancement: "YAGNI Justification"

**Prompt Injection Strategy**:

```markdown
For EACH dependency:

1. Link to specific REQ-XXX requirement it satisfies
2. Include "Why Not [Alternative]" analysis
3. Flag if bundle impact > 50KB (needs justification)
```

**Quality Amplifiers**:

- Zero Speculation: Only packages explicitly needed
- Security Audit: Flag any package with known CVEs
- License Enforcement: Must be MIT/Apache/BSD compatible

---

### Phase 9: SOLUTIONING

**Agent**: Scrum Master (VP Engineering)  
**Current Output**: `architecture.md`, `epics.md`, `tasks.md`, `plan.md`

#### Superpowers Enhancement: "Bite-Sized Execution Recipes"

**Prompt Injection Strategy**:

```markdown
Each task MUST include:

1. Estimated time: 15-30 minutes (not 4-8 hours)
2. Exact file paths to create/modify
3. Skeleton code (3-5 lines showing structure)
4. Verification command: `npm test -- <pattern>`
```

**Quality Amplifiers**:

- Junior-Engineer Proof: Clear enough for no-context execution
- Parallelism Markers: [P] for concurrent tasks
- Test-First Order: Test file listed BEFORE implementation file

---

### Phase 10: VALIDATE

**Agent**: Validator  
**Current Output**: `validation-report.md`, `coverage-matrix.md`

#### Superpowers Enhancement: "Semantic Integrity Checks"

**Prompt Injection Strategy**:

```markdown
Beyond ID matching, verify:

1. Does DB schema support user flow concurrency? (Phase 4 vs Phase 1)
2. Do API response times align with NFR targets?
3. Are all [AI ASSUMED] items documented?
```

**Quality Amplifiers**:

- Malicious User Persona: Find logical gaps in security
- Cross-Phase Coherence: Architecture supports scale tier
- Constitutional Compliance: All 5 articles verified

---

### Phase 11: AUTO_REMEDY

**Agent**: Validator  
**Current Output**: Remediated artifacts

#### Superpowers Enhancement: "Root Cause Tracing + Healer Dispatch"

**Prompt Injection Strategy**:

```markdown
When validation fails:

1. Trace error back to originating phase (dependency graph)
2. Dispatch "Healer" subagent with specific error context
3. Apply safeguards: Don't overwrite user edits, limit retries
```

**Quality Amplifiers**:

- Exposure Mapping: Know which artifacts a fix affects
- Targeted Re-run: Only re-run the offending phase
- Self-Healing Loop: Healer includes remediation knowledge

---

### Phase 12: DONE

**Agent**: Orchestrator  
**Current Output**: `README.md`, `HANDOFF.md`, `project.zip`

#### Superpowers Enhancement: "Batch Execution Roadmap"

**Prompt Injection Strategy**:

```markdown
HANDOFF.md must include:

1. Subagent Execution Protocol for implementation team
2. Batch checkpoints (pause every 3-5 tasks for review)
3. "Do Not Guess" rule for blockers
```

**Quality Amplifiers**:

- Implementation Roadmap: Clear "start here" for developers/AI
- Batch Cadence: Prevents runaway implementation
- Context Preservation: Include all semantic locks for future reference

---

## Orchestration Layer Upgrades

### Semantic Goal Locking

Phase 1 outputs become "immutable locks" that constrain all subsequent agents:

- `project-classification.json` → Forces stack template selection
- SMART metrics → Validated in Phase 10

### The "Checker Pattern"

Every generator phase is paired with a critic persona:
| Phase | Generator | Critic Persona |
|-------|-----------|----------------|
| 2 | Architect | Skeptical CTO |
| 3 | PM | QA Lead |
| 4 | Architect | Security Auditor |
| 7 | FE Dev | A11y Specialist |

### Chain-of-Thought Enforcement

All agents must show reasoning before conclusions:

```markdown
## Reasoning (Required)

1. [Show analysis step]
2. [Show comparison step]
3. [Show decision step]

## Output

[Final artifact based on reasoning above]
```

---

## Implementation Priority

| Priority    | Enhancement               | Phases Affected | Impact               |
| ----------- | ------------------------- | --------------- | -------------------- |
| 🔴 Critical | Semantic Goal Locking     | 1 → All         | Prevents drift       |
| 🔴 Critical | Bite-Sized Task Format    | 9, 12           | Enables automation   |
| 🟠 High     | Subagent Self-Review      | 7               | Quality boost        |
| 🟠 High     | Semantic Integrity Checks | 10              | Catches logic errors |
| 🟡 Medium   | Root Cause Tracing        | 11              | Faster remediation   |
| 🟡 Medium   | Checker Pattern           | 2, 3, 4, 7      | Quality gates        |

---

## References

- **Chain-of-Thought Prompting**: AI Architecture Pattern (Medium/ArXiv 2025)
- **SPARC2 Agent Framework**: Task-adaptive prompting patterns
- **Autoconsistency Techniques**: DAIR Prompt Engineering Guide
- **Superpowers**: Brainstorming, Writing-Plans, Subagent-Driven Development skills
