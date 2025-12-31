import crypto from 'crypto';

/**
 * AUTO_REMEDY Safeguard System
 *
 * 4-layer protection system to prevent AUTO_REMEDY from overwriting user edits
 * or making unsafe changes to spec artifacts.
 *
 * Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 288-328
 */

export interface SafeguardResult {
  approved: boolean;
  reason: string;
  userEditDetected?: boolean;
  linesChanged?: number;
  diff?: string;
}

/**
 * Protected artifacts that AUTO_REMEDY cannot modify
 */
const PROTECTED_ARTIFACTS = [
  'constitution.md',
  'project-brief.md',
];

/**
 * Maximum number of lines AUTO_REMEDY can change in a single operation
 */
const MAX_LINES_CHANGED = 50;

/**
 * Layer 1: User Edit Detection via Hash Comparison
 *
 * Compares current content hash with stored original hash to detect manual edits.
 *
 * @param originalContent - Content when artifact was first generated
 * @param currentContent - Current content from filesystem
 * @param originalHash - Stored SHA-256 hash of original content
 * @returns Detection result with edit status and reason
 *
 * @example
 * detectUserEdit(
 *   'Original PRD content',
 *   'User modified PRD content',
 *   'abc123...'
 * )
 * // => { userEditDetected: true, reason: '...' }
 */
export function detectUserEdit(
  originalContent: string,
  currentContent: string,
  originalHash: string
): SafeguardResult {
  const currentHash = hashContent(currentContent);

  if (currentHash === originalHash) {
    return {
      approved: true,
      userEditDetected: false,
      reason: 'Content matches original hash - no manual edits detected',
    };
  }

  // Hash differs - user made edits
  return {
    approved: false,
    userEditDetected: true,
    reason: 'Content hash differs - manual edit detected. Use conflict markers.',
  };
}

/**
 * Layer 2: Diff Preview Generation
 *
 * Generates unified diff format showing proposed changes for user review.
 *
 * @param oldContent - Current content
 * @param newContent - Proposed AUTO_REMEDY content
 * @param artifactId - Artifact filename
 * @returns Unified diff string
 *
 * @example
 * generateDiffPreview('old', 'new', 'PRD.md')
 * // => "--- PRD.md (original)\n+++ PRD.md (proposed)\n-old\n+new"
 */
export function generateDiffPreview(
  oldContent: string,
  newContent: string,
  artifactId: string
): string {
  if (oldContent === newContent) {
    return `No changes proposed for ${artifactId}`;
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  let diff = `--- ${artifactId} (original)\n`;
  diff += `+++ ${artifactId} (proposed)\n`;
  diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;

  // Simple line-by-line diff (simplified unified diff format)
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      diff += `  ${oldLine || ''}\n`;
    } else {
      if (oldLine !== undefined) {
        diff += `- ${oldLine}\n`;
      }
      if (newLine !== undefined) {
        diff += `+ ${newLine}\n`;
      }
    }
  }

  return diff;
}

/**
 * Layer 3: Git-Style Conflict Markers
 *
 * Creates conflict markers when user edits detected, allowing manual resolution.
 *
 * @param artifactId - Artifact filename
 * @param userVersion - User's edited content
 * @param autoRemedyVersion - AUTO_REMEDY's proposed content
 * @param lineNumber - Line number where conflict occurs
 * @returns Content with conflict markers
 *
 * @example
 * createConflictMarkers('PRD.md', 'User version', 'AUTO version', 42)
 * // => "<<<<<<< HEAD (User Edit)\nUser version\n=======\nAUTO version\n>>>>>>> AUTO_REMEDY (Line 42)"
 */
export function createConflictMarkers(
  artifactId: string,
  userVersion: string,
  autoRemedyVersion: string,
  lineNumber: number
): string {
  return `<<<<<<< HEAD (User Edit)
${userVersion}
=======
${autoRemedyVersion}
>>>>>>> AUTO_REMEDY (Line ${lineNumber} in ${artifactId})`;
}

/**
 * Layer 4: Scope Limit Validation
 *
 * Enforces maximum change size and protects critical artifacts.
 *
 * @param oldContent - Current content
 * @param newContent - Proposed content
 * @param artifactId - Artifact filename
 * @returns Validation result with approval status
 *
 * @example
 * validateChangeScope('old content', 'new content', 'PRD.md')
 * // => { approved: true, reason: '...', linesChanged: 2 }
 */
export function validateChangeScope(
  oldContent: string,
  newContent: string,
  artifactId: string
): SafeguardResult {
  // Check if artifact is protected
  if (isProtectedArtifact(artifactId)) {
    return {
      approved: false,
      reason: `${artifactId} is a protected artifact - manual review required`,
    };
  }

  // Calculate lines changed
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const linesChanged = Math.abs(newLines.length - oldLines.length) +
    oldLines.filter((line, i) => line !== newLines[i]).length;

  // Check line limit
  if (linesChanged > MAX_LINES_CHANGED) {
    return {
      approved: false,
      linesChanged,
      reason: `Change scope (${linesChanged} lines) exceeds 50 line limit - manual review required`,
    };
  }

  return {
    approved: true,
    linesChanged,
    reason: `Change scope within limits (${linesChanged} lines)`,
  };
}

/**
 * Check if an artifact is protected from AUTO_REMEDY changes
 *
 * @param artifactId - Artifact filename
 * @returns True if protected, false otherwise
 */
export function isProtectedArtifact(artifactId: string): boolean {
  return PROTECTED_ARTIFACTS.includes(artifactId);
}

/**
 * Generate SHA-256 hash of content for change detection
 *
 * @param content - Content to hash
 * @returns Hex-encoded SHA-256 hash
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Export hash function for use in artifact versioning
 */
export { hashContent };
