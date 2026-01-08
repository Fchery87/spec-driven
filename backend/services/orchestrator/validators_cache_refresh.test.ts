import { describe, it, expect } from 'vitest';
import { Validators } from './validators';

describe('Validators cache refresh', () => {
  it('uses updated artifact cache for the same project', () => {
    const validators = new Validators();
    const project = { id: 'project-1', slug: 'project-1' } as any;

    const staleCache = new Map<string, string>();
    staleCache.set('SPEC_PM/PRD.md', '# PRD\n');
    staleCache.set('SOLUTIONING/tasks.md', 'Implements REQ-AUTH-001');
    staleCache.set('SOLUTIONING/epics.md', 'EPIC-001');
    staleCache.set('ANALYSIS/personas.md', '## Persona 1: Test User');
    staleCache.set('SOLUTIONING/architecture.md', 'Approved stack: nextjs');

    validators.setArtifactCache(project, staleCache);
    let result = (validators as any).validateCrossArtifactConsistency(
      project,
      ['REQ-IDs in tasks.md exist in PRD.md']
    );

    expect(result.status).toBe('fail');
    expect(result.errors?.[0]).toContain('REQ-AUTH-001');

    const refreshedCache = new Map<string, string>();
    refreshedCache.set('SPEC_PM/PRD.md', '# PRD\nREQ-AUTH-001\n');
    refreshedCache.set('SOLUTIONING/tasks.md', 'Implements REQ-AUTH-001');
    refreshedCache.set('SOLUTIONING/epics.md', 'EPIC-001');
    refreshedCache.set('ANALYSIS/personas.md', '## Persona 1: Test User');
    refreshedCache.set('SOLUTIONING/architecture.md', 'Approved stack: nextjs');

    validators.setArtifactCache(project, refreshedCache);
    result = (validators as any).validateCrossArtifactConsistency(
      project,
      ['REQ-IDs in tasks.md exist in PRD.md']
    );

    expect(result.status).toBe('pass');
  });
});
