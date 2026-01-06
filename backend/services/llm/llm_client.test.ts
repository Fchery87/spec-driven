import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient, StreamingValidator, ValidationError, getStreamingValidationConfig, DEFAULT_STREAMING_PATTERNS } from './llm_client';

const baseConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  max_tokens: 1024,
  temperature: 0.7,
  timeout_seconds: 5,
  api_key: 'test-key',
};

describe('GeminiClient rate-limit handling', () => {
  const previousEnv = {
    rpm: process.env.GEMINI_REQUESTS_PER_MINUTE,
    concurrency: process.env.GEMINI_MAX_CONCURRENCY,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // eliminate jitter variance
    process.env.GEMINI_REQUESTS_PER_MINUTE = '100000';
    process.env.GEMINI_MAX_CONCURRENCY = '10';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env.GEMINI_REQUESTS_PER_MINUTE = previousEnv.rpm;
    process.env.GEMINI_MAX_CONCURRENCY = previousEnv.concurrency;
  });

  it('retries on 429 up to max attempts then fails with rate-limit error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 429 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new GeminiClient(baseConfig as any);
    const promise = client.generateCompletion('prompt', undefined, 2, 'TEST'); // retries=2 => 3 attempts
    const expectation = expect(promise).rejects.toThrow(/rate limited/i);

    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails fast on non-rate-limit errors without extra retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('boom', { status: 500, statusText: 'Server Error' })
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new GeminiClient(baseConfig as any);

    const promise = client.generateCompletion('prompt', undefined, 2, 'TEST');
    const expectation = expect(promise).rejects.toThrow(/Gemini API error/);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('triggers continuation when finishReason is MAX_TOKENS', async () => {
    // We need to use real timers for this test to avoid Vitest timeout issues with recursive promises
    vi.useRealTimers();

    const firstResponse = {
      candidates: [
        {
          finishReason: 'MAX_TOKENS',
          content: { parts: [{ text: 'Part 1 content' }] },
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 100,
        totalTokenCount: 110,
      },
    };
    const secondResponse = {
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: 'Part 2 content' }] },
        },
      ],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 50,
        totalTokenCount: 65,
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstResponse), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondResponse), { status: 200 })
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new GeminiClient({
      ...baseConfig,
      max_continuations: 1,
    } as any);
    const result = await client.generateCompletion(
      'initial prompt',
      undefined,
      0,
      'PHASE'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('Part 1 contentPart 2 content');
    expect(result.usage?.total_tokens).toBe(110 + 65);
    expect(result.finish_reason).toBe('STOP');

    // fetch(url, options) -> options is at index 1
    const secondCallBody = JSON.parse(
      fetchMock.mock.calls[1][1]!.body as string
    );
    expect(secondCallBody.contents[0].parts[0].text).toContain(
      'The previous response was truncated'
    );
    expect(secondCallBody.contents[0].parts[0].text).toContain(
      'Part 1 content'
    );
  });
});

describe('StreamingValidator', () => {
  const defaultConfig = {
    enabled: true,
    abortOnViolations: true,
    checkIntervalMs: 100,
    patterns: DEFAULT_STREAMING_PATTERNS,
    enabledPhases: ['SPEC_DESIGN_COMPONENTS', 'FRONTEND_BUILD', 'SOLUTIONING'],
  };

  it('detects placeholder patterns (// TODO)', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('// TODO: Implement this later');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain('Placeholder pattern detected');
    expect(validator.getViolations().length).toBeGreaterThan(0);
  });

  it('detects placeholder patterns (lorem ipsum)', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('Lorem ipsum dolor sit amet');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('lorem ipsum'))).toBe(true);
  });

  it('detects AI slop patterns (purple gradient)', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('beautiful purple gradient background');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('purple'))).toBe(true);
  });

  it('detects AI slop patterns (indigo gradient)', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('stunning indigo gradient with blur effect');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('indigo'))).toBe(true);
  });

  it('detects blob background patterns', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('beautiful blob background effect');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('blob'))).toBe(true);
  });

  it('detects format violations (undefined)', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('value is undefined');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('undefined'))).toBe(true);
  });

  it('allows valid content without violations', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('This is a valid React component with proper TypeScript types.');
    
    expect(result.shouldContinue).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('accumulates content across multiple chunks', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    validator.onChunk('function calculate() {\n');
    validator.onChunk('  return 42;\n');
    const result = validator.onChunk('}');
    
    expect(result.shouldContinue).toBe(true);
    expect(validator.getAccumulatedContent()).toBe('function calculate() {\n  return 42;\n}');
  });

  it('detects violations in subsequent chunks', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const firstResult = validator.onChunk('function calculate() {');
    expect(firstResult.shouldContinue).toBe(true);
    
    const secondResult = validator.onChunk('  // TODO: fix this later');
    expect(secondResult.shouldContinue).toBe(false);
    expect(secondResult.violations.length).toBeGreaterThan(0);
  });

  it('does not abort when abortOnViolations is false', () => {
    const config = { ...defaultConfig, abortOnViolations: false };
    const validator = new StreamingValidator(config);
    
    const result = validator.onChunk('// TODO: Fix this');
    
    expect(result.shouldContinue).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(validator.shouldAbort()).toBe(false);
  });

  it('shouldAbort returns true when violations detected and abortOnViolations is true', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    validator.onChunk('// TODO: Fix this');
    
    expect(validator.shouldAbort()).toBe(true);
  });

  it('shouldAbort returns false when no violations', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    validator.onChunk('valid content');
    
    expect(validator.shouldAbort()).toBe(false);
  });

  it('detects FIXME pattern', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('// FIXME: This needs refactoring');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('fixme'))).toBe(true);
  });

  it('detects TBD pattern', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('Feature TBD');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('tbd'))).toBe(true);
  });

  it('detects "eye-catching" slop pattern', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('eye-catching design');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('eye-catching'))).toBe(true);
  });

  it('detects "captivating" slop pattern', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    const result = validator.onChunk('captivating user experience');
    
    expect(result.shouldContinue).toBe(false);
    expect(result.violations.some(v => v.toLowerCase().includes('captivating'))).toBe(true);
  });

  it('returns all violations via getViolations', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    validator.onChunk('// TODO: First violation');
    validator.onChunk('// TODO: Second violation');
    
    const violations = validator.getViolations();
    expect(violations.length).toBe(2);
  });

  it('returns copy of violations array', () => {
    const validator = new StreamingValidator(defaultConfig);
    
    validator.onChunk('// TODO: Fix this');
    const violations1 = validator.getViolations();
    const violations2 = validator.getViolations();
    
    expect(violations1).not.toBe(violations2);
    expect(violations1).toEqual(violations2);
  });
});

