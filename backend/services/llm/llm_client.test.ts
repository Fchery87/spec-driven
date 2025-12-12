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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // eliminate jitter variance
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries on 429 up to max attempts then fails with rate-limit error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    // @ts-expect-error - override global fetch for test
    global.fetch = fetchMock;

    const client = new GeminiClient(baseConfig as any);
    const promise = client.generateCompletion('prompt', undefined, 2, 'TEST'); // retries=2 => 3 attempts
    const expectation = expect(promise).rejects.toThrow(/rate limited/i);

    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails fast on non-rate-limit errors without extra retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500, statusText: 'Server Error' }));
    // @ts-expect-error - override global fetch for test
    global.fetch = fetchMock;

    const client = new GeminiClient(baseConfig as any);

    await expect(client.generateCompletion('prompt', undefined, 2, 'TEST')).rejects.toThrow(/Gemini API error/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
