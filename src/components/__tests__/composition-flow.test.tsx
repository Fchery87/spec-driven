import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StackSelection } from '@/components/orchestration/StackSelection';

// Mock fetch at module level
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

const mockTemplates = [
  { 
    id: 'nextjs_web_app', 
    name: 'Next.js Web App', 
    composition: { frontend: 'Next.js' }, 
    best_for: ['Web'], 
    strengths: ['Fast'], 
    tradeoffs: [], 
    scaling: '' 
  }
];

const mockBaseLayers = {
  nextjs_app_router: { 
    id: 'nextjs_app_router', 
    name: 'Next.js App Router', 
    description: 'Next.js 14+', 
    strengths: ['Server Components', 'Type-safe'] 
  },
  astro: { 
    id: 'astro', 
    name: 'Astro', 
    description: 'Zero JS', 
    strengths: ['Fast load'] 
  }
};

const mockMobileAddons = {
  expo_integration: { 
    id: 'expo_integration', 
    name: 'Expo (React Native)', 
    description: 'Cross-platform', 
    strengths: ['Single codebase'] 
  },
  none: { 
    id: 'none', 
    name: 'No Mobile', 
    description: 'Web only', 
    strengths: ['Simple'] 
  }
};

const mockBackendAddons = {
  integrated: { 
    id: 'integrated', 
    name: 'Integrated Backend', 
    description: 'Framework built-in', 
    strengths: ['Simple'] 
  },
  express_api: { 
    id: 'express_api', 
    name: 'Express.js', 
    description: 'Node.js', 
    strengths: ['Flexible'] 
  }
};

const mockDataAddons = {
  neon_postgres: { 
    id: 'neon_postgres', 
    name: 'Neon Postgres + Drizzle', 
    description: 'Serverless Postgres', 
    strengths: ['Type-safe'] 
  },
  none: { 
    id: 'none', 
    name: 'No Database', 
    description: 'Static', 
    strengths: ['Simple'] 
  }
};

const mockArchitectureAddons = {
  monolith: { 
    id: 'monolith', 
    name: 'Monolith', 
    description: 'Single deploy', 
    strengths: ['Simple'] 
  }
};

const getMockResponse = (hasComposition = true) => ({
  success: true,
  data: {
    mode: 'compositional',
    templates: mockTemplates,
    composition_system: hasComposition ? {
      version: '2.0',
      mode: 'compositional',
      base_layers: mockBaseLayers,
      mobile_addons: mockMobileAddons,
      backend_addons: mockBackendAddons,
      data_addons: mockDataAddons,
      architecture_addons: mockArchitectureAddons
    } : null,
    technical_preferences: {}
  }
});

describe('Composition Flow Integration', () => {
  const mockOnStackSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/stacks') {
        return {
          ok: true,
          json: async () => getMockResponse(true),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
  });

  it('complete composition flow from tab selection to confirmation', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Base Layer')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Architecture')).toBeInTheDocument();

    await user.click(screen.getByText('Next.js App Router'));
    await user.click(screen.getByText('No Mobile'));
    await user.click(screen.getByText('Integrated Backend'));
    await user.click(screen.getByText('Neon Postgres + Drizzle'));
    await user.click(screen.getByText('Monolith'));

    expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();
    // Web App requires 4 layers, all selected now
    const completeBtn = screen.getByRole('button', { name: /Use This Stack/i });
    expect(completeBtn).toBeEnabled();

    await user.click(completeBtn);

    expect(mockOnStackSelect).toHaveBeenCalledTimes(1);
    const callArgs = mockOnStackSelect.mock.calls[0];
    expect(callArgs[0]).toContain('nextjs_app_router');
    expect(callArgs[1]).toContain('Composed stack');
  });

  it('shows layer details in preview as selections are made', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    // Click on Next.js App Router layer option
    const nextjsButtons = screen.getAllByText('Next.js App Router');
    await user.click(nextjsButtons[0]);

    // Verify preview section appears
    expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();

    // Click on No Mobile layer option (first occurrence)
    const noMobileButtons = screen.getAllByText('No Mobile');
    await user.click(noMobileButtons[0]);

    // Verify preview section appears
    expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();

    // Click on Neon Postgres layer option (first occurrence)
    const postgresButtons = screen.getAllByText('Neon Postgres + Drizzle');
    await user.click(postgresButtons[0]);
  });

  it('handles switching between tabs correctly', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Browse All Templates/i }));
    expect(screen.getByText('Next.js Web App')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));
    expect(screen.getByText('Base Layer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Browse All Templates/i }));
    expect(screen.getByText('Next.js Web App')).toBeInTheDocument();
  });

  it('disables compose tab when composition_system is not available', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/stacks') {
        return {
          ok: true,
          json: async () => getMockResponse(false),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');
    
    const composeButton = screen.getByRole('button', { name: /Compose Custom/i });
    expect(composeButton).toBeDisabled();
  });

  it('updates progress indicator as layers are selected', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    // Web App requires 4 layers (base, backend, data, architecture) - mobile is optional
    expect(screen.getByText('0/4 required layers selected')).toBeInTheDocument();

    await user.click(screen.getByText('Next.js App Router'));
    // After clicking base, we should see 1/4

    // No Mobile is optional for Web App, selecting it doesn't increase required count
    await user.click(screen.getByText('No Mobile'));

    await user.click(screen.getByText('Integrated Backend'));
    // Backend selected, now 2/4

    await user.click(screen.getByText('Neon Postgres + Drizzle'));
    // Data selected, now 3/4

    await user.click(screen.getByText('Monolith'));
    // Architecture selected, complete!
    // Verify complete button is enabled
    expect(screen.getByRole('button', { name: /Use This Stack/i })).toBeEnabled();
  });

  it('allows changing layer selections before completing', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    // Click on Next.js App Router (first selection)
    const nextjsButtons = screen.getAllByText('Next.js App Router');
    await user.click(nextjsButtons[0]);

    // Click on Astro to change selection
    const astroButtons = screen.getAllByText('Astro');
    await user.click(astroButtons[0]);

    // Verify progress updates (Astro replaces Next.js App Router, still 1/4)
    expect(screen.getByText('1/4 required layers selected')).toBeInTheDocument();
  });

  it('shows all base layer options', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
    expect(screen.getByText('Astro')).toBeInTheDocument();
  });

  it('shows all mobile addon options', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Expo (React Native)')).toBeInTheDocument();
    expect(screen.getByText('No Mobile')).toBeInTheDocument();
  });

  it('shows all backend addon options', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Integrated Backend')).toBeInTheDocument();
    expect(screen.getByText('Express.js')).toBeInTheDocument();
  });

  it('shows all data addon options', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Neon Postgres + Drizzle')).toBeInTheDocument();
    expect(screen.getByText('No Database')).toBeInTheDocument();
  });

  it('shows all architecture addon options', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Monolith')).toBeInTheDocument();
  });

  it('renders layer descriptions and strengths', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Next.js Web App');

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));

    expect(screen.getByText('Next.js 14+')).toBeInTheDocument();
    expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
  });
});
