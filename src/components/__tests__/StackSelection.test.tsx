import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StackSelection } from '@/components/orchestration/StackSelection';

const mockStacksResponse = {
  success: true,
  data: {
    mode: 'hybrid',
    templates: [
      {
        id: 'nextjs_shadcn_design',
        name: 'Next.js Design System (Web Landing)',
        description: 'Premium web landing pages with Next.js App Router, Tailwind CSS, shadcn/ui, and Framer Motion animations',
        composition: { frontend: 'Next.js', styling: 'Tailwind + shadcn/ui' },
        best_for: ['Landing pages', 'Marketing sites', 'Design showcases'],
        strengths: ['High-fidelity animations', 'Premium typography', 'Type-safe components'],
        tradeoffs: [],
        scaling: ''
      },
      {
        id: 'nextjs_convex_saas',
        name: 'Next.js + Convex SaaS (Web App)',
        description: 'Production-ready full-stack SaaS with Next.js App Router, Convex real-time backend',
        composition: { frontend: 'Next.js', backend: 'Convex', database: 'Convex' },
        best_for: ['SaaS applications', 'Real-time dashboards', 'AI-integrated apps'],
        strengths: ['Type-safe end-to-end', 'Realtime by default', 'Fastest iteration'],
        tradeoffs: [],
        scaling: ''
      }
    ],
    technical_preferences: {}
  }
};

describe('StackSelection Component', () => {
  const mockOnStackSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/stacks') {
          return {
            ok: true,
            json: async () => mockStacksResponse,
          } as Response;
        }
        throw new Error(`Unhandled fetch in test: ${url}`);
      })
    );
  });

  it('renders templates after loading', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    expect(screen.getByText(/Loading stack templates/i)).toBeInTheDocument();

    // Templates are hidden in compose mode by default, click "Browse All Templates"
    await user.click(screen.getByRole('button', { name: 'Browse All Templates' }));
    expect(await screen.findByText('Next.js Design System (Web Landing)')).toBeInTheDocument();
    expect(screen.getByText('Next.js + Convex SaaS (Web App)')).toBeInTheDocument();
  });

  it('requires confirmation before calling onStackSelect', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    // Templates are hidden in compose mode by default
    await user.click(screen.getByRole('button', { name: 'Browse All Templates' }));
    await screen.findByText('Next.js Design System (Web Landing)');

    await user.click(screen.getByText('Next.js Design System (Web Landing)'));
    expect(screen.getByText(/Confirm Your Selection/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm Stack Choice' }));
    expect(mockOnStackSelect).toHaveBeenCalledWith('nextjs_shadcn_design', '', {});
  });

  it('includes reasoning when confirming a stack choice', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await user.click(screen.getByRole('button', { name: 'Browse All Templates' }));
    await screen.findByText('Next.js Design System (Web Landing)');
    await user.click(screen.getByText('Next.js Design System (Web Landing)'));

    const textarea = screen.getByPlaceholderText(/We need fast iteration/i);
    await user.type(textarea, 'Fast iteration needed');
    await user.click(screen.getByRole('button', { name: 'Confirm Stack Choice' }));

    expect(mockOnStackSelect).toHaveBeenCalledWith('nextjs_shadcn_design', 'Fast iteration needed', {});
  });

  it('supports custom stack entry', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await user.click(screen.getByRole('button', { name: 'Browse All Templates' }));
    await screen.findByText('Next.js Design System (Web Landing)');

    await user.click(screen.getByRole('button', { name: 'Define Custom Stack' }));
    const input = screen.getByPlaceholderText(/Describe your custom stack/i);
    await user.type(input, 'SvelteKit + Go + Turso');
    await user.click(screen.getByRole('button', { name: 'Use Custom Stack' }));

    expect(mockOnStackSelect).toHaveBeenCalledWith('custom', '', {});
  });

  it('shows approved notice when selectedStack is provided', async () => {
    render(<StackSelection onStackSelect={mockOnStackSelect} selectedStack="nextjs_shadcn_design" />);

    expect(await screen.findByText(/Stack Approved: Next\.js Design System/i)).toBeInTheDocument();
  });

  it('disables confirm button and shows Confirming... when isLoading is true', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} isLoading />);

    await user.click(screen.getByRole('button', { name: 'Browse All Templates' }));
    await screen.findByText('Next.js Design System (Web Landing)');
    await user.click(screen.getByText('Next.js Design System (Web Landing)'));

    const confirmButton = screen.getByRole('button', { name: 'Confirming...' });
    expect(confirmButton).toBeDisabled();
  });

  it('renders stack details sections (Best For / Strengths) for templates', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await user.click(screen.getByRole('button', { name: 'Browse All Templates' }));
    await screen.findByText('Next.js Design System (Web Landing)');
    expect(screen.getAllByText('Best For').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Strengths').length).toBeGreaterThan(0);
  });

  it('shows Compose Custom tab when composition_system is available', async () => {
    const mockWithComposition = {
      ...mockStacksResponse,
      data: {
        ...mockStacksResponse.data,
        composition_system: {
          version: '2.0',
          base_layers: { nextjs_app_router: { name: 'Next.js' } },
          mobile_addons: { expo_integration: { name: 'Expo' } },
          backend_addons: { convex: { name: 'Convex' } },
          data_addons: { convex: { name: 'Convex' } },
          architecture_addons: { monolith: { name: 'Monolith' } }
        }
      }
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/stacks') {
          return {
            ok: true,
            json: async () => mockWithComposition,
          } as Response;
        }
        throw new Error(`Unhandled fetch in test: ${url}`);
      })
    );

    render(<StackSelection onStackSelect={mockOnStackSelect} />);
    
    expect(await screen.findByRole('button', { name: 'Compose Custom' })).toBeInTheDocument();
  });
});
