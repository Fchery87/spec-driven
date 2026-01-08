import { describe, it, expect } from 'vitest';
import { ConfigLoader } from './config_loader';

describe('FRONTEND_BUILD Phase Configuration', () => {
  const configLoader = new ConfigLoader();
   
  const spec = configLoader.loadSpec() as any;

  it('should define FRONTEND_BUILD phase', () => {
    expect(spec.phases.FRONTEND_BUILD).toBeDefined();
  });

  it('should have correct phase description', () => {
    expect(spec.phases.FRONTEND_BUILD.description).toBe(
      'Generate production-ready frontend components from design tokens and component inventory'
    );
  });

  it('should have frontend_developer as owner', () => {
    expect(spec.phases.FRONTEND_BUILD.owner).toBe('frontend_developer');
  });

  it('should have phase_type set to implementation', () => {
    expect(spec.phases.FRONTEND_BUILD.phase_type).toBe('implementation');
  });

  it('should depend on SPEC_DESIGN_COMPONENTS and STACK_SELECTION', () => {
    const dependsOn = spec.phases.FRONTEND_BUILD.depends_on;
    expect(dependsOn).toBeDefined();
    expect(dependsOn).toContain('SPEC_DESIGN_COMPONENTS');
    expect(dependsOn).toContain('STACK_SELECTION');
    expect(dependsOn.length).toBe(2);
  });

  it('should require stack to be true', () => {
    expect(spec.phases.FRONTEND_BUILD.requires_stack).toBe(true);
  });

  it('should have priority set to 5', () => {
    expect(spec.phases.FRONTEND_BUILD.priority).toBe(5);
  });

  it('should have correct next_phase (DEPENDENCIES)', () => {
    expect(spec.phases.FRONTEND_BUILD.next_phase).toBe('DEPENDENCIES');
  });

  it('should have validators including presence, typescript_compile, and anti_generic_code', () => {
    const validators = spec.phases.FRONTEND_BUILD.validators;
    expect(validators).toContain('presence');
    expect(validators).toContain('typescript_compile');
    expect(validators).toContain('anti_generic_code');
  });

  it('should define produces list with component files', () => {
    const produces = spec.phases.FRONTEND_BUILD.produces;
    expect(produces).toBeDefined();
    expect(produces).toContain('components/ui/button.tsx');
    expect(produces).toContain('components/ui/card.tsx');
    expect(produces).toContain('components/ui/input.tsx');
    expect(produces).toContain('components/ui/badge.tsx');
    expect(produces).toContain('components/ui/dialog.tsx');
    expect(produces).toContain('components/ui/dropdown-menu.tsx');
    expect(produces).toContain('components/ui/tabs.tsx');
    expect(produces).toContain('components/ui/select.tsx');
    expect(produces).toContain('components/ui/textarea.tsx');
    expect(produces).toContain('components/ui/form.tsx');
    expect(produces).toContain('components/ui/alert.tsx');
    expect(produces).toContain('components/ui/toast.tsx');
    expect(produces).toContain('lib/motion.ts');
  });

  it('should have quality checklist with at least 5 items', () => {
    const checklist = spec.phases.FRONTEND_BUILD.quality_checklist;
    expect(checklist).toBeDefined();
    expect(checklist.length).toBeGreaterThanOrEqual(5);
    expect(checklist).toContain('All components in component-inventory.md are generated');
    expect(checklist).toContain('TypeScript compiles without errors');
  });

  it('should have frontend_developer agent defined', () => {
    expect(spec.agents.frontend_developer).toBeDefined();
    expect(spec.agents.frontend_developer.role).toBe('Frontend Developer');
    expect(spec.agents.frontend_developer.perspective).toBe('Senior UI Engineer');
  });

  it('SPEC_DESIGN_COMPONENTS should point to FRONTEND_BUILD as next_phase', () => {
    expect(spec.phases.SPEC_DESIGN_COMPONENTS.next_phase).toBe('FRONTEND_BUILD');
  });
});
