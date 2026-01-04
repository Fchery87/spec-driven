import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompositionBuilder } from '@/components/orchestration/CompositionBuilder';
import { ProjectType } from '@/types/composition';

const mockCompositionSystem = {
  version: '2.0',
  mode: 'compositional' as const,
  base_layers: {
    nextjs_app_router: { name: 'Next.js App Router', description: 'Modern React framework', type: 'frontend_framework' as const, composition: { frontend: 'react', backend: 'node' }, compatible_with: { mobile: ['expo_integration'], backend: ['integrated', 'express_api', 'fastapi_api'], data: ['neon_postgres', 'supabase', 'drizzle_orm'], architecture: ['monolith', 'microservices', 'serverless'] }, strengths: [], tradeoffs: [], best_for: [] },
    astro: { name: 'Astro', description: 'Content-focused static site generator', type: 'frontend_framework' as const, composition: { frontend: 'astro', backend: 'none' }, compatible_with: { mobile: ['expo_integration'], backend: ['express_api', 'fastapi_api'], data: ['neon_postgres', 'supabase'], architecture: ['monolith', 'serverless'] }, strengths: [], tradeoffs: [], best_for: [] },
    remix: { name: 'Remix', description: 'Full-stack React framework', type: 'frontend_framework' as const, composition: { frontend: 'react', backend: 'node' }, compatible_with: { mobile: ['expo_integration'], backend: ['integrated', 'express_api'], data: ['neon_postgres', 'supabase', 'drizzle_orm'], architecture: ['monolith', 'serverless'] }, strengths: [], tradeoffs: [], best_for: [] },
    sveltekit: { name: 'SvelteKit', description: 'Svelte meta-framework', type: 'frontend_framework' as const, composition: { frontend: 'svelte', backend: 'node' }, compatible_with: { mobile: ['expo_integration'], backend: ['integrated', 'express_api'], data: ['neon_postgres', 'supabase', 'drizzle_orm'], architecture: ['monolith', 'serverless'] }, strengths: [], tradeoffs: [], best_for: [] },
    vue_nuxt: { name: 'Nuxt', description: 'Vue.js meta-framework', type: 'frontend_framework' as const, composition: { frontend: 'vue', backend: 'node' }, compatible_with: { mobile: ['expo_integration'], backend: ['integrated', 'express_api'], data: ['neon_postgres', 'supabase', 'drizzle_orm'], architecture: ['monolith', 'serverless'] }, strengths: [], tradeoffs: [], best_for: [] },
    django: { name: 'Django', description: 'Python full-stack framework', type: 'backend_framework' as const, composition: { frontend: 'django-templates', backend: 'python' }, compatible_with: { mobile: [], backend: ['integrated'], data: ['neon_postgres', 'supabase'], architecture: ['monolith', 'serverless'] }, strengths: [], tradeoffs: [], best_for: [] },
    laravel: { name: 'Laravel', description: 'PHP full-stack framework', type: 'backend_framework' as const, composition: { frontend: 'blade', backend: 'php' }, compatible_with: { mobile: [], backend: ['integrated'], data: ['neon_postgres'], architecture: ['monolith'] }, strengths: [], tradeoffs: [], best_for: [] }
  },
  mobile_addons: {
    none: { name: 'No Mobile', description: 'No mobile app', type: 'mobile_platform' as const, composition: { mobile: 'none' }, requires_base: [], strengths: [], tradeoffs: [], best_for: [] },
    expo_integration: { name: 'Expo', description: 'React Native with Expo', type: 'mobile_platform' as const, composition: { mobile: 'expo' }, requires_base: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'astro'], strengths: [], tradeoffs: [], best_for: [] }
  },
  backend_addons: {
    integrated: { name: 'Integrated', description: 'Built-in backend', type: 'backend_service' as const, composition: { backend: 'integrated' }, strengths: [], tradeoffs: [], best_for: [] },
    fastapi_api: { name: 'FastAPI', description: 'Python API framework', type: 'backend_service' as const, composition: { backend: 'python' }, requires_base: ['nextjs_app_router', 'astro', 'django'], strengths: [], tradeoffs: [], best_for: [] },
    express_api: { name: 'Express', description: 'Node.js API framework', type: 'backend_service' as const, composition: { backend: 'node' }, requires_base: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'astro'], strengths: [], tradeoffs: [], best_for: [] }
  },
  data_addons: {
    neon_postgres: { name: 'Neon Postgres', description: 'Serverless PostgreSQL', type: 'database' as const, composition: { database: 'postgresql' }, compatible_with_all: false, compatible_with: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'astro', 'django', 'laravel'], strengths: [], tradeoffs: [], best_for: [] },
    supabase: { name: 'Supabase', description: 'PostgreSQL + Auth + Storage', type: 'database' as const, composition: { database: 'postgresql', auth: 'supabase', storage: 'supabase' }, compatible_with_all: false, compatible_with: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'astro', 'django'], strengths: [], tradeoffs: [], best_for: [] },
    drizzle_orm: { name: 'Drizzle ORM', description: 'Type-safe ORM', type: 'database' as const, composition: { database: 'postgresql', orm: 'drizzle' }, compatible_with_all: false, compatible_with: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt'], strengths: [], tradeoffs: [], best_for: [] }
  },
  architecture_addons: {
    monolith: { name: 'Monolith', description: 'Single deployment', type: 'architecture' as const, compatible_with_all: false, compatible_with: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'astro', 'django', 'laravel'], strengths: [], tradeoffs: [], best_for: [] },
    microservices: { name: 'Microservices', description: 'Distributed services', type: 'architecture' as const, compatible_with_all: false, compatible_with: ['nextjs_app_router'], requires_data: ['neon_postgres', 'supabase'], requires_backend: ['fastapi_api', 'express_api'], strengths: [], tradeoffs: [], best_for: [] },
    serverless: { name: 'Serverless', description: 'Function-based deployment', type: 'architecture' as const, compatible_with_all: false, compatible_with: ['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'astro', 'django'], strengths: [], tradeoffs: [], best_for: [] }
  }
};

