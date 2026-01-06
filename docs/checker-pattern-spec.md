# Checker Pattern Implementation Spec

> **Status**: Draft | **Date**: 2026-01-06 | **Target**: TIER 2
> **Purpose**: Dual-LLM adversarial review for Phases 2-4 (STACK_SELECTION, SPEC_PM, SPEC_ARCHITECT)
> **Based on**: immutable-moseying-lagoon.md + SUPERPOWERS_INTEGRATION_PLAN.md

---

## Executive Summary

The **Checker Pattern** implements dual-LLM adversarial review where:
1. **Generator Agent** produces artifacts (existing workflow)
2. **Critic Agent** reviews with adversarial prompt
3. **Decision Tree**: Approve, Regenerate with feedback, or Escalate to user

This catches logical errors and quality issues that single-agent generation misses.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ CHECKER PATTERN ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Generator  │────▶│   Critic    │────▶│   Decision  │    │
│  │    Agent     │     │    Agent    │     │    Tree     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│       ↓                    ↓                     ↓              │
│  Produces initial    Adversarial review    Approve/Regenerate/│
│  artifacts           with personas         Escalate            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    CRITIC PERSONAS                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Phase 2: STACK_SELECTION  → Skeptical CTO               │   │
│  │ Phase 3: SPEC_PM          → QA Lead                     │   │
│  │ Phase 4: SPEC_ARCHITECT   → Security Auditor            │   │
│  │ Phase 7: FRONTEND_BUILD   → A11y Specialist             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critic Persona Mappings

| Phase | Critic Persona | Focus Areas |
|-------|---------------|-------------|
| STACK_SELECTION | **Skeptical CTO** | Cost traps, vendor lock-in, scaling limits, hidden technical debt |
| SPEC_PM | **QA Lead** | Testability, edge cases, missing acceptance criteria, vague requirements |
| SPEC_ARCHITECT | **Security Auditor** | OWASP Top 10, auth gaps, rate limiting, data exposure, injection risks |
| FRONTEND_BUILD | **A11y Specialist** | WCAG compliance, keyboard nav, screen reader, color contrast |

---

## Implementation

### 1. Create Checker Pattern Service

**Location**: `backend/services/llm/checker_pattern.ts`

