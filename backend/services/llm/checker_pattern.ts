/**
 * Checker Pattern Service
 * 
 * Dual-LLM adversarial review for quality assurance.
 * - Generator Agent produces artifacts
 * - Critic Agent reviews with adversarial persona
 * - Decision Tree: Approve, Regenerate, or Escalate
 */

import { LLMProvider } from './providers/base';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CriticPersona {
  name: string;
  perspective: string;
  expertise: string[];
  reviewCriteria: string[];
  severityThreshold: 'low' | 'medium' | 'high';
}

export interface CheckerResult {
  status: 'approved' | 'regenerate' | 'escalate';
  artifacts: Record<string, string>;
  feedback: CriticFeedback[];
  confidence: number;
  summary: string;
}

export interface CriticFeedback {
  severity: 'low' | 'medium' | 'critical';
  category: string;
  concern: string;
  recommendation: string;
  location?: string;
}

interface PhaseConfig {
  critic: string;
  maxRegenerations: number;
  escalateOnCritical: boolean;
}

// ============================================================================
// CRITIC PERSONAS
// ============================================================================

const CRITIC_PERSONAS: Record<string, CriticPersona> = {
  skeptical_cto: {
    name: 'Skeptical CTO',
    perspective: 'Technical leader who has seen stack decisions go wrong',
    expertise: ['Cloud architecture', 'Cost optimization', 'Vendor lock-in', 'Scaling patterns'],
    reviewCriteria: [
      'Hidden cost traps not mentioned',
      'Vendor lock-in risks',
      'Scaling limitations at current scale tier',
      'Technical debt introduced',
      'Team skill mismatch',
      'Alternative stacks not fairly evaluated',
      'Cold start issues',
      'Data transfer costs underestimated',
    ],
    severityThreshold: 'medium',
  },
  
  qa_lead: {
    name: 'QA Lead',
    perspective: 'Tester who must verify every requirement is testable',
    expertise: ['Test design', 'Acceptance criteria', 'Edge cases', 'Risk-based testing'],
    reviewCriteria: [
      'Requirements too vague to test',
      'Missing acceptance criteria',
      'Edge cases not addressed',
      'Persona traceability gaps',
      'Untestable requirements',
      'Circular dependencies in requirements',
      'Ambiguous success criteria',
      'Missing negative test cases',
    ],
    severityThreshold: 'low',
  },
  
  security_auditor: {
    name: 'Security Auditor',
    perspective: 'Security professional who assumes worst-case scenarios',
    expertise: ['OWASP Top 10', 'Authentication', 'Authorization', 'Data protection', 'Penetration testing'],
    reviewCriteria: [
      'Authentication gaps or weaknesses',
      'Authorization/permission issues',
      'Data exposure risks',
      'Rate limiting missing or inadequate',
      'SQL/NoSQL injection vectors',
      'Sensitive data in logs',
      'Missing input validation',
      'Insecure direct object references',
      'Missing security headers',
      'Crypto usage issues',
    ],
    severityThreshold: 'high',
  },
  
  a11y_specialist: {
    name: 'Accessibility Specialist',
    perspective: 'Advocate ensuring inclusive design for all users',
    expertise: ['WCAG 2.1 AA', 'Screen readers', 'Keyboard navigation', 'Color contrast', 'ARIA'],
    reviewCriteria: [
      'Missing useReducedMotion for animations',
      'ARIA attributes absent or incorrect',
      'Keyboard navigation gaps',
      'Color contrast issues (WCAG AA)',
      'Focus management missing for modals',
      'Alt text missing for images',
      'Form labels absent',
      'Landmark regions not defined',
      'Error messages not announced',
      'Skip links missing',
    ],
    severityThreshold: 'medium',
  },
};

// ============================================================================
// CHECKER PATTERN SERVICE
// ============================================================================

export class CheckerPattern {
  private llmClient: LLMProvider;
  private phaseConfigs: Map<string, PhaseConfig>;
  
  constructor(llmClient: LLMProvider) {
    this.llmClient = llmClient;
    this.phaseConfigs = new Map([
      ['STACK_SELECTION', { critic: 'skeptical_cto', maxRegenerations: 2, escalateOnCritical: true }],
      ['SPEC_PM', { critic: 'qa_lead', maxRegenerations: 2, escalateOnCritical: false }],
      ['SPEC_ARCHITECT', { critic: 'security_auditor', maxRegenerations: 1, escalateOnCritical: true }],
      ['FRONTEND_BUILD', { critic: 'a11y_specialist', maxRegenerations: 2, escalateOnCritical: false }],
    ]);
  }
  
