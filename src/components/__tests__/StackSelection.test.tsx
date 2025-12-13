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
        id: 'nextjs_drizzle',
        name: 'Next.js + Drizzle',
        description: 'Modern full-stack TypeScript',
        composition: { frontend: 'Next.js', backend: 'Next.js', database: 'PostgreSQL' },
        best_for: ['MVP'],
        strengths: ['Type safety'],
        tradeoffs: [],
        scaling: ''
      },
      {
        id: 'expo_supabase',
        name: 'Expo + Supabase',
        description: 'Mobile-first with managed backend',
        composition: { mobile: 'Expo', backend: 'Supabase', database: 'PostgreSQL' },
        best_for: ['Mobile'],
        strengths: ['Fast setup'],
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
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    expect(screen.getByText(/Loading stack templates/i)).toBeInTheDocument();

    expect(await screen.findByText('Next.js + Drizzle')).toBeInTheDocument();
    expect(screen.getByText('Expo + Supabase')).toBeInTheDocument();
  });

  it('requires confirmation before calling onStackSelect', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js + Drizzle');

    await user.click(screen.getByText('Next.js + Drizzle'));
    expect(screen.getByText(/Confirm Your Selection/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirm Stack Choice/i }));
    expect(mockOnStackSelect).toHaveBeenCalledWith('nextjs_drizzle', '', {});
  });

  it('includes reasoning when confirming a stack choice', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js + Drizzle');
    await user.click(screen.getByText('Next.js + Drizzle'));

    const textarea = screen.getByPlaceholderText(/We need fast iteration/i);
    await user.type(textarea, 'Fast iteration needed');
    await user.click(screen.getByRole('button', { name: /Confirm Stack Choice/i }));

    expect(mockOnStackSelect).toHaveBeenCalledWith('nextjs_drizzle', 'Fast iteration needed', {});
  });

  it('supports custom stack entry', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js + Drizzle');

    await user.click(screen.getByRole('button', { name: /Define Custom Stack/i }));
    const input = screen.getByPlaceholderText(/Describe your custom stack/i);
    await user.type(input, 'SvelteKit + Go + Turso');
    await user.click(screen.getByRole('button', { name: /Use Custom Stack/i }));

    expect(mockOnStackSelect).toHaveBeenCalledWith('custom', '', {});
  });

  it('shows approved notice when selectedStack is provided', async () => {
    render(<StackSelection onStackSelect={mockOnStackSelect} selectedStack="nextjs_drizzle" />);

    expect(await screen.findByText(/Stack Approved: Next\.js \+ Drizzle/i)).toBeInTheDocument();
  });

  it('disables confirm button and shows Confirming... when isLoading is true', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} isLoading />);

    await screen.findByText('Next.js + Drizzle');
    await user.click(screen.getByText('Next.js + Drizzle'));

    const confirmButton = screen.getByRole('button', { name: /Confirming\.\.\./i });
    expect(confirmButton).toBeDisabled();
  });

  it('renders stack details sections (Best For / Strengths) for templates', async () => {
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js + Drizzle');
    expect(screen.getAllByText('Best For').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Strengths').length).toBeGreaterThan(0);
  });
});
