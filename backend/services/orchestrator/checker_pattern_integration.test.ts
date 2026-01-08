/**
 * Checker Pattern Integration Tests
 * Tests the integration between CheckerPattern and OrchestratorEngine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckerPattern, CriticFeedback, hasCriticalIssues, filterBySeverity, countBySeverity } from '../llm/checker_pattern';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock LLM Provider
const createMockLLMClient = () => ({
  generateCompletion: vi.fn(),
  generateWithContext: vi.fn(),
  setPhase: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
});

describe('CheckerPattern Integration', () => {
  let mockLLMClient: ReturnType<typeof createMockLLMClient>;
  let checker: CheckerPattern;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    checker = new CheckerPattern(mockLLMClient as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Orchestrator Integration Points', () => {
    it('should return configured phases matching orchestrator expectations', () => {
      const configuredPhases = checker.getConfiguredPhases();
      
      // These phases should match what the orchestrator enables
      expect(configuredPhases).toContain('STACK_SELECTION');
      expect(configuredPhases).toContain('SPEC_PM');
      expect(configuredPhases).toContain('SPEC_ARCHITECT');
      expect(configuredPhases).toContain('FRONTEND_BUILD');
    });

    it('should provide critics that orchestrator can use for review', () => {
      const phases = checker.getConfiguredPhases();
      
      for (const phase of phases) {
        const critic = checker.getCriticForPhase(phase);
        expect(critic).toBeDefined();
        expect(critic?.name).toBeDefined();
        expect(critic?.perspective).toBeDefined();
        expect(critic?.expertise).toBeInstanceOf(Array);
        expect(critic?.reviewCriteria).toBeInstanceOf(Array);
      }
    });

    it('should build regeneration prompts that orchestrator can use', () => {
      const feedback: CriticFeedback[] = [
        {
          severity: 'medium',
          category: 'Cost',
          concern: 'Missing cost analysis',
          recommendation: 'Add cost breakdown',
        },
        {
          severity: 'low',
          category: 'Style',
          concern: 'Inconsistent naming',
          recommendation: 'Use snake_case',
        },
      ];

      const originalPrompt = 'Generate stack selection';
      const regenerationPrompt = checker.buildRegenerationPrompt(originalPrompt, feedback);

      // Orchestrator expects these elements in the regeneration prompt
      expect(regenerationPrompt).toContain(originalPrompt);
      expect(regenerationPrompt).toContain('CRITIC REVIEW FEEDBACK - MUST ADDRESS');
      expect(regenerationPrompt).toContain('Cost');
      expect(regenerationPrompt).toContain('Missing cost analysis');
      expect(regenerationPrompt).toContain('[MEDIUM]');
      expect(regenerationPrompt).toContain('Inconsistent naming');
      expect(regenerationPrompt).toContain('[LOW]');
    });
  });

  describe('CheckerResult Contract', () => {
    it('should return results matching orchestrator expectations', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [
            {
              severity: 'low',
              category: 'Style',
              concern: 'Minor style issue',
              recommendation: 'Fix it',
            },
          ],
          verdict: 'approve',
          confidence: 0.95,
          summary: 'Approved with minor suggestions',
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gemini-3-flash',
        finish_reason: 'stop',
      });

      const result = await checker.executeCheck(
        'STACK_SELECTION',
        { 'stack.json': '{"template": "nextjs"}' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      // Orchestrator expects these properties
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('feedback');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('summary');

      // Status should be one of these values
      expect(['approved', 'regenerate', 'escalate']).toContain(result.status);
    });

    it('should return escalate status for critical issues (orchestrator escalates)', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [
            {
              severity: 'critical',
              category: 'Security',
              concern: 'SQL injection vulnerability',
              recommendation: 'Use parameterized queries',
            },
          ],
          verdict: 'escalate',
          confidence: 0.95,
          summary: 'Critical security issue',
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gemini-3-flash',
        finish_reason: 'stop',
      });

      const result = await checker.executeCheck(
        'SPEC_ARCHITECT',
        { 'api-spec.json': '{"openapi": "3.0.0"}' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      expect(result.status).toBe('escalate');
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0].severity).toBe('critical');
    });

    it('should return regenerate status for medium issues (orchestrator regenerates)', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [
            {
              severity: 'medium',
              category: 'Validation',
              concern: 'Missing input validation',
              recommendation: 'Add Zod schema',
            },
          ],
          verdict: 'regenerate',
          confidence: 0.85,
          summary: 'Medium issues found',
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gemini-3-flash',
        finish_reason: 'stop',
      });

      const result = await checker.executeCheck(
        'SPEC_PM',
        { 'PRD.md': '# Product Requirements' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      expect(result.status).toBe('regenerate');
    });

    it('should return approved status with high confidence when no issues', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [],
          verdict: 'approve',
          confidence: 0.98,
          summary: 'No issues found',
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gemini-3-flash',
        finish_reason: 'stop',
      });

      const result = await checker.executeCheck(
        'STACK_SELECTION',
        { 'stack.json': '{"template": "nextjs"}' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      expect(result.status).toBe('approved');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('Fail-Safe Behavior', () => {
    it('should fail-open when LLM errors occur (orchestrator proceeds)', async () => {
      mockLLMClient.generateCompletion.mockRejectedValueOnce(new Error('API error'));

      const result = await checker.executeCheck(
        'STACK_SELECTION',
        { 'stack.json': '{}' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      // Orchestrator expects fail-open behavior
      expect(result.status).toBe('approved');
      expect(result.feedback).toEqual([]);
    });

    it('should handle unconfigured phases gracefully (orchestrator skips)', async () => {
      const result = await checker.executeCheck(
        'ANALYSIS',
        { 'constitution.md': '# Constitution' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      expect(result.status).toBe('approved');
      expect(result.summary).toContain('No critic configured');
    });

    it('should handle malformed JSON responses gracefully', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: 'Not valid JSON',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gemini-3-flash',
        finish_reason: 'stop',
      });

      const result = await checker.executeCheck(
        'STACK_SELECTION',
        { 'stack.json': '{}' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      expect(result.status).toBe('approved');
      expect(result.feedback).toEqual([]);
    });
  });

  describe('Phase-Specific Critics', () => {
    it('should have Security Auditor for SPEC_ARCHITECT (security-critical)', () => {
      const critic = checker.getCriticForPhase('SPEC_ARCHITECT');
      expect(critic?.name).toBe('Security Auditor');
      expect(critic?.expertise).toContain('OWASP Top 10');
    });

    it('should have QA Lead for SPEC_PM (quality-focused)', () => {
      const critic = checker.getCriticForPhase('SPEC_PM');
      expect(critic?.name).toBe('QA Lead');
      expect(critic?.expertise).toContain('Test design');
    });

    it('should have A11y Specialist for FRONTEND_BUILD (accessibility)', () => {
      const critic = checker.getCriticForPhase('FRONTEND_BUILD');
      expect(critic?.name).toBe('Accessibility Specialist');
      expect(critic?.expertise).toContain('WCAG 2.1 AA');
    });

    it('should have Skeptical CTO for STACK_SELECTION (architecture)', () => {
      const critic = checker.getCriticForPhase('STACK_SELECTION');
      expect(critic?.name).toBe('Skeptical CTO');
      expect(critic?.expertise).toContain('Cloud architecture');
    });
  });

  describe('Helper Functions for Orchestrator', () => {
    it('should detect critical issues for escalation decision', () => {
      const feedbackWithCritical: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor', recommendation: 'Fix' },
        { severity: 'critical', category: 'Security', concern: 'Critical', recommendation: 'Fix now' },
      ];

      expect(hasCriticalIssues(feedbackWithCritical)).toBe(true);

      const feedbackWithoutCritical: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor', recommendation: 'Fix' },
        { severity: 'medium', category: 'Validation', concern: 'Medium', recommendation: 'Fix' },
      ];

      expect(hasCriticalIssues(feedbackWithoutCritical)).toBe(false);
    });

    it('should filter feedback by severity for reporting', () => {
      const feedback: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor', recommendation: 'Fix' },
        { severity: 'medium', category: 'Validation', concern: 'Medium', recommendation: 'Fix' },
        { severity: 'critical', category: 'Security', concern: 'Critical', recommendation: 'Fix' },
      ];

      const critical = filterBySeverity(feedback, 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].severity).toBe('critical');

      const allMediumOrHigher = [
        ...filterBySeverity(feedback, 'critical'),
        ...filterBySeverity(feedback, 'medium'),
      ];
      expect(allMediumOrHigher).toHaveLength(2);
    });

    it('should count issues by severity for reporting', () => {
      const feedback: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor', recommendation: 'Fix' },
        { severity: 'low', category: 'Style', concern: 'Another', recommendation: 'Fix' },
        { severity: 'medium', category: 'Validation', concern: 'Medium', recommendation: 'Fix' },
        { severity: 'critical', category: 'Security', concern: 'Critical', recommendation: 'Fix' },
      ];

      const counts = countBySeverity(feedback);

      expect(counts.low).toBe(2);
      expect(counts.medium).toBe(1);
      expect(counts.critical).toBe(1);
      expect(counts.low + counts.medium + counts.critical).toBe(feedback.length);
    });
  });

  describe('Custom Phase Configuration', () => {
    it('should allow orchestrator to configure custom phases', () => {
      checker.configurePhase('DESIGN', {
        critic: 'skeptical_cto',
        maxRegenerations: 3,
        escalateOnCritical: true,
      });

      const critic = checker.getCriticForPhase('DESIGN');
      expect(critic).toBeDefined();
      expect(critic?.name).toBe('Skeptical CTO');
    });

    it('should allow overriding default phase configuration', () => {
      checker.configurePhase('STACK_SELECTION', {
        critic: 'qa_lead',
        maxRegenerations: 5,
        escalateOnCritical: false,
      });

      const critic = checker.getCriticForPhase('STACK_SELECTION');
      expect(critic?.name).toBe('QA Lead');
    });
  });
});
