import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HealthStatus from '../components/HealthStatus';
import { EngineStatus } from '../hooks/useEngineMode';

describe('HealthStatus', () => {
  const mockOnRefresh = vi.fn();

  it('does not render in fixtures mode', () => {
    const status: EngineStatus = {
      mode: 'fixtures',
      connected: false
    };

    const { container } = render(<HealthStatus status={status} onRefresh={mockOnRefresh} />);
    expect(container.children).toHaveLength(0);
  });

  it('renders health button in live mode', () => {
    const status: EngineStatus = {
      mode: 'live',
      connected: true,
      health: {
        status: 'healthy',
        p95_ms: 150
      },
      correlationId: 'test-correlation-id'
    };

    render(<HealthStatus status={status} onRefresh={mockOnRefresh} />);
    expect(screen.getByLabelText(/Gateway health/)).toBeTruthy();
  });

  it('calls onRefresh when clicked', () => {
    const status: EngineStatus = {
      mode: 'live',
      connected: true,
      health: { status: 'healthy', p95_ms: 150 }
    };

    render(<HealthStatus status={status} onRefresh={mockOnRefresh} />);

    const buttons = screen.getAllByLabelText(/Gateway health/);
    fireEvent.click(buttons[0]);

    expect(mockOnRefresh).toHaveBeenCalled();
  });
});