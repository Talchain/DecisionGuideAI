import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SimplifyToggle from '../components/SimplifyToggle';

describe('SimplifyToggle', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    mockOnToggle.mockClear();
  });

  it('renders with correct threshold value 0.3', () => {
    render(<SimplifyToggle onToggle={mockOnToggle} isSimplified={false} />);

    expect(screen.getByText('0.3')).toBeTruthy();
    expect(screen.getByText('Threshold:')).toBeTruthy();
  });

  it('calls onToggle when clicked', () => {
    render(<SimplifyToggle onToggle={mockOnToggle} isSimplified={false} />);

    const toggles = screen.getAllByRole('switch');
    fireEvent.click(toggles[0]);

    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  it('has proper ARIA attributes', () => {
    render(<SimplifyToggle onToggle={mockOnToggle} isSimplified={false} />);

    const toggles = screen.getAllByRole('switch');
    expect(toggles[0].getAttribute('aria-checked')).toBe('false');
    expect(toggles[0].getAttribute('aria-label')).toBeTruthy();
  });
});