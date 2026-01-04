import { describe, it, expect, beforeEach } from 'vitest';
import { CompositionService } from './composition_service';
import { ConfigLoader } from '../orchestrator/config_loader';

describe('CompositionService', () => {
  let service: CompositionService;
  let configLoader: ConfigLoader;

  beforeEach(() => {
    configLoader = new ConfigLoader();
    service = new CompositionService(configLoader);
  });

  it('should resolve composition to full stack', () => {
    const composition = {
      base: 'nextjs_app_router',
      mobile: 'none',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = service.resolveComposition(composition);

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
    expect(result.resolved_stack?.name).toContain('Next.js');
  });

  it('should migrate legacy template to composition', () => {
    const composition = service.migrateLegacyTemplate('nextjs_fullstack_expo');

    expect(composition).toBeDefined();
    expect(composition?.base).toBe('nextjs_app_router');
    expect(composition?.mobile).toBe('expo_integration');
  });

  it('should resolve legacy template to full stack', () => {
    const result = service.resolveLegacyTemplate('nextjs_web_app');

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
  });

  it('should recommend compositions based on requirements', () => {
    const requirements = {
      project_type: 'web_app',
      platform_targets: ['web'],
      backend_complexity: 'simple'
    };

    const recommendations = service.recommendCompositions(requirements);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].composition.base).toBeDefined();
  });
});
