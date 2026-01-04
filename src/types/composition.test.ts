import { describe, it, expect } from 'vitest';
import {
  BaseLayer,
  StackComposition,
  CompositionSystem,
  validateComposition
} from './composition';

describe('Composition Types', () => {
  it('should define BaseLayer type', () => {
    const base: BaseLayer = {
      id: 'nextjs_app_router',
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
        data: ['neon_postgres'],
        architecture: ['monolith', 'edge']
      },
      strengths: ['Server Components'],
      tradeoffs: ['Learning curve'],
      best_for: ['Full-stack web apps']
    };
    expect(base.id).toBe('nextjs_app_router');
  });

  it('should validate compatible compositions', () => {
    const composition: StackComposition = {
      base: 'nextjs_app_router',
      mobile: 'expo_integration',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = validateComposition(composition, mockCompositionSystem as unknown as Partial<CompositionSystem>);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject incompatible compositions', () => {
    const composition: StackComposition = {
      base: 'astro',
      mobile: 'expo_integration', // Astro doesn't support Expo
      backend: 'integrated',
      data: 'none',
      architecture: 'monolith'
    };

    const result = validateComposition(composition, mockCompositionSystem as unknown as Partial<CompositionSystem>);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

const mockCompositionSystem = {
  version: '2.0',
  mode: 'compositional' as const,
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
        data: ['neon_postgres'],
        architecture: ['monolith', 'edge']
      },
      strengths: ['Server Components'],
      tradeoffs: ['Learning curve'],
      best_for: ['Full-stack web apps']
    },
    astro: {
      name: 'Astro',
      type: 'frontend_framework',
      description: 'Astro with islands',
      composition: {
        frontend: 'Astro',
        backend: 'Serverless functions'
      },
      compatible_with: {
        mobile: ['none'],
        backend: ['serverless_only'],
        data: ['headless_cms', 'none'],
        architecture: ['monolith', 'edge']
      },
      strengths: ['Zero JS'],
      tradeoffs: ['Limited interactivity'],
      best_for: ['Marketing sites']
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
      requires_base: ['nextjs_app_router', 'astro'],
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
      composition: { database: 'Neon Postgres' },
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
