/**
 * User MCP Credentials API
 * 
 * POST /api/user/credentials/mcp - Save user MCP credential
 * DELETE /api/user/credentials/mcp?provider=xxx - Delete user MCP credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { betterFetch } from '@better-fetch/fetch';
import { db } from '@/backend/lib/drizzle';
import { mcpConfigs } from '@/backend/lib/schema';
import { eq } from 'drizzle-orm';
import { encrypt, isEncryptionConfigured } from '@/backend/lib/encryption';
import { logger } from '@/lib/logger';
import type { AuthSession } from '@/app/api/middleware/auth-guard';

const MCP_PROVIDERS = [
  { id: 'exa-code', displayName: 'exa-code' },
  { id: 'context7', displayName: 'context7' },
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

// POST /api/user/credentials/mcp
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { provider, apiKey } = body as { provider: string; apiKey: string };

    // Validate provider
    if (!provider || !MCP_PROVIDERS.find(p => p.id === provider)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid MCP provider',
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

    const providerInfo = MCP_PROVIDERS.find(p => p.id === provider)!;
    const encryptedApiKey = encrypt(apiKey.trim());
    const now = new Date();

    // Check if credential already exists
    const existing = await db
      .select()
      .from(mcpConfigs)
      .where(eq(mcpConfigs.userId, userId))
      .where(eq(mcpConfigs.provider, provider))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(mcpConfigs)
        .set({
          encryptedApiKey,
          enabled: true,
          updatedAt: now,
        })
        .where(eq(mcpConfigs.userId, userId))
        .where(eq(mcpConfigs.provider, provider));
    } else {
      // Insert new
      await db.insert(mcpConfigs).values({
        userId,
        provider,
        displayName: providerInfo.displayName,
        encryptedApiKey,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    logger.info('[User MCP Credentials] Saved credential', { userId, provider });

    return NextResponse.json({
      success: true,
      message: `${providerInfo.displayName} API key saved`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[User MCP Credentials] POST error', error instanceof Error ? error : new Error(errorMessage));
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// DELETE /api/user/credentials/mcp?provider=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    // Validate provider
    if (!provider || !MCP_PROVIDERS.find(p => p.id === provider)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid MCP provider',
      }, { status: 400 });
    }

    const result = await db
      .delete(mcpConfigs)
      .where(eq(mcpConfigs.userId, userId))
      .where(eq(mcpConfigs.provider, provider));

    if (result.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'MCP credential not found',
      }, { status: 404 });
    }

    logger.info('[User MCP Credentials] Deleted credential', { userId, provider });

    return NextResponse.json({
      success: true,
      message: `${provider} API key removed`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[User MCP Credentials] DELETE error', error instanceof Error ? error : new Error(errorMessage));
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
