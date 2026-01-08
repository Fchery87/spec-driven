import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCompositionResponse = {
  success: true,
  data: {
    mode: 'compositional',
    templates: [],
    composition_system: {
      version: '2.0',
      base_layers: {
        nextjs_app_router: { name: 'Next.js App Router' },
        astro: { name: 'Astro' }
      },
      mobile_addons: {
        expo_integration: { name: 'Expo (React Native)' },
        none: { name: 'No Mobile' }
      },
      backend_addons: {
        integrated: { name: 'Integrated Backend' },
        fastapi_api: { name: 'FastAPI (Python)' }
      },
      data_addons: {
        neon_postgres: { name: 'Neon Postgres + Drizzle' },
        supabase_full: { name: 'Supabase' }
      },
      architecture_addons: {
        monolith: { name: 'Monolith' },
        edge: { name: 'Edge Computing' }
      }
    },
    legacy_template_migration: {
      nextjs_fullstack_expo: {
        composition: {
          frontend: 'nextjs_app_router',
          mobile: 'expo_integration',
          backend: 'integrated',
          data: 'neon_postgres',
          architecture: 'monolith'
        },
        reason: 'Legacy template for Next.js fullstack with Expo mobile'
      }
    }
  }
};

describe('/api/stacks - Composition System', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/stacks')) {
          return {
            ok: true,
            json: async () => mockCompositionResponse,
          } as Response;
        }
        throw new Error(`Unhandled fetch: ${url}`);
      })
    );
  });

  it('should include composition_system in response', async () => {
    const response = await fetch('/api/stacks');
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.composition_system).toBeDefined();
    expect(data.data.composition_system.version).toBe('2.0');
    expect(data.data.composition_system.base_layers).toBeDefined();
    expect(Object.keys(data.data.composition_system.base_layers).length).toBeGreaterThan(0);
  });

  it('should include all layer types in composition_system', async () => {
    const response = await fetch('/api/stacks');
    const data = await response.json();
    const cs = data.data.composition_system;
    
    expect(cs.base_layers).toBeDefined();
    expect(cs.mobile_addons).toBeDefined();
    expect(cs.backend_addons).toBeDefined();
    expect(cs.data_addons).toBeDefined();
    expect(cs.architecture_addons).toBeDefined();
  });

  it('should include legacy_template_migration for backward compatibility', async () => {
    const response = await fetch('/api/stacks');
    const data = await response.json();
    
    expect(data.data.legacy_template_migration).toBeDefined();
    expect(data.data.legacy_template_migration.nextjs_fullstack_expo).toBeDefined();
  });
});
