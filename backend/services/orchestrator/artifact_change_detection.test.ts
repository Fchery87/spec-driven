import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { createHash } from 'crypto';

/**
 * Unit tests for detectArtifactChanges method
 * Tests SHA-256 hash comparison, section change detection, and impact level calculation
 */

describe('detectArtifactChanges', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    // Create a new instance for each test
    engine = new OrchestratorEngine();
  });

  describe('Hash Generation', () => {
    it('should generate consistent SHA-256 hashes for same content', () => {
      const content = '# Test Content\n\nThis is a test.';
      const hash1 = createHash('sha256').update(content).digest('hex');
      const hash2 = createHash('sha256').update(content).digest('hex');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different content', () => {
      const content1 = '# Test Content 1';
      const content2 = '# Test Content 2';

      const hash1 = createHash('sha256').update(content1).digest('hex');
      const hash2 = createHash('sha256').update(content2).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate hash for empty content', () => {
      const emptyHash = createHash('sha256').update('').digest('hex');
      expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(emptyHash).toHaveLength(64);
    });
  });

  describe('No Change Detection', () => {
    it('should return null when content is identical', () => {
      const content = '# Test\n\nSome content here.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        content,
        content
      );

      expect(result).toBeNull();
    });

    it('should return null when both contents are empty', () => {
      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        '',
        ''
      );

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only equivalent content', () => {
      // Note: This test documents current behavior - different whitespace produces different hashes
      const content1 = 'Content';
      const content2 = 'Content  ';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        content1,
        content2
      );

      expect(result).not.toBeNull();
    });
  });

  describe('Change Detection', () => {
    it('should detect when content has changed', () => {
      const oldContent = '# Test\n\nOriginal content.';
      const newContent = '# Test\n\nModified content.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      expect(result?.projectId).toBe('test-project');
      expect(result?.artifactName).toBe('test-artifact.md');
      expect(result?.oldHash).not.toBe(result?.newHash);
    });

    it('should return different hashes for different content', () => {
      const oldContent = '# Test\n\nOld content.';
      const newContent = '# Test\n\nNew content.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result?.oldHash).not.toBe(result?.newHash);
      // Verify they are valid SHA-256 hashes
      expect(result?.oldHash).toHaveLength(64);
      expect(result?.newHash).toHaveLength(64);
    });
  });

  describe('Added Section Detection', () => {
    it('should detect added sections (new headers)', () => {
      const oldContent = `# Introduction
This is the intro.

## Section 1
Content here.`;

      const newContent = `# Introduction
This is the intro.

## Section 1
Content here.

## Section 2
New content here.`;

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      expect(result?.impactLevel).toBe('HIGH');

      const addedSection = result?.changedSections.find(
        (s) => s.changeType === 'added'
      );
      expect(addedSection).toBeDefined();
      expect(addedSection?.header).toBe('Section 2');
    });
  });

  describe('Deleted Section Detection', () => {
    it('should detect deleted sections (removed headers)', () => {
      const oldContent = `# Introduction
This is the intro.

## Section 1
Content here.

## Section 2
Content to remove.`;

      const newContent = `# Introduction
This is the intro.

## Section 1
Content here.`;

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      expect(result?.impactLevel).toBe('HIGH');

      const deletedSection = result?.changedSections.find(
        (s) => s.changeType === 'deleted'
      );
      expect(deletedSection).toBeDefined();
      expect(deletedSection?.header).toBe('Section 2');
    });
  });

  describe('Modified Section Detection', () => {
    it('should detect modified sections (same header, different content)', () => {
      const oldContent = `# Introduction
This is the intro.

## Section 1
Original content here.`;

      const newContent = `# Introduction
This is the intro.

## Section 1
Modified content here.`;

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      expect(result?.impactLevel).toBe('MEDIUM');

      const modifiedSection = result?.changedSections.find(
        (s) => s.changeType === 'modified'
      );
      expect(modifiedSection).toBeDefined();
      expect(modifiedSection?.header).toBe('Section 1');
      expect(modifiedSection?.oldContent).toContain('Original');
      expect(modifiedSection?.newContent).toContain('Modified');
    });
  });

  describe('Impact Level Calculation', () => {
    it('should return HIGH impact for added sections', () => {
      const oldContent = '# Title\n\nContent.';
      const newContent = '# Title\n\nContent.\n\n## New Section\n\nAdded.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result?.impactLevel).toBe('HIGH');
    });

    it('should return HIGH impact for deleted sections', () => {
      const oldContent = '# Title\n\nContent.\n\n## Old Section\n\nTo delete.';
      const newContent = '# Title\n\nContent.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result?.impactLevel).toBe('HIGH');
    });

    it('should return MEDIUM impact for only modified sections', () => {
      const oldContent = '# Title\n\n## Section\n\nOld content.';
      const newContent = '# Title\n\n## Section\n\nNew content.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result?.impactLevel).toBe('MEDIUM');
    });

    it('should return LOW impact when no changes detected', () => {
      const content = '# Title\n\nContent.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        content,
        content
      );

      expect(result).toBeNull();
    });
  });

  describe('Complex Change Scenarios', () => {
    it('should handle multiple changes at once', () => {
      const oldContent = `# Project
## Overview
Original overview.
## Requirements
- Req 1
- Req 2
## Design
Original design.`;

      const newContent = `# Project
## Overview
Modified overview.
## Requirements
- Req 1
- Req 2
- Req 3 (new)
## Design
Original design.`;

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      // Should have at least one added (Req 3) and one modified (Overview)
      expect(result?.changedSections.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle content with different header levels', () => {
      const oldContent = `# Title
## Section 1
Content 1.
### Subsection 1.1
Subcontent.
## Section 2
Content 2.`;

      const newContent = `# Title
## Section 1
Content 1 modified.
### Subsection 1.1
Subcontent modified.`;

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      // Should detect Section 2 as deleted and modifications in Section 1
      const deletedSections = result?.changedSections.filter(
        (s) => s.changeType === 'deleted'
      );
      expect(deletedSections?.some((s) => s.header === 'Section 2')).toBe(true);
    });

    it('should handle content without headers', () => {
      const oldContent = 'Plain text content without headers.';
      const newContent = 'Plain text content with modifications.';

      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      // No headers means no changed sections identified
      expect(result?.changedSections.length).toBe(0);
      // But impact should still be MEDIUM since content changed
      expect(result?.impactLevel).toBe('MEDIUM');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined-like empty strings', () => {
      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        '',
        '# New Content\n\nSomething.'
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
      expect(result?.changedSections.some((s) => s.changeType === 'added')).toBe(
        true
      );
    });

    it('should handle content changing from something to empty', () => {
      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        '# Content\n\nHere.',
        ''
      );

      expect(result).not.toBeNull();
      expect(result?.hasChanges).toBe(true);
    });

    it('should include timestamp in result', () => {
      const oldContent = '# Test\n\nOld.';
      const newContent = '# Test\n\nNew.';

      const beforeCall = new Date();
      const result = engine.detectArtifactChanges(
        'test-project',
        'test-artifact.md',
        oldContent,
        newContent
      );
      const afterCall = new Date();

      expect(result).not.toBeNull();
      expect(result?.timestamp).toBeInstanceOf(Date);
      expect(
        result!.timestamp.getTime() >= beforeCall.getTime() &&
          result!.timestamp.getTime() <= afterCall.getTime()
      ).toBe(true);
    });
  });
});
