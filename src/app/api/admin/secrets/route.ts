import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/backend/lib/drizzle';
import { secrets } from '@/backend/lib/schema';
import { eq } from 'drizzle-orm';
import { withAdminAuth } from '@/app/api/middleware/auth-guard';
import { encrypt, decrypt, maskApiKey, isEncryptionConfigured } from '@/backend/lib/encryption';

type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'zai' | 'groq' | 'deepseek';

const PROVIDER_ENV_KEYS: Record<ProviderType, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  zai: 'ZAI_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
};

// GET - Retrieve masked status of all API keys
export const GET = withAdminAuth(async () => {
  try {
    const status: Record<string, { 
      hasEnvKey: boolean; 
      hasDbKey: boolean; 
      maskedKey?: string;
      source?: 'env' | 'db';
    }> = {};

    for (const [provider, envKey] of Object.entries(PROVIDER_ENV_KEYS)) {
      const envValue = process.env[envKey];
      
      // Check database for encrypted key
      let dbKey: string | undefined;
      try {
        const dbResult = await db
          .select()
          .from(secrets)
          .where(eq(secrets.key, envKey))
          .limit(1);
        
        if (dbResult.length > 0 && isEncryptionConfigured()) {
          dbKey = decrypt(dbResult[0].encryptedValue);
        }
      } catch {
        // Table might not exist yet or decryption failed
      }

      status[provider] = {
        hasEnvKey: !!envValue,
        hasDbKey: !!dbKey,
        source: envValue ? 'env' : dbKey ? 'db' : undefined,
        maskedKey: envValue 
          ? maskApiKey(envValue) 
          : dbKey 
            ? maskApiKey(dbKey) 
            : undefined,
      };
    }

    return NextResponse.json({ 
      success: true, 
      data: status,
      encryptionConfigured: isEncryptionConfigured()
    });
  } catch (error) {
    console.error('Failed to fetch secrets status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch secrets status' },
      { status: 500 }
    );
  }
});

// POST - Save an encrypted API key
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        { success: false, error: 'ENCRYPTION_KEY not configured. Add it to your environment variables.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { provider, apiKey } = body as { provider: ProviderType; apiKey: string };

    if (!provider || !PROVIDER_ENV_KEYS[provider]) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const envKey = PROVIDER_ENV_KEYS[provider];
    const encryptedValue = encrypt(apiKey.trim());

    // Upsert the secret
    const existing = await db
      .select()
      .from(secrets)
      .where(eq(secrets.key, envKey))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(secrets)
        .set({ encryptedValue, updatedAt: new Date() })
        .where(eq(secrets.key, envKey));
    } else {
      await db.insert(secrets).values({
        key: envKey,
        encryptedValue,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${provider} API key saved securely`,
      maskedKey: maskApiKey(apiKey)
    });
  } catch (error) {
    console.error('Failed to save secret:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save API key' },
      { status: 500 }
    );
  }
});

// DELETE - Remove an API key from database
export const DELETE = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as ProviderType;

    if (!provider || !PROVIDER_ENV_KEYS[provider]) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const envKey = PROVIDER_ENV_KEYS[provider];
    await db.delete(secrets).where(eq(secrets.key, envKey));

    return NextResponse.json({ 
      success: true, 
      message: `${provider} API key removed from database` 
    });
  } catch (error) {
    console.error('Failed to delete secret:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
});