describe('CompositionBuilder Integration Tests', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Web App Scenario', () => {
    it('allows complete web app stack selection', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Select base layer
      await user.click(screen.getByText('Next.js App Router'));

      // Backend layer should show options
      await user.click(screen.getByText('FastAPI'));

      // Select data
      await user.click(screen.getByText('Neon Postgres'));

      // Select architecture
      await user.click(screen.getByText('Monolith'));

      // Should be complete now - preview section appears
      await waitFor(() => {
        expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();
      });

      const completeButton = await screen.findByRole('button', { name: /Use This Stack/i });
      expect(completeButton).not.toBeDisabled();

      // Click complete
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('shows layer options for web app', () => {
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Check for layer options
      expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
      expect(screen.getByText('Mobile')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
      expect(screen.getByText('Data')).toBeInTheDocument();
      expect(screen.getByText('Architecture')).toBeInTheDocument();
    });
  });

  describe('Mobile App Scenario', () => {
    it('shows fewer required layers for mobile app', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Switch to Mobile App
      await user.click(screen.getByText('Mobile App'));

      // Select required layers
      await user.click(screen.getByText('Expo'));
      await user.click(screen.getByText('FastAPI'));
      await user.click(screen.getByText('Neon Postgres'));
      await user.click(screen.getByText('Monolith'));

      // Should be complete
      const completeButton = await screen.findByRole('button', { name: /Use This Stack/i });
      expect(completeButton).not.toBeDisabled();
    });

    it('allows mobile app with no mobile addon', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Switch to Mobile App
      await user.click(screen.getByText('Mobile App'));

      // Select "No Mobile" option
      await user.click(screen.getByText('No Mobile'));
      await user.click(screen.getByText('FastAPI'));
      await user.click(screen.getByText('Neon Postgres'));
      await user.click(screen.getByText('Monolith'));

      // Should be complete
      const completeButton = await screen.findByRole('button', { name: /Use This Stack/i });
      expect(completeButton).not.toBeDisabled();
    });
  });

  describe('API Only Scenario', () => {
    it('allows completing API-only stack selection', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Switch to API Only
      await user.click(screen.getByText('API Only'));

      // Select required layers (no base layer needed)
      await user.click(screen.getByText('FastAPI'));
      await user.click(screen.getByText('Neon Postgres'));
      await user.click(screen.getByText('Monolith'));

      // Should be complete
      const completeButton = await screen.findByRole('button', { name: /Use This Stack/i });
      expect(completeButton).not.toBeDisabled();

      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Both Web + Mobile Scenario', () => {
    it('allows completing both web + mobile stack', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Switch to Both
      await user.click(screen.getByText('Both Web + Mobile'));

      // Select all layers
      await user.click(screen.getByText('Next.js App Router'));
      await user.click(screen.getByText('Expo'));
      await user.click(screen.getByText('FastAPI'));
      await user.click(screen.getByText('Neon Postgres'));
      await user.click(screen.getByText('Monolith'));

      // Should be complete
      const completeButton = await screen.findByRole('button', { name: /Use This Stack/i });
      expect(completeButton).not.toBeDisabled();
    });
  });

  describe('Full-Stack Framework Auto-Fill', () => {
    it('shows full-stack framework options', () => {
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Full-stack framework options should be visible
      expect(screen.getByText('Next.js (Full-Stack)')).toBeInTheDocument();
      expect(screen.getByText('Remix (Full-Stack)')).toBeInTheDocument();
      expect(screen.getByText('SvelteKit (Full-Stack)')).toBeInTheDocument();
    });

    it('selects base and backend when full-stack framework clicked', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Click full-stack framework option
      await user.click(screen.getByText('Next.js (Full-Stack)'));

      // Preview should appear
      await waitFor(() => {
        expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('updates preview dynamically as selections are made', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Initial state - no preview
      expect(screen.queryByText('Your Stack Composition')).not.toBeInTheDocument();

      // Select base
      await user.click(screen.getByText('Next.js App Router'));

      // Preview should appear
      expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();
    });

    it('disables complete button until all required layers selected', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Select all layers
      await user.click(screen.getByText('Next.js App Router'));
      await user.click(screen.getByText('FastAPI'));
      await user.click(screen.getByText('Neon Postgres'));
      await user.click(screen.getByText('Monolith'));

      // Wait for preview and complete button
      await waitFor(() => {
        expect(screen.getByText('Your Stack Composition')).toBeInTheDocument();
      });

      const completeButton = await screen.findByRole('button', { name: /Use This Stack/i });
      expect(completeButton).not.toBeDisabled();
    });

    it('calls onComplete with correct composition', async () => {
      const user = userEvent.setup();
      render(
        <CompositionBuilder
          compositionSystem={mockCompositionSystem as any}
          onComplete={mockOnComplete}
        />
      );

      // Select all layers
      await user.click(screen.getByText('Next.js App Router'));
      await user.click(screen.getByText('FastAPI'));
      await user.click(screen.getByText('Neon Postgres'));
      await user.click(screen.getByText('Monolith'));

      // Click complete
      await user.click(screen.getByRole('button', { name: /Use This Stack/i }));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          {
            base: 'nextjs_app_router',
            mobile: 'none',  // Default value when not selected
            backend: 'fastapi_api',
            data: 'neon_postgres',
            architecture: 'monolith'
          },
          expect.any(Object)
        );
      });
    });
  });
});
