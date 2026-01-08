# AUTO_REMEDY Validation Parse Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AUTO_REMEDY correctly parse VALIDATE failures and align report naming so remediation runs when VALIDATE fails.

**Architecture:** Extract validation-report parsing into a dedicated utility, add tests for current report format, then update AUTO_REMEDY to use the parser and unify report artifact naming.

**Tech Stack:** TypeScript, Vitest, Node.js, Next.js backend services

### Task 1: Add failing tests for validation-report parsing

**Files:**
- Create: `backend/services/orchestrator/validation_report_parser.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseValidationReport } from './validation_report_parser';

describe('parseValidationReport', () => {
  it('parses overall status and errors from current VALIDATE markdown', () => {
    const content = `---\n` +
      `title: Validation Report\n` +
      `owner: validator\n` +
      `version: 1.0\n` +
      `date: 2026-01-07\n` +
      `status: draft\n` +
      `---\n\n` +
      `# Validation Report\n\n` +
      `## Overall Status: FAIL\n\n` +
      `## Validators Run\n` +
      `- cross_artifact_consistency\n\n` +
      `## Checks\n` +
      '```json\n{}\n```\n\n' +
      `## Errors\n` +
      `- Missing required artifact: tasks.md\n` +
      `- REQ-CORE-001 missing mapping in tasks.md\n\n` +
      `## Warnings\n` +
      `- None\n`;

    const parsed = parseValidationReport(content);

    expect(parsed.status).toBe('fail');
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0]).toContain('Missing required artifact');
    expect(parsed.errors[1]).toContain('REQ-CORE-001');
  });

  it('treats "- None" as no errors', () => {
    const content = `# Validation Report\n\n## Overall Status: FAIL\n\n## Errors\n- None\n`;

    const parsed = parseValidationReport(content);

    expect(parsed.errors).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/services/orchestrator/validation_report_parser.test.ts`
Expected: FAIL (module missing or parser returns incorrect status/errors)

### Task 2: Implement parser and wire AUTO_REMEDY to it

**Files:**
- Create: `backend/services/orchestrator/validation_report_parser.ts`
- Modify: `backend/services/orchestrator/orchestrator_engine.ts`

**Step 1: Write minimal implementation**

```typescript
export type ValidationParseResult = {
  status: 'pass' | 'warn' | 'fail';
  errors: string[];
};

export function parseValidationReport(content: string): ValidationParseResult {
  if (!content) {
    return { status: 'pass', errors: [] };
  }

  const statusMatch =
    content.match(/overall_status:\s*(pass|warn|fail)/i) ||
    content.match(/(?:^|\n)##?\s*Overall Status:\s*(pass|warn|fail)/i) ||
    content.match(/overall status:\s*(pass|warn|fail)/i);
  const status = (statusMatch?.[1]?.toLowerCase() || 'pass') as
    | 'pass'
    | 'warn'
    | 'fail';

  const errors: string[] = [];

  // Legacy table format support
  const failRegex =
    /\|\s*(REQ-[A-Z]+-\d+|[A-Za-z-]+)\s*\|\s*fail\s*\|\s*([^|]+)\|/gi;
  let match;
  while ((match = failRegex.exec(content)) !== null) {
    const itemId = match[1].trim();
    const message = match[2].trim();
    errors.push(`${itemId}: ${message}`);
  }

  // Current VALIDATE format: "## Errors" section with bullet list
  const errorsSectionMatch = content.match(
    /##\s*Errors\s*\n([\s\S]*?)(?=\n##\s*|$)/i
  );
  if (errorsSectionMatch?.[1]) {
    const lines = errorsSectionMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.replace(/^\-\s+/, ''))
      .filter((line) => !/^none$/i.test(line));

    errors.push(...lines);
  }

  // Section markers with ❌
  const failedSectionRegex =
    /####\s*❌\s*([^\n]+)\n[\s\S]*?(?=####|\n## |$)/g;
  while ((match = failedSectionRegex.exec(content)) !== null) {
    const sectionName = match[1].trim();
    if (!errors.some((e) => e.includes(sectionName))) {
      errors.push(`Section failed: ${sectionName}`);
    }
  }

  return { status, errors };
}
```

**Step 2: Update AUTO_REMEDY to use parser**

Replace the inline `parseValidationReport` in `backend/services/orchestrator/orchestrator_engine.ts` with an import and call to `parseValidationReport`.

**Step 3: Run test to verify it passes**

Run: `npm test -- backend/services/orchestrator/validation_report_parser.test.ts`
Expected: PASS

### Task 3: Align AUTO_REMEDY report naming to remediation-report.md

**Files:**
- Modify: `backend/services/orchestrator/validators.ts`
- Modify: `backend/services/orchestrator/artifact_manager.ts`
- Modify: `backend/services/orchestrator/orchestrator_engine.ts`
- Modify: `src/app/project/[slug]/page.tsx`

**Step 1: Update AUTO_REMEDY output references**

Change `auto-remedy-report.md` to `remediation-report.md` in the files above.

**Step 2: (Optional) Update docs if needed**

Update `docs/USAGE_GUIDE.md` if it should reflect the new report filename.

**Step 3: Sanity check**

Run: `npm test -- backend/services/orchestrator/validation_report_parser.test.ts`
Expected: PASS

