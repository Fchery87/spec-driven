import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompositionLayerCard } from '@/components/orchestration/CompositionLayerCard';

const mockLayers = {
  base: [
    { id: 'nextjs_app_router', name: 'Next.js App Router', description: 'Next.js 14+' },
    { id: 'astro', name: 'Astro', description: 'Zero JS by default' }
  ],
  mobile: [
    { id: 'none', name: 'No Mobile', description: 'Web-only' },
    { id: 'expo_integration', name: 'Expo', description: 'React Native' }
  ]
};

describe('CompositionLayerCard', () => {
  it('renders layer title and options', () => {
    render(
      <CompositionLayerCard
        title="Base Layer"
        description="Choose your frontend framework"
        layers={mockLayers.base as any[]}
        selectedId="nextjs_app_router"
        onSelect={() => {}}
      />
    );
    
    expect(screen.getByText('Base Layer')).toBeInTheDocument();
    expect(screen.getByText('Choose your frontend framework')).toBeInTheDocument();
    expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
    expect(screen.getByText('Astro')).toBeInTheDocument();
  });

  it('highlights selected layer', () => {
    render(
      <CompositionLayerCard
        title="Base Layer"
        layers={mockLayers.base as any[]}
        selectedId="nextjs_app_router"
        onSelect={() => {}}
      />
    );
    
    const nextjsCard = screen.getByText('Next.js App Router').closest('button');
    expect(nextjsCard).toHaveClass('bg-primary/5');
  });

  it('calls onSelect when layer is clicked', () => {
    const onSelect = vi.fn();
    render(
      <CompositionLayerCard
        title="Base Layer"
        layers={mockLayers.base as any[]}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    
    fireEvent.click(screen.getByText('Next.js App Router'));
    expect(onSelect).toHaveBeenCalledWith('nextjs_app_router');
  });
});
