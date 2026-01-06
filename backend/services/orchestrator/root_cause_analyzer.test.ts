import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  RootCauseAnalyzer,
  createRootCauseAnalyzer,
  ErrorType,
  RootCauseAnalysis,
  PhaseHistoryEntry,
} from './root_cause_analyzer';
import { LLMProvider } from '../llm/providers/base';
import { LLMResponse } from '@/types/llm';

describe('RootCauseAnalyzer', () => {
  let analyzer: RootCauseAnalyzer;
  let mockLLMProvider: LLMProvider;

  beforeEach(() => {
    analyzer = new RootCauseAnalyzer();
    mockLLMProvider = {
      generateCompletion: vi.fn(),
      testConnection: vi.fn(),
    } as unknown as LLMProvider;
  });

  describe('Error Classification', () => {
    it('should classify parsing errors', async () => {
      const errors = [
        'Parse failed for PRD.md: unexpected token at line 10',
        'JSON parse error in data-model.json',
      ];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('parsing');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify cannot find module as parsing error', async () => {
      const errors = ['Cannot find module "./utils" in component.tsx'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('parsing');
    });

    it('should classify syntax errors as parsing', async () => {
      const errors = ['SyntaxError: Unexpected token } in JSON at position 42'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('parsing');
    });

    it('should classify missing file errors', async () => {
      const errors = ['Required file PRD.md is missing from output'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('missing_file');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify file not found errors', async () => {
      const errors = ['File not found: architecture-diagram.png'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('missing_file');
    });

    it('should classify ENOENT as missing file', async () => {
      const errors = ['ENOENT: no such file or directory, open "design-tokens.md"'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('missing_file');
    });

    it('should classify content quality errors', async () => {
      const errors = ['PRD.md is too short - missing key requirements'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('content_quality');
    });

    it('should classify placeholder content as quality error', async () => {
      const errors = ['user-stories.md contains placeholder [TODO] content'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('content_quality');
    });

    it('should classify insufficient detail as quality error', async () => {
      const errors = ['API spec lacks sufficient detail for implementation'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('content_quality');
    });

    it('should classify constitutional violations', async () => {
      const errors = [
        'PRD.md violates constitutional article 3: missing test-first approach',
      ];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('constitutional');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should classify time estimate violations as constitutional', async () => {
      const errors = ['Missing time estimate - violates constitutional principle'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('constitutional');
    });

    it('should classify anti-pattern violations as constitutional', async () => {
      const errors = ['Using anti-pattern forbidden by constitution: eval()'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('constitutional');
    });

    it('should classify unknown errors with low confidence', async () => {
      const errors = ['Something unexpected happened during validation'];
      const result = await analyzer.analyze(errors, []);

      expect(result.errorType).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Phase Identification', () => {
    it('should identify SPEC_PM phase for PRD errors', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'STACK_SELECTION', status: 'completed', artifacts: ['stack.json'] },
        { phase: 'SPEC_PM', status: 'completed', artifacts: ['PRD.md'] },
        { phase: 'SPEC_ARCHITECT', status: 'completed' },
      ];

      const errors = ['PRD.md has missing user stories'];
      const result = await analyzer.analyze(errors, phaseHistory);

      expect(result.originatingPhase).toBe('SPEC_PM');
    });

    it('should identify SPEC_ARCHITECT for API spec errors', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'STACK_SELECTION', status: 'completed' },
        { phase: 'SPEC_PM', status: 'completed' },
        { phase: 'SPEC_ARCHITECT', status: 'completed', artifacts: ['api-spec.json'] },
      ];

      const errors = ['api-spec.json references undefined model'];
      const result = await analyzer.analyze(errors, phaseHistory);

      expect(result.originatingPhase).toBe('SPEC_ARCHITECT');
    });

    it('should identify STACK_SELECTION for stack.json errors', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'STACK_SELECTION', status: 'completed', artifacts: ['stack.json'] },
        { phase: 'SPEC_PM', status: 'completed' },
      ];

      const errors = ['stack.json references unknown dependency'];
      const result = await analyzer.analyze(errors, phaseHistory);

      expect(result.originatingPhase).toBe('STACK_SELECTION');
    });

    it('should infer phase from artifact name in error message', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'STACK_SELECTION', status: 'completed' },
        { phase: 'SPEC_PM', status: 'completed' },
      ];

      const errors = ['component-mapping.md references undefined design token'];
      const result = await analyzer.analyze(errors, phaseHistory);

      expect(result.originatingPhase).toBe('SPEC_DESIGN');
    });

    it('should default to VALIDATE when no phase history', async () => {
      const errors = ['Unknown validation error'];
      const result = await analyzer.analyze(errors, []);

      expect(result.originatingPhase).toBe('VALIDATE');
    });

    it('should use last completed phase when error type matches multiple', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'SPEC_PM', status: 'completed' },
        { phase: 'SPEC_ARCHITECT', status: 'completed' },
        { phase: 'SPEC_DESIGN', status: 'completed' },
      ];

      const errors = ['JSON parse error'];
      const result = await analyzer.analyze(errors, phaseHistory);

      // Should pick the last completed phase that matches parsing errors
      expect(result.originatingPhase).toBe('SPEC_DESIGN');
    });
  });

  describe('Remediation Hints', () => {
    it('should provide parsing remediation hint', async () => {
      const errors = ['JSON parse error'];
      const result = await analyzer.analyze(errors, []);

      expect(result.remediationHint).toContain('syntax');
      expect(result.remediationHint).toContain('format');
    });

    it('should provide missing file remediation hint', async () => {
      const errors = ['Required file missing'];
      const result = await analyzer.analyze(errors, []);

      expect(result.remediationHint).toMatch(/regenerate/i);
      expect(result.remediationHint).toContain('artifact');
    });

    it('should provide content quality remediation hint', async () => {
      const errors = ['Content too short'];
      const result = await analyzer.analyze(errors, []);

      expect(result.remediationHint).toContain('detail');
      expect(result.remediationHint).toContain('completeness');
    });

    it('should provide constitutional remediation hint', async () => {
      const errors = ['Constitutional violation'];
      const result = await analyzer.analyze(errors, []);

      expect(result.remediationHint).toContain('constitutional');
      expect(result.remediationHint).toContain('compliance');
    });

    it('should include phase-specific guidance in remediation hint', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'SPEC_ARCHITECT', status: 'completed' },
      ];

      const errors = ['api-spec.json references undefined field'];
      const result = await analyzer.analyze(errors, phaseHistory);

      expect(result.remediationHint).toContain('api-spec.json');
      expect(result.remediationHint).toContain('data-model');
    });
  });

  describe('Confidence Calculation', () => {
    it('should increase confidence with multiple pattern matches', async () => {
      const singleMatchError = await analyzer.analyze(['syntax error'], []);
      const multiMatchError = await analyzer.analyze(
        ['syntax error in JSON parse', 'unexpected token'],
        []
      );

      expect(multiMatchError.confidence).toBeGreaterThan(
        singleMatchError.confidence
      );
    });

    it('should have high confidence for parsing errors with clear patterns', async () => {
      const result = await analyzer.analyze(['Parse failed: unexpected token }'], []);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should have lower confidence for unknown errors', async () => {
      const result = await analyzer.analyze(['Some random error message'], []);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Explanation Generation', () => {
    it('should include error type in explanation', async () => {
      const result = await analyzer.analyze(['File not found error'], []);
      expect(result.explanation).toContain('missing');
    });

    it('should include originating phase in explanation', async () => {
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'SPEC_PM', status: 'completed' },
      ];
      const result = await analyzer.analyze(['PRD.md error'], phaseHistory);
      expect(result.explanation).toContain('SPEC_PM');
    });

    it('should mention multiple errors when applicable', async () => {
      const result = await analyzer.analyze(
        ['Error 1', 'Error 2', 'Error 3'],
        []
      );
      expect(result.explanation).toContain('3');
      expect(result.explanation).toContain('errors');
    });
  });

  describe('LLM Integration', () => {
    it('should use LLM for complex analysis when available', async () => {
      const llmAnalyzer = new RootCauseAnalyzer(mockLLMProvider);
      const mockResponse: LLMResponse = {
        content: JSON.stringify({
          originatingPhase: 'SPEC_PM',
          errorType: 'content_quality',
          confidence: 0.95,
          explanation: 'LLM analyzed the content gaps',
          remediationHint: 'Add more detailed user stories',
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'test-model',
        finish_reason: 'stop',
      };

      (mockLLMProvider.generateCompletion as Mock).mockResolvedValue(mockResponse);

      const result = await llmAnalyzer.analyze(
        ['PRD.md missing critical requirements'],
        [{ phase: 'SPEC_PM', status: 'completed' }]
      );

      expect(result.confidence).toBe(0.95);
      expect(result.errorType).toBe('content_quality');
      expect(mockLLMProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should fall back to pattern matching when LLM fails', async () => {
      const llmAnalyzer = new RootCauseAnalyzer(mockLLMProvider);
      (mockLLMProvider.generateCompletion as Mock).mockRejectedValue(
        new Error('LLM unavailable')
      );

      const result = await llmAnalyzer.analyze(['Parse error'], []);

      expect(result.errorType).toBe('parsing');
    });

    it('should fall back when LLM returns invalid JSON', async () => {
      const llmAnalyzer = new RootCauseAnalyzer(mockLLMProvider);
      const mockResponse: LLMResponse = {
        content: 'This is not valid JSON',
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        model: 'test-model',
        finish_reason: 'stop',
      };

      (mockLLMProvider.generateCompletion as Mock).mockResolvedValue(mockResponse);

      const result = await llmAnalyzer.analyze(['Parse error'], []);

      expect(result.errorType).toBe('parsing');
    });

    it('should skip LLM when confidence is high enough', async () => {
      const llmAnalyzer = new RootCauseAnalyzer(mockLLMProvider);
      const mockResponse: LLMResponse = {
        content: '{"errorType": "parsing"}',
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        model: 'test-model',
        finish_reason: 'stop',
      };

      (mockLLMProvider.generateCompletion as Mock).mockResolvedValue(mockResponse);

      // High confidence error - should not use LLM
      const result = await llmAnalyzer.analyze(
        ['Parse failed: unexpected token } in JSON at position 42'],
        []
      );

      // Pattern matching already gives high confidence, LLM should not be called
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(mockLLMProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should report LLM availability', () => {
      const withoutLLM = new RootCauseAnalyzer();
      const withLLM = new RootCauseAnalyzer(mockLLMProvider);

      expect(withoutLLM.isLLMAvailable()).toBe(false);
      expect(withLLM.isLLMAvailable()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error array', async () => {
      const result = await analyzer.analyze([], []);

      expect(result.errorType).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle null errors', async () => {
      const result = await analyzer.analyze(null as any, []);

      expect(result.errorType).toBe('unknown');
    });

    it('should handle undefined phase history', async () => {
      const result = await analyzer.analyze(['error'], undefined as any);

      expect(result.originatingPhase).toBe('VALIDATE');
    });

    it('should handle errors with no matching patterns', async () => {
      const result = await analyzer.analyze(
        ['xyz123 abc456 def789'],
        []
      );

      expect(result.errorType).toBe('unknown');
    });

    it('should handle very long error messages', async () => {
      const longError = 'Error: '.repeat(100) + 'missing required content detected';
      const result = await analyzer.analyze([longError], []);

      expect(result.errorType).toBe('content_quality');
    });

    it('should handle case-insensitive pattern matching', async () => {
      const upperCaseError = 'FILE NOT FOUND: stack.json';
      const result = await analyzer.analyze([upperCaseError], []);

      expect(result.errorType).toBe('missing_file');
    });
  });

  describe('Batch Analysis', () => {
    it('should analyze multiple error sets', async () => {
      const errorSets = [
        {
          errors: ['Parse error in JSON'],
          phaseHistory: [{ phase: 'SPEC_PM', status: 'completed' as const }],
        },
        {
          errors: ['Required file missing'],
          phaseHistory: [{ phase: 'STACK_SELECTION', status: 'completed' as const }],
        },
      ];

      const results = await analyzer.batchAnalyze(errorSets);

      expect(results).toHaveLength(2);
      expect(results[0].errorType).toBe('parsing');
      expect(results[1].errorType).toBe('missing_file');
    });

    it('should handle empty batch', async () => {
      const results = await analyzer.batchAnalyze([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Factory Function', () => {
    it('should create analyzer without LLM', () => {
      const analyzer = createRootCauseAnalyzer();
      expect(analyzer.isLLMAvailable()).toBe(false);
    });

    it('should create analyzer with LLM', () => {
      const analyzer = createRootCauseAnalyzer(mockLLMProvider);
      expect(analyzer.isLLMAvailable()).toBe(true);
    });
  });

  describe('Comprehensive Error Scenarios', () => {
    it('should handle constitutional violation with article reference', async () => {
      const errors = [
        'PRD.md violates Article 4 of the constitution: test-first approach not implemented',
        'Missing time estimate for features',
      ];

      const result = await analyzer.analyze(errors, [
        { phase: 'SPEC_PM', status: 'completed' },
      ]);

      expect(result.errorType).toBe('constitutional');
      expect(result.originatingPhase).toBe('SPEC_PM');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle structural inconsistency in design phase', async () => {
      const errors = [
        'component-mapping.md references --color-primary not defined in design-tokens.md',
      ];

      const result = await analyzer.analyze(errors, [
        { phase: 'SPEC_DESIGN', status: 'completed' },
      ]);

      expect(result.originatingPhase).toBe('SPEC_DESIGN');
    });

    it('should handle API data model gap', async () => {
      const errors = [
        'api-spec.json references User.avatar field not present in data-model.md',
      ];

      const result = await analyzer.analyze(errors, [
        { phase: 'SPEC_ARCHITECT', status: 'completed' },
      ]);

      expect(result.originatingPhase).toBe('SPEC_ARCHITECT');
      expect(result.remediationHint).toContain('api-spec.json');
    });

    it('should differentiate between similar error types', async () => {
      const parseError = await analyzer.analyze(['JSON syntax error'], []);
      const missingError = await analyzer.analyze(['File not found'], []);

      expect(parseError.errorType).toBe('parsing');
      expect(missingError.errorType).toBe('missing_file');
      expect(parseError.errorType).not.toBe(missingError.errorType);
    });

    it('should return consistent results for same input', async () => {
      const errors = ['Parse error'];
      const phaseHistory: PhaseHistoryEntry[] = [
        { phase: 'SPEC_PM', status: 'completed' },
      ];

      const result1 = await analyzer.analyze(errors, phaseHistory);
      const result2 = await analyzer.analyze(errors, phaseHistory);

      expect(result1.errorType).toBe(result2.errorType);
      expect(result1.originatingPhase).toBe(result2.originatingPhase);
      expect(result1.confidence).toBe(result2.confidence);
    });
  });
});
