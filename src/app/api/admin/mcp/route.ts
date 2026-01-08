/**
 * MCP Configuration API Endpoint
 * 
 * GET /api/admin/mcp - List all MCP configurations
 * POST /api/admin/mcp - Create or update MCP configuration
 * DELETE /api/admin/mcp?provider={provider} - Delete MCP configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/backend/lib/drizzle';
import { mcpConfigs } from '@/backend/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { withAdminAuth } from '@/app/api/middleware/auth-guard';
import { encrypt, isEncryptionConfigured } from '@/backend/lib/encryption';
import { logger } from '@/lib/logger';

interface MCPProviderConfig {
  provider: string;
  displayName: string;
  description?: string;
  docsUrl?: string;
}

// Default MCP providers
const DEFAULT_MCP_PROVIDERS: MCPProviderConfig[] = [
  {
    provider: 'exa-code',
    displayName: 'exa-code',
    description: 'Search code libraries, SDKs, and APIs',
    docsUrl: 'https://exa.ai/docs/code',
  },
  {
    provider: 'context7',
    displayName: 'context7',
    description: 'Query library documentation',
    docsUrl: 'https://context7.com',
  },
  {
    provider: 'web-search',
    displayName: 'Web Search',
    description: 'Find recent code patterns and examples',
  },
];

interface MCPConfigResponse {
  success: boolean;
  data?: Array<{
    provider: string;
    displayName: string;
    description: string;
    docsUrl?: string;
    hasApiKey: boolean;
    enabled: boolean;
    connected?: boolean;
    lastCheckedAt?: string;
  }>;
  encryptionConfigured?: boolean;
  error?: string;
}

interface MCPConfigRequest {
  provider: string;
  apiKey?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

interface DBConfig {
  provider: string;
  displayName: string | null;
  enabled: boolean | null;
  connected: boolean | null;
  lastCheckedAt: Date | null;
  encryptedApiKey: string | null;
}

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const encryptionKeyConfigured = isEncryptionConfigured();
    
    // Fetch all MCP configurations from database
    const configsResult = await db
      .select({
        provider: mcpConfigs.provider,
        displayName: mcpConfigs.displayName,
        configJson: mcpConfigs.configJson,
        enabled: mcpConfigs.enabled,
        connected: mcpConfigs.connected,
        lastCheckedAt: mcpConfigs.lastCheckedAt,
        encryptedApiKey: mcpConfigs.encryptedApiKey,
      })
      .from(mcpConfigs)
      .orderBy(desc(mcpConfigs.provider));

    const configs = configsResult as DBConfig[];

    // Create a map of existing configs
    const configMap = new Map<string, DBConfig>(configs.map((c) => [c.provider, c]));

    // Merge with default providers (for those not in database)
    const response: MCPConfigResponse = {
      success: true,
      data: DEFAULT_MCP_PROVIDERS.map(defaultProvider => {
        const dbConfig = configMap.get(defaultProvider.provider);
        
        return {
          provider: defaultProvider.provider,
          displayName: dbConfig?.displayName || defaultProvider.displayName,
          description: defaultProvider.description || '',
          docsUrl: defaultProvider.docsUrl,
          hasApiKey: !!dbConfig?.encryptedApiKey,
          enabled: dbConfig?.enabled ?? true,
          connected: dbConfig?.connected ?? undefined,
          lastCheckedAt: dbConfig?.lastCheckedAt?.toISOString() ?? undefined,
        };
      }),
      encryptionConfigured: isEncryptionConfigured(),
    };

    // Add any custom providers from database that aren't defaults
    const defaultProviders = new Set(DEFAULT_MCP_PROVIDERS.map(p => p.provider));
    const customConfigs = configs.filter((c) => !defaultProviders.has(c.provider));
    
    if (customConfigs.length > 0) {
      response.data?.push(...customConfigs.map((c) => ({
        provider: c.provider,
        displayName: c.displayName || c.provider,
        description: '',
        hasApiKey: !!c.encryptedApiKey,
        enabled: c.enabled ?? true,
        connected: c.connected ?? undefined,
        lastCheckedAt: c.lastCheckedAt?.toISOString(),
      })));
    }

    logger.info('[MCP Config API] GET - Listed MCP configurations', {
      count: response.data?.length,
      encryptionConfigured: isEncryptionConfigured(),
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[MCP Config API] GET error', error instanceof Error ? error : new Error(errorMessage));

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body: MCPConfigRequest = await req.json();
    const { provider, apiKey, enabled, config } = body;

    // Validate provider
    if (!provider || typeof provider !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: provider',
        },
        { status: 400 }
      );
    }

    // Check encryption key
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'ENCRYPTION_KEY not configured. Add it to your environment variables.',
        },
        { status: 500 }
      );
    }

    // Check if config exists
    const existing = await db
      .select()
      .from(mcpConfigs)
      .where(eq(mcpConfigs.provider, provider))
      .limit(1);

    const displayName = DEFAULT_MCP_PROVIDERS.find(p => p.provider === provider)?.displayName || provider;
    const now = new Date();

    if (existing.length > 0) {
      // Update existing config
      const updateData: Record<string, unknown> = {
        displayName,
        enabled: enabled ?? existing[0].enabled,
        configJson: config ? JSON.stringify(config) : existing[0].configJson,
        updatedAt: now,
      };

      // Encrypt API key if provided
      if (apiKey && apiKey.trim()) {
        updateData.encryptedApiKey = encrypt(apiKey);
      }

      await db
        .update(mcpConfigs)
        .set(updateData)
        .where(eq(mcpConfigs.provider, provider));

      logger.info('[MCP Config API] POST - Updated MCP configuration', { provider });
    } else {
      // Create new config
      await db.insert(mcpConfigs).values({
        provider,
        displayName,
        encryptedApiKey: apiKey ? encrypt(apiKey) : undefined,
        enabled: enabled ?? true,
        configJson: config ? JSON.stringify(config) : undefined,
        createdAt: now,
        updatedAt: now,
      });

      logger.info('[MCP Config API] POST - Created MCP configuration', { provider });
    }

    return NextResponse.json({
      success: true,
      message: `MCP configuration for ${displayName} saved successfully`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[MCP Config API] POST error', error instanceof Error ? error : new Error(errorMessage));

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});

export const DELETE = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: provider',
        },
        { status: 400 }
      );
    }

    const result = await db
      .delete(mcpConfigs)
      .where(eq(mcpConfigs.provider, provider));

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `MCP configuration for ${provider} not found`,
        },
        { status: 404 }
      );
    }

    logger.info('[MCP Config API] DELETE - Deleted MCP configuration', { provider });

    return NextResponse.json({
      success: true,
      message: `MCP configuration for ${provider} deleted successfully`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[MCP Config API] DELETE error', error instanceof Error ? error : new Error(errorMessage));

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});
