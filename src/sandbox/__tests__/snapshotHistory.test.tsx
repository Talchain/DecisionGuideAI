import { screen } from '@testing-library/react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { describe, it, expect } from 'vitest';
import { renderWithSandboxBoard } from './testUtils';

describe('Snapshot/History', () => {
  it('renders SandboxCanvas without crashing', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Smoke assertion on known UI elements (multiple "Show Guide" buttons may exist)
    const guideBtns = screen.getAllByRole('button', { name: /Show Guide/i });
    expect(guideBtns.length).toBeGreaterThan(0);
  });

  it('renders placeholder empty board UI', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    expect(screen.getByText(/Empty Board/i)).toBeInTheDocument();
  });
});
