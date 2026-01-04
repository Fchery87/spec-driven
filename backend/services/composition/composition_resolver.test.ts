import { describe, it, expect } from 'vitest';
import { CompositionResolver } from './composition_resolver';
import { StackComposition, CompositionSystem } from '@/types/composition';

describe('CompositionResolver', () => {
  const mockSystem: CompositionSystem = {
    version: '2.0',
    mode: 'compositional',
    base_layers: {
      nextjs_app_router: {
        name: 'Next.js App Router',
        type: 'frontend_framework',
        description: 'Next.js 14+',
        composition: {
          frontend: 'Next.js 14',
          backend: 'Next.js API routes'
        },
        compatible_with: {
          mobile: ['expo_integration', 'none'],
          backend: ['integrated', 'fastapi_api'],
          data: ['neon_postgres', 'supabase_full'],
          architecture: ['monolith', 'edge']
        },
        strengths: ['Server Components'],
        tradeoffs: ['Learning curve'],
        best_for: ['Full-stack web apps']
      }
    },
    mobile_addons: {
      expo_integration: {
        name: 'Expo',
        type: 'mobile_platform',
        description: 'Expo with React Native',
        composition: { mobile: 'Expo' },
        requires_base: ['nextjs_app_router'],
        strengths: ['Single codebase'],
        tradeoffs: ['Bundle size'],
        best_for: ['MVPs']
      },
      none: {
        name: 'No Mobile',
        type: 'mobile_platform',
        description: 'Web-only',
        composition: { mobile: 'None' },
        requires_base: ['nextjs_app_router'],
        strengths: ['Simplest'],
        tradeoffs: ['No native'],
        best_for: ['Web apps']
      }
    },
    backend_addons: {
      integrated: {
        name: 'Integrated',
        type: 'backend_service',
        description: 'Framework backend',
        composition: { backend: 'Integrated' },
        strengths: ['Simple'],
        tradeoffs: ['Framework lock-in'],
        best_for: ['Monoliths']
      }
    },
    data_addons: {
      neon_postgres: {
        name: 'Neon Postgres',
        type: 'database',
        description: 'Serverless Postgres',
        composition: { database: 'Neon Postgres', auth: 'Better Auth', storage: 'R2' },
        compatible_with_all: true,
        strengths: ['Serverless'],
        tradeoffs: ['Vendor dependency'],
        best_for: ['Web apps']
      }
    },
    architecture_addons: {
      monolith: {
        name: 'Monolith',
        type: 'architecture',
        description: 'Single deployment',
        compatible_with_all: true,
        strengths: ['Simple'],
        tradeoffs: ['Harder to scale'],
        best_for: ['MVPs']
      }
    }
  };

  it('should resolve valid composition to full stack', () => {
    const resolver = new CompositionResolver(mockSystem);
    const composition: StackComposition = {
      base: 'nextjs_app_router',
      mobile: 'none',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = resolver.resolve(composition);

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
    expect(result.resolved_stack?.name).toBe('Next.js App Router + Neon Postgres');
    expect(result.resolved_stack?.composition.frontend).toBe('Next.js 14');
    expect(result.resolved_stack?.composition.backend).toBe('Next.js API routes');
    expect(result.resolved_stack?.composition.database).toBe('Neon Postgres');
  });

  it('should reject invalid compositions', () => {
    const resolver = new CompositionResolver(mockSystem);
    const composition: StackComposition = {
      base: 'invalid_base',
      mobile: 'none',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = resolver.resolve(composition);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should generate composition ID', () => {
    const resolver = new CompositionResolver(mockSystem);
    const composition: StackComposition = {
      base: 'nextjs_app_router',
      mobile: 'expo_integration',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const id = resolver.generateCompositionId(composition);
    expect(id).toBe('nextjs_app_router+expo_integration+integrated+neon_postgres+monolith');
  });
});
