/**
 * Checker Pattern Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckerPattern, CriticFeedback, hasCriticalIssues, filterBySeverity, countBySeverity } from './checker_pattern';

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

describe('CheckerPattern', () => {
  let mockLLMClient: ReturnType<typeof createMockLLMClient>;
  let checker: CheckerPattern;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    vi.clearAllMocks();
    checker = new CheckerPattern(mockLLMClient as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default phase configurations', () => {
      expect(checker.getConfiguredPhases()).toEqual([
        'STACK_SELECTION',
        'SPEC_PM',
        'SPEC_ARCHITECT',
        'FRONTEND_BUILD',
      ]);
    });

    it('should return critic for configured phases', () => {
      const critic = checker.getCriticForPhase('STACK_SELECTION');
      expect(critic).toBeDefined();
      expect(critic?.name).toBe('Skeptical CTO');
    });

    it('should return null for unconfigured phases', () => {
      const critic = checker.getCriticForPhase('ANALYSIS');
      expect(critic).toBeNull();
    });
  });

  describe('Critic Personas', () => {
    it('should have Skeptical CTO for STACK_SELECTION', () => {
      const critic = checker.getCriticForPhase('STACK_SELECTION');
      expect(critic?.name).toBe('Skeptical CTO');
      expect(critic?.expertise).toContain('Cloud architecture');
    });

    it('should have QA Lead for SPEC_PM', () => {
      const critic = checker.getCriticForPhase('SPEC_PM');
      expect(critic?.name).toBe('QA Lead');
      expect(critic?.expertise).toContain('Test design');
    });

    it('should have Security Auditor for SPEC_ARCHITECT', () => {
      const critic = checker.getCriticForPhase('SPEC_ARCHITECT');
      expect(critic?.name).toBe('Security Auditor');
      expect(critic?.expertise).toContain('OWASP Top 10');
    });

    it('should have A11y Specialist for FRONTEND_BUILD', () => {
      const critic = checker.getCriticForPhase('FRONTEND_BUILD');
      expect(critic?.name).toBe('Accessibility Specialist');
      expect(critic?.expertise).toContain('WCAG 2.1 AA');
    });
  });

  describe('executeCheck', () => {
    it('should approve when no issues found', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [],
          verdict: 'approve',
          confidence: 0.95,
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

    it('should escalate when critical issues found', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [
            {
              severity: 'critical',
              category: 'SQL Injection',
              concern: 'Vulnerable to SQL injection',
              recommendation: 'Use parameterized queries',
            },
          ],
          verdict: 'escalate',
          confidence: 0.95,
          summary: 'Critical security issue found',
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

    it('should regenerate when medium issues found', async () => {
      mockLLMClient.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          feedback: [
            {
              severity: 'medium',
              category: 'Missing validation',
              concern: 'Input validation missing',
              recommendation: 'Add Zod validation',
            },
          ],
          verdict: 'regenerate',
          confidence: 0.85,
          summary: 'One medium issue found',
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
      expect(result.feedback).toHaveLength(1);
    });

    it('should skip unconfigured phases', async () => {
      const result = await checker.executeCheck(
        'ANALYSIS',
        { 'constitution.md': '# Constitution' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      expect(result.status).toBe('approved');
      expect(result.summary).toContain('No critic configured');
      expect(mockLLMClient.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      mockLLMClient.generateCompletion.mockRejectedValueOnce(new Error('API error'));

      const result = await checker.executeCheck(
        'STACK_SELECTION',
        { 'stack.json': '{}' },
        { projectId: 'test', projectName: 'Test Project' }
      );

      // Fail-open: status should be approved
      expect(result.status).toBe('approved');
      // When error occurs, criticReview returns empty feedback which results in "No issues found - approved"
      expect(result.feedback).toEqual([]);
    });
  });

  describe('buildRegenerationPrompt', () => {
    it('should include feedback in regeneration prompt', () => {
      const originalPrompt = 'Generate stack selection';
      const feedback: CriticFeedback[] = [
        {
          severity: 'medium',
          category: 'Cost',
          concern: 'Missing cost analysis',
          recommendation: 'Add cost breakdown',
        },
      ];

      const result = checker.buildRegenerationPrompt(originalPrompt, feedback);

      expect(result).toContain('CRITIC REVIEW FEEDBACK - MUST ADDRESS');
      expect(result).toContain('Cost');
      expect(result).toContain('Missing cost analysis');
      expect(result).toContain('Add cost breakdown');
    });
  });

  describe('configurePhase', () => {
    it('should allow custom phase configuration', () => {
      checker.configurePhase('ANALYSIS', {
        critic: 'skeptical_cto',
        maxRegenerations: 5,
        escalateOnCritical: true,
      });

      const critic = checker.getCriticForPhase('ANALYSIS');
      expect(critic?.name).toBe('Skeptical CTO');
    });
  });
});

describe('Helper Functions', () => {
  describe('hasCriticalIssues', () => {
    it('should return true when critical issues exist', () => {
      const feedback: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor nit', recommendation: 'Fix' },
        { severity: 'critical', category: 'Security', concern: 'SQL injection', recommendation: 'Use parameterized' },
      ];

      expect(hasCriticalIssues(feedback)).toBe(true);
    });

    it('should return false when no critical issues', () => {
      const feedback: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor nit', recommendation: 'Fix' },
        { severity: 'medium', category: 'Validation', concern: 'Missing check', recommendation: 'Add check' },
      ];

      expect(hasCriticalIssues(feedback)).toBe(false);
    });
  });

  describe('filterBySeverity', () => {
    it('should filter by severity level', () => {
      const feedback: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor', recommendation: 'Fix' },
        { severity: 'medium', category: 'Validation', concern: 'Missing', recommendation: 'Add' },
        { severity: 'critical', category: 'Security', concern: 'Critical', recommendation: 'Fix' },
      ];

      const critical = filterBySeverity(feedback, 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].severity).toBe('critical');

      const medium = filterBySeverity(feedback, 'medium');
      expect(medium).toHaveLength(1);
      expect(medium[0].severity).toBe('medium');
    });
  });

  describe('countBySeverity', () => {
    it('should return counts by severity', () => {
      const feedback: CriticFeedback[] = [
        { severity: 'low', category: 'Style', concern: 'Minor', recommendation: 'Fix' },
        { severity: 'low', category: 'Style', concern: 'Another', recommendation: 'Fix' },
        { severity: 'medium', category: 'Validation', concern: 'Missing', recommendation: 'Add' },
        { severity: 'critical', category: 'Security', concern: 'Critical', recommendation: 'Fix' },
      ];

      const counts = countBySeverity(feedback);

      expect(counts.low).toBe(2);
      expect(counts.medium).toBe(1);
      expect(counts.critical).toBe(1);
    });
  });
});

describe('Error Handling', () => {
  let mockClient: ReturnType<typeof createMockLLMClient>;
  let errorChecker: CheckerPattern;

  beforeEach(() => {
    mockClient = createMockLLMClient();
    errorChecker = new CheckerPattern(mockClient as any);
  });

  it('should handle malformed JSON responses', async () => {
    mockClient.generateCompletion.mockResolvedValueOnce({
      content: 'Not valid JSON',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: 'gemini-3-flash',
      finish_reason: 'stop',
    });

    const result = await errorChecker.executeCheck(
      'STACK_SELECTION',
      { 'stack.json': '{}' },
      { projectId: 'test', projectName: 'Test' }
    );

    expect(result.feedback).toEqual([]);
  });

  it('should handle feedback without severity field', async () => {
    mockClient.generateCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        feedback: [
          { category: 'Style', concern: 'Minor issue', recommendation: 'Fix this' },
        ],
        verdict: 'approve',
        confidence: 0.9,
        summary: 'Approved',
      }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: 'gemini-3-flash',
      finish_reason: 'stop',
    });

    const result = await errorChecker.executeCheck(
      'STACK_SELECTION',
      { 'stack.json': '{}' },
      { projectId: 'test', projectName: 'Test' }
    );

    expect(result.feedback[0].severity).toBe('low');
  });
});

describe('Confidence Calculation', () => {
  let mockClient: ReturnType<typeof createMockLLMClient>;
  let confChecker: CheckerPattern;

  beforeEach(() => {
    mockClient = createMockLLMClient();
    confChecker = new CheckerPattern(mockClient as any);
  });

  it('should have high confidence when no issues', async () => {
    mockClient.generateCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        feedback: [],
        verdict: 'approve',
        confidence: 0.95,
        summary: 'Clean',
      }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: 'gemini-3-flash',
      finish_reason: 'stop',
    });

    const result = await confChecker.executeCheck(
      'STACK_SELECTION',
      { 'stack.json': '{}' },
      { projectId: 'test', projectName: 'Test' }
    );

    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
