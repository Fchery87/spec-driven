import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient } from './llm_client';

const baseConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  max_tokens: 1024,
  temperature: 0.7,
  timeout_seconds: 5,
  api_key: 'test-key'
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
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new GeminiClient(baseConfig as any);
    const promise = client.generateCompletion('prompt', undefined, 2, 'TEST'); // retries=2 => 3 attempts
    const expectation = expect(promise).rejects.toThrow(/rate limited/i);

    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails fast on non-rate-limit errors without extra retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500, statusText: 'Server Error' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new GeminiClient(baseConfig as any);

    const promise = client.generateCompletion('prompt', undefined, 2, 'TEST');
    const expectation = expect(promise).rejects.toThrow(/Gemini API error/);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
