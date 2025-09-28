import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SandboxShell from '../SandboxShell';

// Mock the useEngineMode hook
vi.mock('../hooks/useEngineMode', () => ({
  useEngineMode: () => ({
    status: {
      mode: 'fixtures',
      connected: false,
      health: undefined,
      correlationId: undefined
    },
    events: [],
    stats: {
      firstTokenTime: undefined,
      resumeCount: 0,
      cancelCount: 0,
      startTime: undefined
    },
    isStreaming: false,
    startStream: vi.fn(),
    simulateBlip: vi.fn(),
    cancelStream: vi.fn(),
    reset: vi.fn(),
    checkHealth: vi.fn()
  })
}));

// Mock the flags
vi.mock('../flags', () => ({
  isMobileViewport: () => false,
  isLiveGatewayEnabled: () => false,
  prefersReducedMotion: () => false
}));

describe('SandboxShell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the main components', () => {
    render(<SandboxShell />);

    expect(screen.getAllByText('Decision Analysis Sandbox')[0]).toBeTruthy();
    // Component may show template loaded state or choose template state
    expect(screen.getByText(/Choose a template to begin|Template loaded successfully/)).toBeTruthy();
    expect(screen.getAllByText('Results Summary')[0]).toBeTruthy();
  });

  it('includes accessibility features', () => {
    render(<SandboxShell />);

    const liveRegion = document.getElementById('live-announcements');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows fixtures mode by default', () => {
    render(<SandboxShell />);

    expect(screen.getAllByText('Fixtures')[0]).toBeTruthy();
  });
});