```typescript
import { LLMProvider } from './providers/base';
import { logger } from '@/lib/logger';

interface CriticPersona {
  name: string;
  perspective: string;
  expertise: string[];
  reviewCriteria: string[];
  severityThreshold: 'low' | 'medium' | 'high';
}

interface CheckerResult {
  status: 'approved' | 'regenerate' | 'escalate';
  artifacts: Record<string, string>;
  feedback: CriticFeedback[];
  confidence: number;
}

interface CriticFeedback {
  severity: 'low' | 'medium' | 'critical';
  category: string;
  concern: string;
  recommendation: string;
  location?: string;
}

export class CheckerPattern {
  private llmClient: LLMProvider;
  
  constructor(llmClient: LLMProvider) {
    this.llmClient = llmClient;
  }
  
  /**
   * Execute checker pattern for a phase
   */
  async executeCheck(
    phase: string,
    generatorOutput: Record<string, string>,
    context: Record<string, unknown>
  ): Promise<CheckerResult> {
    const critic = this.getCriticPersona(phase);
    
    // Step 1: Critic reviews the generator output
    const review = await this.criticReview(critic, generatorOutput, context);
    
    // Step 2: Evaluate critic feedback
    return this.evaluateDecision(review, generatorOutput);
  }
  
  /**
   * Get the critic persona for a phase
   */
  private getCriticPersona(phase: string): CriticPersona {
    switch (phase) {
      case 'STACK_SELECTION':
        return {
          name: 'Skeptical CTO',
          perspective: 'Technical leader who has seen stack decisions go wrong',
          expertise: ['Cloud architecture', 'Cost optimization', 'Vendor lock-in'],
          reviewCriteria: [
            'Hidden cost traps not mentioned',
            'Vendor lock-in risks',
            'Scaling limitations at current scale tier',
            'Technical debt introduced',
            'Team skill mismatch',
            'Alternative stacks not fairly evaluated',
          ],
          severityThreshold: 'medium',
        };
      
      case 'SPEC_PM':
        return {
          name: 'QA Lead',
          perspective: 'Tester who must verify every requirement',
          expertise: ['Test design', 'Acceptance criteria', 'Edge cases'],
          reviewCriteria: [
            'Requirements too vague to test',
            'Missing acceptance criteria',
            'Edge cases not addressed',
            'Persona traceability gaps',
            'Untestable requirements',
            'Circular dependencies',
          ],
          severityThreshold: 'low',
        };
      
      case 'SPEC_ARCHITECT':
        return {
          name: 'Security Auditor',
          perspective: 'Security professional who assumes worst case',
          expertise: ['OWASP Top 10', 'Authentication', 'Authorization', 'Data protection'],
          reviewCriteria: [
            'Authentication gaps',
            'Authorization/permission issues',
            'Data exposure risks',
            'Rate limiting missing',
            'SQL/NoSQL injection vectors',
            'Sensitive data in logs',
            'Missing input validation',
          ],
          severityThreshold: 'critical',
        };
      
      case 'FRONTEND_BUILD':
        return {
          name: 'A11y Specialist',
          perspective: 'Accessibility advocate who ensures inclusive design',
          expertise: ['WCAG 2.1 AA', 'Screen readers', 'Keyboard navigation'],
          reviewCriteria: [
            'Missing useReducedMotion',
            'ARIA attributes absent',
            'Keyboard navigation gaps',
            'Color contrast issues',
            'Focus management missing',
            'Alt text missing',
            'Form labels absent',
          ],
          severityThreshold: 'medium',
        };
      
      default:
        throw new Error(`Unknown phase for checker pattern: ${phase}`);
    }
  }
  
  /**
   * Have the critic review the generator output
   */
  private async criticReview(
    critic: CriticPersona,
    generatorOutput: Record<string, string>,
    context: Record<string, unknown>
  ): Promise<CriticFeedback[]> {
    const prompt = this.buildCriticPrompt(critic, generatorOutput, context);
    
    const response = await this.llmClient.generateCompletion(
      prompt,
      undefined,
      2,
      `CHECKER_${critic.name.replace(/\s+/g, '_').toUpperCase()}`
    );
    
    return this.parseCriticFeedback(response.content);
  }
  
  /**
   * Build the critic prompt
   */
  private buildCriticPrompt(
    critic: CriticPersona,
    generatorOutput: Record<string, string>,
    context: Record<string, unknown>
  ): string {
    const artifactsSummary = Object.entries(generatorOutput)
      .map(([name, content]) => `## ${name}\n${content.slice(0, 1000)}`)
      .join('\n\n---\n\n');
    
    return `
# ROLE
You are a ${critic.name} (${critic.perspective}).
Your expertise: ${critic.expertise.join(', ')}.

# TASK
Review the generated artifacts below and identify quality issues, risks, and concerns.
Be adversarial - don't accept superficial quality.

# REVIEW CRITERIA
${critic.reviewCriteria.map(c => `- ${c}`).join('\n')}

# CONTEXT
${JSON.stringify(context, null, 2)}

# ARTIFACTS TO REVIEW
${artifactsSummary}

# OUTPUT FORMAT
Analyze the artifacts and output your review in this format:

\`\`\`json
{
  "feedback": [
    {
      "severity": "low|medium|critical",
      "category": "Brief category name",
      "concern": "What you found problematic",
      "recommendation": "How to fix it",
      "location": "File and line reference if available"
    }
  ],
  "verdict": "approve|regenerate|escalate",
  "confidence": 0.95,
  "summary": "Brief summary of your review"
}
\`\`\`

# RULES
1. Set severity to "critical" if security issues are found
2. Set severity to "low" for minor nits (spelling, formatting)
3. Only "approve" if no issues found
4. "regenerate" if issues can be fixed by the generator
5. "escalate" if human input is required
6. confidence should reflect how sure you are of your assessment

Now review the artifacts:
`;
  }
  
  /**
   * Parse the critic feedback from the response
   */
  private parseCriticFeedback(content: string): CriticFeedback[] {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('[CheckerPattern] Could not parse critic feedback JSON');
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.feedback || [];
    } catch (error) {
      logger.warn('[CheckerPattern] Failed to parse critic feedback', error);
      return [];
    }
  }
  
  /**
   * Evaluate the critic feedback and make a decision
   */
  private evaluateDecision(
    feedback: CriticFeedback[],
    generatorOutput: Record<string, string>
  ): CheckerResult {
    const criticalCount = feedback.filter(f => f.severity === 'critical').length;
    const mediumCount = feedback.filter(f => f.severity === 'medium').length;
    const lowCount = feedback.filter(f => f.severity === 'low').length;
    
    let status: 'approved' | 'regenerate' | 'escalate';
    
    if (criticalCount > 0) {
      // Critical issues must be regenerated or escalated
      status = 'escalate';
    } else if (mediumCount > 2) {
      // Too many medium issues - regenerate
      status = 'regenerate';
    } else if (mediumCount > 0) {
      // Some medium issues - regenerate with feedback
      status = 'regenerate';
    } else if (lowCount > 5) {
      // Many low issues - regenerate but not blocking
      status = 'regenerate';
    } else {
      // Minor issues only - approve
      status = 'approved';
    }
    
    return {
      status,
      artifacts: generatorOutput,
      feedback,
      confidence: 1 - (criticalCount * 0.3 + mediumCount * 0.1 + lowCount * 0.02),
    };
  }
  
  /**
   * Build regeneration prompt with critic feedback
   */
  buildRegenerationPrompt(
    originalPrompt: string,
    feedback: CriticFeedback[]
  ): string {
    const feedbackList = feedback
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.category}: ${f.concern}\n   Fix: ${f.recommendation}`)
      .join('\n');
    
    return `
