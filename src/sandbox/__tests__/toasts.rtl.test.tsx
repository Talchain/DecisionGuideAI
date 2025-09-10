import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/ui/toast/toaster'

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
    render(
      <>
        <ScenarioSandboxMock />
        <Toaster />
      </>
    )
    await user.click(screen.getByLabelText('Help'))
    // With fake timers, drive any scheduled updates to completion
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByText('Open help docs (placeholder)')).toBeInTheDocument()
  })

  it('auto-dismisses the toast after timeout', async () => {
    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
    render(
      <>
        <ScenarioSandboxMock />
        <Toaster />
      </>
    )
    await user.click(screen.getByLabelText('Help'))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByText('Open help docs (placeholder)')).toBeInTheDocument()

    // Advance past default toast duration (~5000ms) and removal (~1000ms)
    vi.advanceTimersByTime(6000)
    // Allow any pending microtasks to flush
    await Promise.resolve()
    expect(screen.queryByText('Open help docs (placeholder)')).not.toBeInTheDocument()
  })
})
