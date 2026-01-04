import { describe, it, expect } from 'vitest';
import { ConfigLoader } from './config_loader';

describe('Orchestrator Config - Phase 3 Design Phases', () => {
  it('should define SPEC_DESIGN_TOKENS and SPEC_DESIGN_COMPONENTS as separate phases', () => {
    const configLoader = new ConfigLoader();
    const spec = configLoader.loadSpec();
    
    expect(spec.phases.SPEC_DESIGN_TOKENS).toBeDefined();
    expect(spec.phases.SPEC_DESIGN_TOKENS.description).toContain('stack-agnostic');
    expect(spec.phases.SPEC_DESIGN_TOKENS.requires_stack).toBe(false);
    
    expect(spec.phases.SPEC_DESIGN_COMPONENTS).toBeDefined();
    expect(spec.phases.SPEC_DESIGN_COMPONENTS.description).toContain('requires stack selection');
    expect(spec.phases.SPEC_DESIGN_COMPONENTS.requires_stack).toBe(true);
    
    // Verify they both use designer agent
    expect(spec.phases.SPEC_DESIGN_TOKENS.owner).toBe('designer');
    expect(spec.phases.SPEC_DESIGN_COMPONENTS.owner).toBe('designer');
  });
});