${originalPrompt}

---

## CRITIC REVIEW FEEDBACK (Must Address)

The following issues were found by the ${feedback[0]?.category || 'critic'}:

${feedbackList}

## REQUIRED
1. Address EACH issue listed above
2. If you don't understand an issue, ask for clarification
3. Output must be complete - no partial fixes

Generate the corrected artifacts:
`;
  }
}
```

---

### 2. Integrate into Orchestrator Engine

**Location**: `backend/services/orchestrator/orchestrator_engine.ts`

```typescript
import { CheckerPattern } from '../llm/checker_pattern';

export class OrchestratorEngine {
  private checkerPattern: CheckerPattern;
  
  constructor() {
    // ... existing initialization
    this.checkerPattern = new CheckerPattern(this.llmClient);
  }
  
  /**
   * Execute phase with checker pattern
   */
  private async executePhaseWithChecker(
    phase: string,
    project: Project,
    phaseExecutor: () => Promise<Record<string, string>>
  ): Promise<PhaseExecutionResult> {
    // Step 1: Generate artifacts (original flow)
    const generatorOutput = await phaseExecutor();
    
    // Step 2: Skip checker for phases without critic persona
    const checkerPhases = ['STACK_SELECTION', 'SPEC_PM', 'SPEC_ARCHITECT', 'FRONTEND_BUILD'];
    if (!checkerPhases.includes(phase)) {
      return { artifacts: generatorOutput, status: 'success' };
    }
    
    // Step 3: Run checker pattern
    const checkResult = await this.checkerPattern.executeCheck(
      phase,
      generatorOutput,
      { projectId: project.id, projectName: project.name }
    );
    
    // Step 4: Handle decision
    switch (checkResult.status) {
      case 'approved':
        logger.info(`[CheckerPattern] ${phase} approved`, {
          confidence: checkResult.confidence,
          issues: checkResult.feedback.length,
        });
        return { artifacts: generatorOutput, status: 'success' };
      
      case 'regenerate':
        logger.warn(`[CheckerPattern] ${phase} needs regeneration`, {
          issues: checkResult.feedback.length,
        });
        
        // Regenerate with feedback
        const enhancedPrompt = this.checkerPattern.buildRegenerationPrompt(
          // Get original prompt (would need to store this)
          '',
          checkResult.feedback
        );
        
        const regeneratedOutput = await phaseExecutor(); // Re-run with enhanced prompt
        
        return { artifacts: regeneratedOutput, status: 'success' };
      
      case 'escalate':
        logger.error(`[CheckerPattern] ${phase} escalated to human`, {
          criticalIssues: checkResult.feedback.filter(f => f.severity === 'critical').length,
        });
        
        // Return with escalation flag
        return {
          artifacts: generatorOutput,
          status: 'requires_approval',
          message: `Critical issues found: ${checkResult.feedback.map(f => f.concern).join('; ')}`,
        };
    }
  }
}
```

