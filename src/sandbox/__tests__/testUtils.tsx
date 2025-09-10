// testUtils.tsx - Shared helpers for Scenario Sandbox tests
// ----------------------------------------------------------
// Vitest Best Practice for Scenario Sandbox:
//
// - Use only the mocked hooks (e.g., useBoardState) in vi.mock factories. Do NOT attempt to import or require mock state from the module under test.
// - All per-test reset helpers (resetNodes, resetEdges, resetComments, resetSnapshots) are exported from this file and should be called in beforeEach in your test files.
// - Never expose mock-only state or helpers via the vi.mock factory.
// - To reset state between tests, call the exported reset helpers in beforeEach.
// - To add new board/comment/snapshot helpers, extend this file only.
// - Example:
//   import { resetNodes, resetEdges, resetComments, resetSnapshots } from './testUtils';
//   beforeEach(() => {
//     resetNodes();
//     resetEdges();
//     resetComments();
//     resetSnapshots();
//   });
//
// See README section below for best practices and extension guidance.

import React, { useState } from 'react';
import { vi } from 'vitest';

// Types
export type SandboxNode = {
  id: string;
  label: string;
  type: 'decision' | 'option';
  x: number;
  y: number;
  data?: Record<string, any>;
};
export type Edge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

// Default board state
export function getDefaultNodes(): SandboxNode[] {
  return [
    { id: 'n1', label: 'Node 1', type: 'decision', x: 100, y: 100, data: {} },
    { id: 'n2', label: 'Node 2', type: 'option', x: 300, y: 200, data: {} },
  ];
}
export function getDefaultEdges(): Edge[] {
  return [
    { id: 'e1', source: 'n1', target: 'n2', label: 'Edge 1-2' },
  ];
}

// Board state context/provider and mock hook
export { BoardStateTestProvider, useBoardStateMock } from './BoardStateTestProvider';

// Render wrapper for context providers
import { render } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { BoardStateTestProvider } from './BoardStateTestProvider';
import { Toaster } from '@/components/ui/toast/toaster';

export function renderWithSandboxBoard(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <BoardStateTestProvider>{ui}</BoardStateTestProvider>
    </ThemeProvider>
  );
}

export function renderWithSandboxBoardAndToaster(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <BoardStateTestProvider>
        {ui}
        <Toaster />
      </BoardStateTestProvider>
    </ThemeProvider>
  );
}

// README for future test writers
/*
README: Scenario Sandbox Test Utilities
--------------------------------------
- Use setupSandboxTest to create a local stateful board mock for each test file.
- Call resetNodes/resetEdges in beforeEach to ensure isolation between tests.
- Use renderWithSandboxBoard instead of render if you need context providers.
- Add new helpers here for comments, snapshots, etc. as needed.
- Keep all test state local to avoid cross-test pollution.
*/
