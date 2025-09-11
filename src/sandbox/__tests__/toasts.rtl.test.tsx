import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithSandboxBoardAndToaster } from './testUtils'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/ui/toast/toaster'

// Minimal stub for ScenarioSandboxMock to avoid heavy UI wiring
vi.mock('@/sandbox/ui/ScenarioSandboxMock', () => ({
  ScenarioSandboxMock: () => {
    const React = require('react') as typeof import('react')
    return React.createElement(
      'button',
      { 'aria-label': 'Help', onClick: async () => { const m = await import('@/components/ui/toast/use-toast'); m.toast({ title: 'Open help docs (placeholder)' }) } },
      'Help'
    )
  },
}))

// Mock heavy board/state to avoid Yjs and open handles during tests
vi.mock('@/sandbox/state/boardState', () => ({
  useBoardState: () => ({
    board: { id: 'b1', title: 'Test', nodes: [], edges: [], version: 1, createdAt: '', updatedAt: '', isDraft: true, createdBy: 'u1' } as any,
    getUpdate: () => new Uint8Array(),
    replaceWithUpdate: () => {},
    getCurrentDocument: () => null,
    getDecisionOptions: () => [] as string[],
  }),
  getOptionHandleId: (id: string) => `option:${id}`,
}))

describe('Sandbox toasts', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  })

  afterEach(() => {
    try {
      // Run and clear any pending timers to avoid leakage across tests
      vi.runOnlyPendingTimers()
    } catch {}
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('shows a toast when requesting help', async () => {
    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
    renderWithSandboxBoardAndToaster(<ScenarioSandboxMock />)
    await user.click(screen.getByLabelText('Help'))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByText('Open help docs (placeholder)')).toBeInTheDocument()
  })

  it('auto-dismisses the toast after timeout', async () => {
    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
    renderWithSandboxBoardAndToaster(<ScenarioSandboxMock />)
    await user.click(screen.getByLabelText('Help'))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByText('Open help docs (placeholder)')).toBeInTheDocument()

    // Advance past default toast duration (~5000ms) and removal (~1000ms)
    await vi.advanceTimersByTimeAsync(6000)
    expect(screen.queryByText('Open help docs (placeholder)')).not.toBeInTheDocument()
  })
})