describe('getStreamingValidationConfig', () => {
  it('returns null when streaming validation is disabled', () => {
    const config = { ...baseConfig, streaming_validation: { enabled: false } };
    const result = getStreamingValidationConfig('SPEC_DESIGN_COMPONENTS', config as any);
    expect(result).toBeNull();
  });

  it('returns null when phase is not in enabled phases', () => {
    const config = { ...baseConfig, streaming_validation: { enabled: true } };
    const result = getStreamingValidationConfig('ANALYSIS', config as any);
    expect(result).toBeNull();
  });

  it('returns config for enabled phase', () => {
    const config = { ...baseConfig, streaming_validation: { enabled: true } };
    const result = getStreamingValidationConfig('FRONTEND_BUILD', config as any);
    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(true);
    expect(result?.abortOnViolations).toBe(true);
  });

  it('returns config when no phase specified (checks default phases)', () => {
    const config = { ...baseConfig, streaming_validation: { enabled: true } };
    const result = getStreamingValidationConfig(undefined, config as any);
    expect(result).not.toBeNull();
  });

  it('uses default patterns when none specified', () => {
    const config = { ...baseConfig, streaming_validation: { enabled: true } };
    const result = getStreamingValidationConfig('SOLUTIONING', config as any);
    expect(result?.patterns.placeholder.length).toBeGreaterThan(0);
    expect(result?.patterns.slop.length).toBeGreaterThan(0);
  });

  it('applies phase-specific overrides', () => {
    const config = {
      ...baseConfig,
      streaming_validation: {
        enabled: true,
        abort_on_violations: false,
        check_interval_ms: 500,
        phase_overrides: {
          FRONTEND_BUILD: {
            abort_on_violations: true,
            check_interval_ms: 50,
          },
        },
      },
    };
    const result = getStreamingValidationConfig('FRONTEND_BUILD', config as any);
    expect(result?.abortOnViolations).toBe(true);
    expect(result?.checkIntervalMs).toBe(50);
  });

  it('uses global config when phase override not present', () => {
    const config = {
      ...baseConfig,
      streaming_validation: {
        enabled: true,
        abort_on_violations: true,
        check_interval_ms: 200,
        phase_overrides: {
          SPEC_DESIGN_COMPONENTS: {
            abort_on_violations: false,
          },
        },
      },
    };
    const result = getStreamingValidationConfig('FRONTEND_BUILD', config as any);
    expect(result?.abortOnViolations).toBe(true); // global value
    expect(result?.checkIntervalMs).toBe(200); // global value
  });

  it('handles undefined streaming_validation config', () => {
    const config = { ...baseConfig };
    const result = getStreamingValidationConfig('FRONTEND_BUILD', config as any);
    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(true);
  });

  it('allows customizing patterns from config', () => {
    const config = {
      ...baseConfig,
      streaming_validation: {
        enabled: true,
        patterns: {
          placeholder: ['/CUSTOM_PATTERN/i'],
          slop: ['/custom_slop/i'],
          format: [],
        },
      },
    };
    const result = getStreamingValidationConfig('SOLUTIONING', config as any);
    expect(result?.patterns.placeholder.length).toBe(1);
    expect(result?.patterns.slop.length).toBe(1);
  });
});

describe('ValidationError', () => {
  it('stores violations array', () => {
    const violations = ['violation 1', 'violation 2'];
    const error = new ValidationError('Test error', violations);
    
    expect(error.violations).toEqual(violations);
  });

  it('has default empty violations array', () => {
    const error = new ValidationError('Test error');
    
    expect(error.violations).toEqual([]);
  });

  it('extends Error class', () => {
    const error = new ValidationError('Test error');
    
    expect(error instanceof Error).toBe(true);
    expect(error.name).toBe('ValidationError');
  });
});
