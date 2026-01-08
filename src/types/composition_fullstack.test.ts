import { describe, it, expect } from 'vitest';
import { FullStackFramework, getFullStackFrameworks, isFullStackFramework, getFullStackComposition } from './composition';

describe('Full-Stack Framework Support', () => {
  it('should have 7 full-stack frameworks', () => {
    const frameworks = getFullStackFrameworks();
    expect(frameworks.length).toBe(7);
  });

  it('should identify full-stack framework IDs', () => {
    expect(isFullStackFramework('nextjs_app_router')).toBe(false);
    expect(isFullStackFramework('nextjs_fullstack')).toBe(true);
    expect(isFullStackFramework('tanstack_start')).toBe(true);
  });

  it('should return composition when mapping full-stack to base+backend', () => {
    const composition = getFullStackComposition('nextjs_fullstack');
    expect(composition).toEqual({
      base: 'nextjs_app_router',
      backend: 'integrated'
    });
  });
});
