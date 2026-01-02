/**
 * User Credentials API
 * 
 * GET /api/user/credentials - Get all user credentials (LLM and MCP)
 */

import { NextRequest, NextResponse } from 'next/server';
import { betterFetch } from '@better-fetch/fetch';
import { db } from '@/backend/lib/drizzle';
import { secrets, mcpConfigs } from '@/backend/lib/schema';
import { eq } from 'drizzle-orm';
import { encrypt, isEncryptionConfigured } from '@/backend/lib/encryption';
import { logger } from '@/lib/logger';
import type { AuthSession } from '@/app/api/middleware/auth-guard';

type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'zai' | 'groq' | 'deepseek';

const LLM_PROVIDERS: { id: ProviderType; envKey: string }[] = [
  { id: 'gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'openai', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'zai', envKey: 'ZAI_API_KEY' },
  { id: 'groq', envKey: 'GROQ_API_KEY' },
  { id: 'deepseek', envKey: 'DEEPSEEK_API_KEY' },
];

const MCP_PROVIDERS = [
  { id: 'exa-code', displayName: 'exa-code' },
  { id: 'context7', displayName: 'context7' },
];

interface CredentialResponse {
  success: boolean;
  llmCredentials?: Array<{
    provider: ProviderType;
    hasApiKey: boolean;
    maskedKey?: string;
  }>;
  mcpCredentials?: Array<{
    provider: string;
    displayName: string;
    description: string;
    hasApiKey: boolean;
    enabled: boolean;
  }>;
  error?: string;
}

async function getSession(request: NextRequest): Promise<AuthSession | null> {
  try {
    const { data: session } = await betterFetch<AuthSession>(
      '/api/auth/get-session',
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );
    return session || null;
  } catch {
    return null;
  }
}

// GET /api/user/credentials
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check encryption
    if (!isEncryptionConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'ENCRYPTION_KEY not configured. Contact administrator.',
      }, { status: 500 });
    }

    // Fetch user LLM credentials
    const userSecrets = await db
      .select({
        key: secrets.key,
        encryptedValue: secrets.encryptedValue,
      })
      .from(secrets)
      .where(eq(secrets.userId, userId));

    const llmCredentials = LLM_PROVIDERS.map(p => {
      const secret = userSecrets.find((s: { key: string }) => s.key === p.envKey);
      return {
        provider: p.id,
        hasApiKey: !!secret?.encryptedValue,
        maskedKey: secret?.encryptedValue 
          ? `****${secret.encryptedValue.slice(-4)}` 
          : undefined,
      };
    });

    // Fetch user MCP credentials
    const userMcpConfigs = await db
      .select({
        provider: mcpConfigs.provider,
        displayName: mcpConfigs.displayName,
        encryptedApiKey: mcpConfigs.encryptedApiKey,
        enabled: mcpConfigs.enabled,
      })
      .from(mcpConfigs)
      .where(eq(mcpConfigs.userId, userId));

    const mcpCredentials = MCP_PROVIDERS.map(p => {
      const config = userMcpConfigs.find((c: { provider: string }) => c.provider === p.id);
      return {
        provider: p.id,
        displayName: p.displayName,
        description: p.id === 'exa-code' ? 'Search code libraries and APIs' : 'Query library documentation',
        hasApiKey: !!config?.encryptedApiKey,
        enabled: config?.enabled ?? true,
      };
    });

    const response: CredentialResponse = {
      success: true,
      llmCredentials,
      mcpCredentials,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[User Credentials API] GET error', error instanceof Error ? error : new Error(errorMessage));
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
