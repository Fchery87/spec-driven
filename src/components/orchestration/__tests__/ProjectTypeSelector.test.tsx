import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectTypeSelector } from '@/components/orchestration/ProjectTypeSelector';
import { ProjectType } from '@/types/composition';

describe('ProjectTypeSelector', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 project type options', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Both Web + Mobile')).toBeInTheDocument();
    expect(screen.getByText('API Only')).toBeInTheDocument();
  });

  it('highlights selected project type', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    const webAppOption = screen.getByText('Web App').closest('[role="radio"]');
    expect(webAppOption).toHaveAttribute('data-state', 'checked');
  });

  it('calls onSelect when option is clicked', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('Mobile App'));
    expect(mockOnSelect).toHaveBeenCalledWith(ProjectType.MOBILE_APP);
  });

  it('shows description for each option', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    expect(screen.getByText(/Browser-based application/i)).toBeInTheDocument();
    expect(screen.getByText(/Native mobile application/i)).toBeInTheDocument();
  });
});
