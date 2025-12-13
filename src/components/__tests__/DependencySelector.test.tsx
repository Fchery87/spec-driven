import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DependencySelector } from '@/components/orchestration/DependencySelector';

describe('DependencySelector Component', () => {
  const mockOnApprove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders architecture selection buttons', () => {
    render(<DependencySelector onApprove={mockOnApprove} />);

    expect(screen.getByRole('button', { name: /Web Application/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mobile Application/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /API-First Platform/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Custom Stack/i })).toBeInTheDocument();
  });

  it('shows web dependency options by default', () => {
    render(<DependencySelector onApprove={mockOnApprove} />);
    expect(screen.getByText(/Next\.js \+ Drizzle \(Recommended\)/i)).toBeInTheDocument();
  });

  it('allows selecting a preset option and approving', async () => {
    const user = userEvent.setup();
    render(<DependencySelector onApprove={mockOnApprove} />);

    // Select a preset card
    await user.click(screen.getByText(/Next\.js \+ Drizzle \(Recommended\)/i));

    await user.click(screen.getByRole('button', { name: /Approve Dependencies/i }));

    expect(mockOnApprove).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'preset',
        architecture: 'web_application',
        notes: ''
      })
    );
    expect(mockOnApprove).toHaveBeenCalledWith(
      expect.objectContaining({
        option: expect.objectContaining({ id: 'web_nextjs_drizzle' })
      })
    );
  });

  it('switching architecture resets selection (approve remains disabled until reselected)', async () => {
    const user = userEvent.setup();
    render(<DependencySelector onApprove={mockOnApprove} />);

    await user.click(screen.getByText(/Next\.js \+ Drizzle \(Recommended\)/i));
    expect(screen.getByRole('button', { name: /Approve Dependencies/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Mobile Application/i }));
    expect(screen.getByText(/Expo \+ Supabase \(Recommended\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve Dependencies/i })).toBeDisabled();
  });

  it('supports custom stack approval when required fields are provided', async () => {
    const user = userEvent.setup();
    render(<DependencySelector onApprove={mockOnApprove} />);

    await user.click(screen.getByRole('button', { name: /Custom Stack/i }));

    await user.type(screen.getByPlaceholderText(/Next\.js 14, React, Vue 3/i), 'SvelteKit');
    await user.type(screen.getByPlaceholderText(/FastAPI, Express, Go Fiber/i), 'Go (chi)');
    await user.type(screen.getByPlaceholderText(/PostgreSQL, MongoDB, Supabase/i), 'PostgreSQL');
    await user.type(screen.getByPlaceholderText(/Vercel, AWS, Fly\.io/i), 'Fly.io');
    await user.type(screen.getByPlaceholderText(/List package names with versions/i), 'zod, drizzle-orm\nreact');
    await user.type(screen.getByPlaceholderText(/Security exceptions, licensing requirements, hosting preferences/i), 'Prefer OSS-only');

    await user.click(screen.getByRole('button', { name: /Approve Dependencies/i }));

    expect(mockOnApprove).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'custom',
        architecture: 'custom',
        notes: expect.any(String),
        customStack: expect.objectContaining({
          frontend: 'SvelteKit',
          backend: 'Go (chi)',
          database: 'PostgreSQL',
          deployment: 'Fly.io',
          dependencies: expect.arrayContaining(['zod', 'drizzle-orm', 'react'])
        })
      })
    );
  });

  it('disables approval when custom stack required fields are missing', async () => {
    const user = userEvent.setup();
    render(<DependencySelector onApprove={mockOnApprove} />);

    await user.click(screen.getByRole('button', { name: /Custom Stack/i }));
    expect(screen.getByRole('button', { name: /Approve Dependencies/i })).toBeDisabled();
  });
});
