import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompositionPreviewCard } from '@/components/orchestration/CompositionPreviewCard';

const mockComposition = {
  base: { name: 'Next.js App Router', composition: { frontend: 'Next.js 14', backend: 'Next.js API' }, strengths: ['Type-safe', 'SSR'] },
  mobile: { name: 'No Mobile', composition: { mobile: 'None' }, strengths: [] },
  backend: { name: 'Integrated', composition: { backend: 'Integrated' }, strengths: ['Simplicity'] },
  data: { name: 'Neon Postgres', composition: { database: 'Neon Postgres', auth: 'Better Auth', storage: 'R2' }, strengths: ['Serverless', 'Type-safe'] },
  architecture: { name: 'Monolith', type: 'architecture', strengths: ['Simple deployment'] }
};

describe('CompositionPreviewCard', () => {
  it('displays all selected layers', () => {
    render(<CompositionPreviewCard composition={mockComposition as any} />);
    
    expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
    expect(screen.getByText('Neon Postgres')).toBeInTheDocument();
    expect(screen.getByText('Monolith')).toBeInTheDocument();
  });

  it('shows layer composition details', () => {
    render(<CompositionPreviewCard composition={mockComposition as any} />);
    
    // The composition renders as combined text
    expect(screen.getByText(/Next\.js 14/i)).toBeInTheDocument();
    expect(screen.getByText(/Neon Postgres.*Better Auth.*R2/i)).toBeInTheDocument();
  });

  it('displays strengths from composition', () => {
    render(<CompositionPreviewCard composition={mockComposition as any} />);
    
    expect(screen.getByText(/Strengths/i)).toBeInTheDocument();
  });
});
