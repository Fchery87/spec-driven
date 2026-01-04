import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompositionBuilder } from '@/components/orchestration/CompositionBuilder';

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
    neon_postgres: { name: 'Neon Postgres' },
    turso: { name: 'Turso' }
  },
  architecture_addons: {
    monolith: { name: 'Monolith' },
    edge: { name: 'Edge' }
  }
};

describe('CompositionBuilder', () => {
  const mockOnComplete = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 5 layer cards in a grid', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    
    expect(screen.getByText('Base Layer')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Architecture')).toBeInTheDocument();
  });

  it('allows selecting layers', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    
    await user.click(screen.getByText('Next.js App Router'));
    // Check that the layer is selected in the Base Layer card
    const baseCard = screen.getByText('Base Layer').closest('.border') as HTMLElement;
    expect(baseCard.querySelector('.text-primary')).toHaveTextContent('Next.js App Router');
  });

  it('shows preview card when selections are made', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    
    await user.click(screen.getByText('Next.js App Router'));
    expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();
  });

  it('calls onComplete when all layers selected', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    
    await user.click(screen.getByText('Next.js App Router'));
    await user.click(screen.getByText('No Mobile'));
    await user.click(screen.getByText('Integrated'));
    await user.click(screen.getByText('Neon Postgres'));
    await user.click(screen.getByText('Monolith'));
    
    expect(screen.getByRole('button', { name: /Use This Stack/i })).toBeEnabled();
  });
});
