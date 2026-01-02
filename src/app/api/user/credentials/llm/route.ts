/**
 * User LLM Credentials API
 * 
 * POST /api/user/credentials/llm - Save user LLM credential
 * DELETE /api/user/credentials/llm?provider=xxx - Delete user LLM credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { betterFetch } from '@better-fetch/fetch';
import { db } from '@/backend/lib/drizzle';
import { secrets } from '@/backend/lib/schema';
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

// POST /api/user/credentials/llm
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { provider, apiKey } = body as { provider: ProviderType; apiKey: string };

    // Validate provider
    if (!provider || !LLM_PROVIDERS.find(p => p.id === provider)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid provider',
      }, { status: 400 });
    }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return NextResponse.json({
        success: false,
        error: 'API key must be at least 8 characters',
      }, { status: 400 });
    }

    // Check encryption
    if (!isEncryptionConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'ENCRYPTION_KEY not configured. Contact administrator.',
      }, { status: 500 });
    }

    const envKey = LLM_PROVIDERS.find(p => p.id === provider)!.envKey;
    const encryptedValue = encrypt(apiKey.trim());
    const now = new Date();

    // Check if credential already exists
    const existing = await db
      .select()
      .from(secrets)
      .where(eq(secrets.userId, userId))
      .where(eq(secrets.key, envKey))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(secrets)
        .set({
          encryptedValue,
          updatedAt: now,
        })
        .where(eq(secrets.userId, userId))
        .where(eq(secrets.key, envKey));
    } else {
      // Insert new
      await db.insert(secrets).values({
        key: envKey,
        userId,
        encryptedValue,
        createdAt: now,
        updatedAt: now,
      });
    }

    logger.info('[User LLM Credentials] Saved credential', { userId, provider });

    return NextResponse.json({
      success: true,
      message: `${provider.toUpperCase()} API key saved`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[User LLM Credentials] POST error', error instanceof Error ? error : new Error(errorMessage));
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// DELETE /api/user/credentials/llm?provider=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') as ProviderType | null;

    // Validate provider
    if (!provider || !LLM_PROVIDERS.find(p => p.id === provider)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid provider',
      }, { status: 400 });
    }

    const envKey = LLM_PROVIDERS.find(p => p.id === provider)!.envKey;

    const result = await db
      .delete(secrets)
      .where(eq(secrets.userId, userId))
      .where(eq(secrets.key, envKey));

    if (result.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Credential not found',
      }, { status: 404 });
    }

    logger.info('[User LLM Credentials] Deleted credential', { userId, provider });

    return NextResponse.json({
      success: true,
      message: `${provider.toUpperCase()} API key removed`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[User LLM Credentials] DELETE error', error instanceof Error ? error : new Error(errorMessage));
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
