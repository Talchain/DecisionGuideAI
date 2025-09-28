import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CompareDrawer from '../components/CompareDrawer';

describe('CompareDrawer', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('does not render when closed', () => {
    render(<CompareDrawer isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Compare Analysis')).toBe(null);
  });

  it('renders when open', () => {
    render(<CompareDrawer isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Compare Analysis')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    render(<CompareDrawer isOpen={true} onClose={mockOnClose} />);

    const closeButtons = screen.getAllByLabelText('Close compare drawer');
    fireEvent.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });
});