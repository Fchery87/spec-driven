export type ValidationParseResult = {
  status: 'pass' | 'warn' | 'fail';
  errors: string[];
};

export function parseValidationReport(
  content: string
): ValidationParseResult {
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

  const failRegex =
    /\|\s*(REQ-[A-Z]+-\d+|[A-Za-z-]+)\s*\|\s*fail\s*\|\s*([^|]+)\|/gi;
  let match;
  while ((match = failRegex.exec(content)) !== null) {
    const itemId = match[1].trim();
    const message = match[2].trim();
    errors.push(`${itemId}: ${message}`);
  }

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