  /**
   * Execute checker pattern for a phase
   */
  async executeCheck(
    phase: string,
    generatorOutput: Record<string, string>,
    context: Record<string, unknown>
  ): Promise<CheckerResult> {
    const config = this.phaseConfigs.get(phase);
    
    if (!config) {
      logger.info(`[CheckerPattern] No critic configured for phase: ${phase}, skipping`);
      return {
        status: 'approved',
        artifacts: generatorOutput,
        feedback: [],
        confidence: 1.0,
        summary: 'No critic configured for this phase',
      };
    }
    
    const critic = CRITIC_PERSONAS[config.critic];
    if (!critic) {
      logger.error(`[CheckerPattern] Unknown critic: ${config.critic}`);
      return {
        status: 'approved',
        artifacts: generatorOutput,
        feedback: [],
        confidence: 1.0,
        summary: 'Unknown critic, skipping review',
      };
    }
    
    logger.info(`[CheckerPattern] Running ${critic.name} review for phase: ${phase}`);
    
    // Run critic review
    const feedback = await this.criticReview(critic, generatorOutput, context);
    
    // Evaluate decision
    const result = this.evaluateDecision(feedback, generatorOutput);
    
    logger.info(`[CheckerPattern] Review complete for ${phase}: ${result.status}`, {
      confidence: result.confidence,
      issues: feedback.length,
      critical: feedback.filter(f => f.severity === 'critical').length,
    });
    
    return result;
  }
  
  /**
   * Run critic review
   */
  private async criticReview(
    critic: CriticPersona,
    generatorOutput: Record<string, string>,
    context: Record<string, unknown>
  ): Promise<CriticFeedback[]> {
    const prompt = this.buildCriticPrompt(critic, generatorOutput, context);
    
    try {
      const response = await this.llmClient.generateCompletion(
        prompt,
        undefined,
        2,
        `CHECKER_${critic.name.replace(/\s+/g, '_').toUpperCase()}`
      );
      
      return this.parseCriticFeedback(response.content);
    } catch (error) {
      logger.error(`[CheckerPattern] Critic review failed: ${error}`);
      return [];
    }
  }
  
  /**
   * Build critic prompt
   */
  private buildCriticPrompt(
    critic: CriticPersona,
    generatorOutput: Record<string, string>,
    context: Record<string, unknown>
  ): string {
    // Limit artifact content to avoid token limits
    const artifactsSummary = Object.entries(generatorOutput)
      .map(([name, content]) => {
        const truncated = content.slice(0, 2000);
        return `## ${name}\n${truncated}${content.length > 2000 ? '\n...[truncated]' : ''}`;
      })
      .join('\n\n---\n\n');
    
    return `# ROLE
You are a ${critic.name} (${critic.perspective}).
Your expertise: ${critic.expertise.join(', ')}.

# TASK
Review the generated artifacts below and identify quality issues, risks, and concerns.
Be adversarial - don't accept superficial quality. Challenge assumptions.

# REVIEW CRITERIA (check each carefully)
${critic.reviewCriteria.map(c => `- ${c}`).join('\n')}

# CONTEXT
Project: ${context.projectName || 'Unknown'}
Scale Tier: ${context.scaleTier || 'Unknown'}
Phase: ${context.phase || 'Unknown'}

# ARTIFACTS TO REVIEW
${artifactsSummary}

# OUTPUT FORMAT
You MUST output a valid JSON object with this structure:

\`\`\`json
{
  "feedback": [
    {
      "severity": "low|medium|critical",
      "category": "Brief category name",
      "concern": "What you found problematic - be specific",
      "recommendation": "How to fix it - actionable advice",
      "location": "File and approximate location if available"
    }
  ],
  "verdict": "approve|regenerate|escalate",
  "confidence": 0.95,
  "summary": "Brief 1-2 sentence summary of your review"
}
\`\`\`

# SEVERITY GUIDELINES
- **critical**: Security flaw, data loss risk, complete blocker, or serious vulnerability
- **medium**: Significant concern that will cause problems in production
- **low**: Minor nit, style issue, or future consideration

# VERDICT RULES
- "escalate" if ANY critical issues found (especially security)
- "regenerate" if more than 2 medium issues, or any medium issues in critical paths
- "approve" only if no critical issues and at most 2 low issues

Now review the artifacts thoroughly and output your JSON review:
`;
  }
  
