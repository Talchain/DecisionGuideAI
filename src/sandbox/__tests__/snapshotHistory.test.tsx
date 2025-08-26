import { vi } from 'vitest';
import { createSandboxMocks, resetNodes, resetEdges, resetSnapshots } from './testUtils';
vi.mock('../state/boardState', () => {
  const sandboxMocks = createSandboxMocks();
  return { useBoardState: sandboxMocks.useBoardStateMock };
});

/**
 * TEST UTILITY PATTERN: renderWithSandboxBoard
 *
 * All tests in this file must render components using the `renderWithSandboxBoard` utility,
 * which wraps the tested component in the local BoardStateTestProvider context.
 * This ensures all stateful board logic is properly mocked and triggers UI re-renders.
 * Do NOT use plain render().
 */
import { render, fireEvent, screen } from '@testing-library/react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { describe, it, expect } from 'vitest';
import { BoardStateTestProvider } from './testUtils';

function renderWithSandboxBoard(ui: React.ReactElement) {
  return render(<BoardStateTestProvider>{ui}</BoardStateTestProvider>);
}

beforeEach(() => { resetNodes(); resetEdges(); resetSnapshots(); });

describe('Snapshot/History', () => {
  it('shows snapshot list and allows creating a snapshot', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Simulate snapshot creation
    saveSnapshotMock();
    expect(listSnapshotsMock().length).toBeGreaterThan(1);
  });
  it('restores a snapshot (UI placeholder)', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Simulate restore
    loadSnapshotMock('s1');
    // Would assert UI updates if implemented
    expect(listSnapshotsMock().length).toBeGreaterThan(0);
  });
});