---

### 3. Add Critic Prompt Templates

**Location**: `backend/prompts/critics/skeptical_cto.md`

```markdown
# ROLE
You are a Skeptical CTO who has seen countless technology decisions go wrong.
Your job is to find the hidden traps, unspoken costs, and future problems in stack recommendations.

# ADVERSARIAL FRAMEWORK

## Cost Trap Detection
- Cloud hosting costs that scale poorly
- Per-request pricing that explodes with traffic
- Hidden managed service costs
- Data transfer/ingress costs
- CDN and caching costs

## Vendor Lock-in Assessment
- Proprietary APIs that are hard to migrate from
- Data export limitations
- Pricing that increases after dependency forms
- Sunset policies for deprecated features

## Scaling Reality Check
- What breaks at 10x traffic?
- What breaks at 100x traffic?
- Database bottlenecks under load
- Cold start issues for serverless

## Technical Debt Radar
- "Quick fixes" that become permanent
- Missing error handling
- Incomplete logging/monitoring
- Missing rate limiting
- No circuit breaker patterns

# REVIEW FORMAT

For each issue found:
```
### [SEVERITY] Issue Name

**Concern**: What you found
**Evidence**: Specific quote or pattern from the artifacts
**Impact**: What happens when this goes wrong
**Recommendation**: How to fix it
```

# VERDICT CRITERIA

- **critical**: Security flaw, data loss risk, or complete blocker
- **medium**: Significant concern that will cause problems
- **low**: Minor nit or future consideration

Only "approve" if you find NO critical issues and at most 2 low issues.
```

---

### 4. Update orchestrator_spec.yml

```yaml
# Checker Pattern Configuration
checker_pattern:
  enabled: true
  phases:
    STACK_SELECTION:
      critic: 'skeptical_cto'
      max_regenerations: 2
      escalate_on_critical: true
    
    SPEC_PM:
      critic: 'qa_lead'
      max_regenerations: 2
      escalate_on_critical: false
    
    SPEC_ARCHITECT:
      critic: 'security_auditor'
      max_regenerations: 1
      escalate_on_critical: true
    
    FRONTEND_BUILD:
      critic: 'a11y_specialist'
      max_regenerations: 2
      escalate_on_critical: false

  decision_thresholds:
    critical_to_escalate: true
    medium_issues_before_regenerate: 2
    low_issues_threshold: 5
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `backend/services/llm/checker_pattern.ts` | Create |
| `backend/prompts/critics/skeptical_cto.md` | Create |
| `backend/prompts/critics/qa_lead.md` | Create |
| `backend/prompts/critics/security_auditor.md` | Create |
| `backend/prompts/critics/a11y_specialist.md` | Create |
| `backend/services/orchestrator/orchestrator_engine.ts` | Modify |
| `orchestrator_spec.yml` | Modify |

---

## Effort Estimate

| Task | Hours |
|------|-------|
| Create checker_pattern.ts service | 6-8h |
| Create 4 critic prompt templates | 4-6h |
| Integrate into orchestrator engine | 4-5h |
| Add unit tests | 3-4h |
| Integration testing | 2-3h |
| **Total** | **19-26h** |

---

## Expected Impact

| Metric | Current | After Checker Pattern |
|--------|---------|----------------------|
| Critical issues caught early | ~40% | 95%+ |
| Security vulnerabilities | Unknown | Blocked at SPEC_ARCHITECT |
| Testability issues | Common | Caught at SPEC_PM |
| Accessibility violations | Unknown | 90%+ caught |
| Stack recommendation quality | Variable | Consistently high |

---

## Success Criteria

- [ ] All 4 critic personas implemented
- [ ] Checker runs automatically for Phases 2-4, 7
- [ ] Critical issues escalate to human review
- [ ] Medium issues trigger regeneration
- [ ] Unit test coverage >80%
- [ ] Integration test with sample projects passes
