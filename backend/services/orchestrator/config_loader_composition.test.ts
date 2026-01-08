import { describe, it, expect } from 'vitest';
import { ConfigLoader } from './config_loader';

describe('ConfigLoader - Composition System', () => {
  it('should load composition_system from spec', () => {
    const loader = new ConfigLoader();
    const spec = loader.loadSpec();

    expect(spec.composition_system).toBeDefined();
    expect(spec.composition_system?.version).toBe('2.0');
    expect(spec.composition_system?.mode).toBe('compositional');
    expect(spec.composition_system?.base_layers).toBeDefined();
    expect(Object.keys(spec.composition_system?.base_layers || {}).length).toBeGreaterThan(0);
  });

  it('should load legacy_template_migration from spec', () => {
    const loader = new ConfigLoader();
    const spec = loader.loadSpec();

    expect(spec.legacy_template_migration).toBeDefined();
    expect(spec.legacy_template_migration?.nextjs_fullstack_expo).toBeDefined();
    expect(spec.legacy_template_migration?.nextjs_fullstack_expo.composition.base).toBe('nextjs_app_router');
  });

  it('should provide getCompositionSystem helper', () => {
    const loader = new ConfigLoader();
    const compositionSystem = loader.getCompositionSystem();

    expect(compositionSystem).toBeDefined();
    expect(compositionSystem.version).toBe('2.0');
    expect(compositionSystem.base_layers).toBeDefined();
  });

  it('should provide getLegacyMappings helper', () => {
    const loader = new ConfigLoader();
    const mappings = loader.getLegacyMappings();

    expect(mappings).toBeDefined();
    expect(Object.keys(mappings).length).toBeGreaterThan(0);
  });

  it('should correctly identify composition mode', () => {
    const loader = new ConfigLoader();
    
    expect(loader.isCompositionMode()).toBe(true);
    expect(loader.isLegacyMode()).toBe(false);
  });
});