  /**
   * Parse critic feedback from response
   */
  private parseCriticFeedback(content: string): CriticFeedback[] {
    try {
      // Extract JSON from markdown code block or raw
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('[CheckerPattern] No JSON found in critic response');
        return [];
      }
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      
      // Type the parsed JSON response
      interface CriticJsonResponse {
        feedback?: Array<{
          severity?: string;
          category?: string;
          concern?: string;
          recommendation?: string;
          location?: string;
        }>;
      }
      const parsed = parsedJson as CriticJsonResponse;
      
      if (!parsed.feedback || !Array.isArray(parsed.feedback)) {
        return [];
      }
      
      // Validate and normalize feedback items
      const result: CriticFeedback[] = [];
      for (const item of parsed.feedback) {
        if (typeof item === 'object' && item !== null) {
          result.push({
            severity: this.normalizeSeverity(item.severity || 'low'),
            category: item.category || 'General',
            concern: item.concern || 'No description provided',
            recommendation: item.recommendation || 'Review and fix',
            location: item.location,
          });
        }
      }
      return result;
    } catch (error) {
      logger.warn('[CheckerPattern] Failed to parse critic feedback', { error: String(error) });
      return [];
    }
  }
  
  /**
   * Normalize severity string
   */
  private normalizeSeverity(severity: string): 'low' | 'medium' | 'critical' {
    const normalized = severity?.toLowerCase().trim();
    if (normalized === 'critical' || normalized === 'high') return 'critical';
    if (normalized === 'medium') return 'medium';
    return 'low';
  }
  
  /**
   * Evaluate decision based on feedback
   */
  private evaluateDecision(
    feedback: CriticFeedback[],
    artifacts: Record<string, string>
  ): CheckerResult {
    const criticalCount = feedback.filter(f => f.severity === 'critical').length;
    const mediumCount = feedback.filter(f => f.severity === 'medium').length;
    const lowCount = feedback.filter(f => f.severity === 'low').length;
    
    // Calculate confidence based on issue density
    const totalContent = Object.values(artifacts).join('').length;
    const issueDensity = feedback.length / Math.max(totalContent / 10000, 1);
    const confidence = Math.max(0.5, 1 - issueDensity * 0.1 - criticalCount * 0.2 - mediumCount * 0.05);
    
    // Determine status
    let status: 'approved' | 'regenerate' | 'escalate';
    let summary: string;
    
    if (criticalCount > 0) {
      status = 'escalate';
      summary = `Found ${criticalCount} critical issue(s) requiring human review`;
    } else if (mediumCount > 2) {
      status = 'regenerate';
      summary = `Found ${mediumCount} medium issues - regeneration recommended`;
    } else if (mediumCount > 0) {
      status = 'regenerate';
      summary = `Found ${mediumCount} medium issue(s) to address`;
    } else if (lowCount > 5) {
      status = 'regenerate';
      summary = `Found ${lowCount} low issues for improvement`;
    } else {
      status = 'approved';
      summary = feedback.length === 0 
        ? 'No issues found - approved' 
        : `Approved with ${lowCount} minor suggestion(s)`;
    }
    
    return {
      status,
      artifacts,
      feedback,
      confidence,
      summary,
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
      .map((f, i) => {
        return `${i + 1}. [${f.severity.toUpperCase()}] ${f.category}
   Concern: ${f.concern}
   Fix: ${f.recommendation}`;
      })
      .join('\n\n');
    
    return `
${originalPrompt}

---

## CRITIC REVIEW FEEDBACK - MUST ADDRESS

The following issues were identified:

${feedbackList}

## INSTRUCTIONS

1. You MUST address EACH issue listed above
2. If you don't understand an issue, state what clarification you need
3. Output must be complete - fix ALL issues in one response
4. Do not repeat the same mistakes

Generate the corrected artifacts:
`;
  }
  
  /**
   * Configure phase settings
   */
  configurePhase(phase: string, config: PhaseConfig): void {
    this.phaseConfigs.set(phase, config);
  }
  
  /**
   * Get critic for a phase
   */
  getCriticForPhase(phase: string): CriticPersona | null {
    const config = this.phaseConfigs.get(phase);
    if (!config) return null;
    return CRITIC_PERSONAS[config.critic] || null;
  }
  
  /**
   * Get all configured phases
   */
  getConfiguredPhases(): string[] {
    return Array.from(this.phaseConfigs.keys());
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a critic feedback from a simple object
 */
export function createCriticFeedback(
  severity: 'low' | 'medium' | 'critical',
  category: string,
  concern: string,
  recommendation: string,
  location?: string
): CriticFeedback {
  return { severity, category, concern, recommendation, location };
}

/**
 * Check if feedback has critical issues
 */
export function hasCriticalIssues(feedback: CriticFeedback[]): boolean {
  return feedback.some(f => f.severity === 'critical');
}

/**
 * Filter feedback by severity
 */
export function filterBySeverity(
  feedback: CriticFeedback[],
  severity: 'low' | 'medium' | 'critical'
): CriticFeedback[] {
  return feedback.filter(f => f.severity === severity);
}

/**
 * Count feedback by severity
 */
export function countBySeverity(feedback: CriticFeedback[]): Record<string, number> {
  return {
    critical: feedback.filter(f => f.severity === 'critical').length,
    medium: feedback.filter(f => f.severity === 'medium').length,
    low: feedback.filter(f => f.severity === 'low').length,
  };
}
