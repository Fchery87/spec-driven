import { describe, it, expect } from 'vitest';
import { ArtifactManager } from './artifact_manager';
import { Validators } from './validators';

describe('AUTO_REMEDY report naming', () => {
  it('maps remediation-report.md to AUTO_REMEDY in artifact manager', () => {
    const manager = new ArtifactManager();
    const phase = (manager as any).inferPhaseFromArtifact(
      'remediation-report.md'
    );
    expect(phase).toBe('AUTO_REMEDY');
  });

  it('requires remediation-report.md for AUTO_REMEDY phase validation', () => {
    const validators = new Validators();
    const requiredFiles = (validators as any).getRequiredFilesForPhase(
      'AUTO_REMEDY'
    );
    expect(requiredFiles).toContain('remediation-report.md');
  });
});
