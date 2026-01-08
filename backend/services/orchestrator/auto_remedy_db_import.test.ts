import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('AUTO_REMEDY db imports', () => {
  it('does not import db modules from @/db paths', () => {
    const content = readFileSync(
      resolve(__dirname, 'orchestrator_engine.ts'),
      'utf8'
    );

    expect(content).not.toContain("import('@/db')");
    expect(content).not.toContain("import('@/db/schema')");
  });
});
