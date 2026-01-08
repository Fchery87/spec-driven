import { describe, it, expect } from 'vitest';
import {
  detectUserEdit,
  generateDiffPreview,
  createConflictMarkers,
  validateChangeScope,
  isProtectedArtifact,
  SafeguardResult,
  hashContent,
} from './auto_remedy_safeguards';

describe('AUTO_REMEDY Safeguards', () => {
  describe('Layer 1: User Edit Detection', () => {
    it('should detect no changes when content matches original hash', () => {
      const originalContent = 'This is the original content';
      const originalHash = hashContent(originalContent); // Use actual hash
      const currentContent = 'This is the original content';

      const result = detectUserEdit(originalContent, currentContent, originalHash);
      expect(result.userEditDetected).toBe(false);
      expect(result.reason).toContain('no manual edits');
    });

    it('should detect user edits when content hash differs', () => {
      const originalContent = 'This is the original content';
      const originalHash = 'abc123def456';
      const currentContent = 'This is MODIFIED content';

      const result = detectUserEdit(originalContent, currentContent, originalHash);
      expect(result.userEditDetected).toBe(true);
      expect(result.reason).toContain('manual edit');
    });
  });

  describe('Layer 2: Diff Preview', () => {
    it('should generate unified diff preview', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nModified Line 2\nLine 3';

      const diff = generateDiffPreview(oldContent, newContent, 'PRD.md');
      expect(diff).toContain('--- PRD.md (original)');
      expect(diff).toContain('+++ PRD.md (proposed)');
      expect(diff).toContain('- Line 2');
      expect(diff).toContain('+ Modified Line 2');
    });

    it('should handle empty diffs gracefully', () => {
      const content = 'Same content';
      const diff = generateDiffPreview(content, content, 'test.md');
      expect(diff).toContain('No changes');
    });
  });

  describe('Layer 3: Conflict Markers', () => {
    it('should create git-style conflict markers', () => {
      const userVersion = 'User edited this line';
      const autoRemedyVersion = 'AUTO_REMEDY wants this';

      const marked = createConflictMarkers(
        'PRD.md',
        userVersion,
        autoRemedyVersion,
        10
      );

      expect(marked).toContain('<<<<<<< HEAD (User Edit)');
      expect(marked).toContain(userVersion);
      expect(marked).toContain('=======');
      expect(marked).toContain(autoRemedyVersion);
      expect(marked).toContain('>>>>>>> AUTO_REMEDY');
      expect(marked).toContain('Line 10');
    });
  });

  describe('Lines Changed Calculation Accuracy', () => {
    it('should correctly count lines when content changes', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nModified Line 2\nLine 3';

      const result = validateChangeScope(oldContent, newContent, 'test.md');
      expect(result.linesChanged).toBe(1); // Only 1 line actually changed
    });

    it('should correctly count when lines are deleted', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nLine 3';

      const result = validateChangeScope(oldContent, newContent, 'test.md');
      expect(result.linesChanged).toBe(2); // Line at index 1 changed, line at index 2 deleted
    });

    it('should correctly count when lines are inserted', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'INSERTED\nLine 1\nLine 2\nLine 3';

      const result = validateChangeScope(oldContent, newContent, 'test.md');
      expect(result.linesChanged).toBe(4); // All lines shifted by insert
    });

    it('should handle empty old content', () => {
      const oldContent = '';
      const newContent = 'Line 1\nLine 2\nLine 3';

      const result = validateChangeScope(oldContent, newContent, 'test.md');
      expect(result.linesChanged).toBe(3);
    });

    it('should handle empty new content', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = '';

      const result = validateChangeScope(oldContent, newContent, 'test.md');
      expect(result.linesChanged).toBe(3);
    });
  });

  describe('Layer 4: Scope Limits', () => {
    it('should approve changes within limits', () => {
      const oldContent = 'Line 1\n'.repeat(10);
      const newContent = 'Modified\n'.repeat(10);

      const result = validateChangeScope(
        oldContent,
        newContent,
        'data-model.md'
      );
      expect(result.approved).toBe(true);
      expect(result.linesChanged).toBe(10);
    });

    it('should reject changes exceeding 50 line limit', () => {
      const oldContent = 'Line 1\n'.repeat(60);
      const newContent = 'Modified\n'.repeat(60);

      const result = validateChangeScope(
        oldContent,
        newContent,
        'api-spec.json'
      );
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('exceeds 50 line limit');
    });

    it('should reject changes to protected artifacts', () => {
      const result = validateChangeScope(
        'old content',
        'new content',
        'constitution.md'
      );
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('protected artifact');
    });
  });

  describe('Protected Artifacts', () => {
    it('should identify constitution.md as protected', () => {
      expect(isProtectedArtifact('constitution.md')).toBe(true);
    });

    it('should identify project-brief.md as protected', () => {
      expect(isProtectedArtifact('project-brief.md')).toBe(true);
    });

    it('should allow modifications to non-protected artifacts', () => {
      expect(isProtectedArtifact('PRD.md')).toBe(false);
      expect(isProtectedArtifact('data-model.md')).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should throw error for null content in hash function', () => {
      expect(() => hashContent(null as any)).toThrow('cannot be null');
    });

    it('should throw error for undefined content in hash function', () => {
      expect(() => hashContent(undefined as any)).toThrow('cannot be null');
    });
  });
});
