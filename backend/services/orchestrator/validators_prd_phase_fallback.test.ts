import { describe, it, expect } from 'vitest';
import { Validators } from './validators';

describe('validators PRD phase fallback', () => {
  it('uses SPEC_PM PRD for cross-artifact consistency checks', () => {
    const validators = new Validators();
    const cache = new Map<string, string>();
    cache.set('SPEC_PM/PRD.md', '# PRD\nREQ-AUTH-001\n');
    cache.set('SOLUTIONING/tasks.md', 'Implements REQ-AUTH-001');
    cache.set('SOLUTIONING/epics.md', 'EPIC-001');
    cache.set('ANALYSIS/personas.md', '## Persona 1: Test User');
    cache.set('SOLUTIONING/architecture.md', 'Approved stack: nextjs');

    (validators as any).artifactCache = cache;

    const result = (validators as any).validateCrossArtifactConsistency(
      { id: 'project-1' } as any,
      ['All REQ-IDs in tasks.md exist in PRD.md']
    );

    expect(result.status).toBe('pass');
    expect(result.errors).toBeUndefined();
  });
});
