# Auto Remedy Validation Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a compact validation card that appears only in AUTO_REMEDY to re-run validation without reverting phases.

**Architecture:** Create a small `ValidationCompactCard` component that reuses existing validation handlers and status state. Render it conditionally in `src/app/project/[slug]/page.tsx` when `current_phase === 'AUTO_REMEDY'`, using existing `validationSummary` and `artifacts` to determine status/report availability.

**Tech Stack:** Next.js (React), TypeScript, Tailwind, shadcn/ui components, vitest + testing-library.

**Pre-req:** Per superpowers workflow, run this plan in a dedicated git worktree.

### Task 1: Add failing test for ValidationCompactCard

**Files:**
- Create: `src/components/orchestration/__tests__/ValidationCompactCard.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationCompactCard } from '../ValidationCompactCard';

const baseSummary = {
  totalChecks: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  pending: 0,
  overallStatus: 'pending' as const,
};

describe('ValidationCompactCard', () => {
  it('shows run button and hides report when no report exists', () => {
    render(
      <ValidationCompactCard
        summary={baseSummary}
        hasReport={false}
        isValidating={false}
        onRunValidation={vi.fn()}
        onDownloadReport={vi.fn()}
      />
    );

    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run validation/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /report/i })).toBeNull();
  });

  it('shows report button when report exists', () => {
    render(
      <ValidationCompactCard
        summary={baseSummary}
        hasReport
        isValidating={false}
        onRunValidation={vi.fn()}
        onDownloadReport={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /report/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/orchestration/__tests__/ValidationCompactCard.test.tsx`
Expected: FAIL with module not found for `ValidationCompactCard`.

### Task 2: Implement ValidationCompactCard

**Files:**
- Create: `src/components/orchestration/ValidationCompactCard.tsx`

**Step 1: Write the minimal implementation**

```tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, Shield } from 'lucide-react';
import type { ValidationSummary } from './ValidationResultsPanel';

interface ValidationCompactCardProps {
  summary: ValidationSummary;
  hasReport: boolean;
  isValidating: boolean;
  onRunValidation: () => void;
  onDownloadReport: () => void;
}

const statusBadgeClasses: Record<ValidationSummary['overallStatus'], string> = {
  pass: 'bg-emerald-500/20 text-emerald-600 border-0',
  fail: 'bg-red-500/20 text-red-600 border-0',
  warning: 'bg-amber-500/20 text-amber-600 border-0',
  pending: 'bg-muted text-muted-foreground border-0',
};

const statusLabel: Record<ValidationSummary['overallStatus'], string> = {
  pass: 'All Checks Passed',
  fail: 'Validation Failed',
  warning: 'Passed with Warnings',
  pending: 'Not Run',
};

export function ValidationCompactCard({
  summary,
  hasReport,
  isValidating,
  onRunValidation,
  onDownloadReport,
}: ValidationCompactCardProps) {
  const showReportBadge = summary.overallStatus === 'pending' && hasReport;
  const badgeText = showReportBadge ? 'Report available' : statusLabel[summary.overallStatus];
  const badgeClass = showReportBadge
    ? 'bg-primary/10 text-primary border-0'
    : statusBadgeClasses[summary.overallStatus];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Validation</CardTitle>
              <CardDescription>Run validation without reverting phases.</CardDescription>
            </div>
          </div>
          <Badge className={badgeClass}>{badgeText}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onRunValidation}
            disabled={isValidating}
            className="gap-2"
          >
            {isValidating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Validation
              </>
            )}
          </Button>
          {hasReport && (
            <Button variant="outline" onClick={onDownloadReport} className="gap-2">
              <Download className="h-4 w-4" />
              Report
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Run test to verify it passes**

Run: `npm test -- src/components/orchestration/__tests__/ValidationCompactCard.test.tsx`
Expected: PASS.

### Task 3: Render the compact card in AUTO_REMEDY only

**Files:**
- Modify: `src/app/project/[slug]/page.tsx`

**Step 1: Add the import**

```tsx
import { ValidationCompactCard } from '@/components/orchestration/ValidationCompactCard';
```

**Step 2: Add the card above the VALIDATE panel**

```tsx
const hasValidationReport = Boolean(
  artifacts['VALIDATE']?.some((artifact: Artifact) => artifact.name === 'validation-report.md')
);
```

```tsx
{project.current_phase === 'AUTO_REMEDY' && (
  <div className="mb-6">
    <ValidationCompactCard
      summary={validationSummary}
      hasReport={hasValidationReport}
      isValidating={isValidating}
      onRunValidation={handleRunValidation}
      onDownloadReport={handleDownloadValidationReport}
    />
  </div>
)}
```

**Step 3: Run the test suite for the new component**

Run: `npm test -- src/components/orchestration/__tests__/ValidationCompactCard.test.tsx`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/orchestration/ValidationCompactCard.tsx src/components/orchestration/__tests__/ValidationCompactCard.test.tsx src/app/project/[slug]/page.tsx
git commit -m "feat: add auto remedy validation card"
```
