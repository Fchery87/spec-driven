import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompositionLayerCard } from '@/components/orchestration/CompositionLayerCard';

const mockLayers = Array.from({ length: 6 }, (_, i) => ({
  id: `layer_${i}`,
  name: `Layer ${i + 1}`,
  description: `Description for layer ${i + 1}`
}));

describe('CompositionLayerCard Expand/Collapse', () => {
  it('shows "+2 more options" when layers exceed 4', () => {
    render(
      <CompositionLayerCard
        title="Test Layer"
        layers={mockLayers as any[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('+2 more options')).toBeInTheDocument();
  });

  it('expands when "+more" button is clicked', () => {
    render(
      <CompositionLayerCard
        title="Test Layer"
        layers={mockLayers as any[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    const moreButton = screen.getByText('+2 more options');
    fireEvent.click(moreButton);
    expect(screen.getByText('Layer 5')).toBeInTheDocument();
    expect(screen.getByText('Layer 6')).toBeInTheDocument();
  });

  it('toggles between expand and collapse', () => {
    render(
      <CompositionLayerCard
        title="Test Layer"
        layers={mockLayers as any[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('+2 more options'));
    expect(screen.getByText('Show fewer options')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show fewer options'));
    expect(screen.getByText('+2 more options')).toBeInTheDocument();
  });
});
