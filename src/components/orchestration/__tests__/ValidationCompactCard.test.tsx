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
    expect(
      screen.getByRole('button', { name: /run validation/i })
    ).toBeInTheDocument();
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
