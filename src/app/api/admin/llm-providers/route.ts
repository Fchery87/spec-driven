import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/app/api/middleware/auth-guard';

type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'zai' | 'groq';

const PROVIDER_ENV_KEYS: Record<ProviderType, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  zai: 'ZAI_API_KEY',
  groq: 'GROQ_API_KEY',
};

export const GET = withAdminAuth(async () => {
  try {
    const status: Record<ProviderType, { configured: boolean }> = {
      gemini: { configured: false },
      openai: { configured: false },
      anthropic: { configured: false },
      zai: { configured: false },
      groq: { configured: false },
    };

    for (const [provider, envKey] of Object.entries(PROVIDER_ENV_KEYS)) {
      const apiKey = process.env[envKey];
      status[provider as ProviderType] = {
        configured: !!apiKey && apiKey.length > 0,
      };
    }

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error('Failed to check provider status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check provider status' },
      { status: 500 }
    );
  }
});
