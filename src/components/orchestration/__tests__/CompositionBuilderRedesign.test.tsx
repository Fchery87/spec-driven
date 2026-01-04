import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompositionBuilder } from '@/components/orchestration/CompositionBuilder';
import { ProjectType } from '@/types/composition';

const mockCompositionSystem = {
  version: '2.0',
  base_layers: {
    nextjs_app_router: { name: 'Next.js App Router' },
    astro: { name: 'Astro' }
  },
  mobile_addons: {
    none: { name: 'No Mobile' },
    expo_integration: { name: 'Expo' }
  },
  backend_addons: {
    integrated: { name: 'Integrated' },
    fastapi_api: { name: 'FastAPI' }
  },
  data_addons: {
    neon_postgres: { name: 'Neon Postgres' }
  },
  architecture_addons: {
    monolith: { name: 'Monolith' }
  }
};

describe('CompositionBuilder Redesign', () => {
  const mockOnComplete = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ProjectTypeSelector at top', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Both Web + Mobile')).toBeInTheDocument();
    expect(screen.getByText('API Only')).toBeInTheDocument();
  });

  it('shows Full-Stack card as 6th option', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Full-Stack Framework')).toBeInTheDocument();
  });

  it('shows progress indicator with dynamic count', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    // Initially shows 0/4 since no selections made
    expect(screen.getByText('0/4 required layers selected')).toBeInTheDocument();
  });

  it('auto-fills Base + Backend when Full-Stack selected', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    // Select Full-Stack Framework card
    const fullStackCard = screen.getByText('Full-Stack Framework').closest('div.bg-card');
    await user.click(fullStackCard!);
    // Select Next.js (Full-Stack) - this auto-fills base + backend
    await user.click(screen.getByText('Next.js (Full-Stack)'));
    // Progress should now show 2/4 (base and backend are set)
    expect(screen.getByText('2/4 required layers selected')).toBeInTheDocument();
  });

  it('updates progress when project type changes', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    // Initially shows 0/4 for Web App
    expect(screen.getByText('0/4 required layers selected')).toBeInTheDocument();
    // Click on API Only in the project type selector
    const apiOnlyButton = screen.getAllByRole('radio').find(btn => btn.textContent?.includes('API Only'));
    await user.click(apiOnlyButton!);
    expect(screen.getByText('0/3 required layers selected')).toBeInTheDocument();
  });
});
