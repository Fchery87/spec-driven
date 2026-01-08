import { describe, it, expect } from 'vitest';
import { parseValidationReport } from './validation_report_parser';

describe('parseValidationReport', () => {
  it('parses overall status and errors from current VALIDATE markdown', () => {
    const content =
      '---\n' +
      'title: Validation Report\n' +
      'owner: validator\n' +
      'version: 1.0\n' +
      'date: 2026-01-07\n' +
      'status: draft\n' +
      '---\n\n' +
      '# Validation Report\n\n' +
      '## Overall Status: FAIL\n\n' +
      '## Validators Run\n' +
      '- cross_artifact_consistency\n\n' +
      '## Checks\n' +
      '```json\n{}\n```\n\n' +
      '## Errors\n' +
      '- Missing required artifact: tasks.md\n' +
      '- REQ-CORE-001 missing mapping in tasks.md\n\n' +
      '## Warnings\n' +
      '- None\n';

    const parsed = parseValidationReport(content);

    expect(parsed.status).toBe('fail');
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0]).toContain('Missing required artifact');
    expect(parsed.errors[1]).toContain('REQ-CORE-001');
  });

  it('treats "- None" as no errors', () => {
    const content =
      '# Validation Report\n\n' +
      '## Overall Status: FAIL\n\n' +
      '## Errors\n' +
      '- None\n';

    const parsed = parseValidationReport(content);

    expect(parsed.errors).toEqual([]);
  });
});
