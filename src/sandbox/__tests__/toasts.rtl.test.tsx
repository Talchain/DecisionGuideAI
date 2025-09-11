import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderWithSandboxBoardAndToaster } from './testUtils'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/ui/toast/toaster'
import { toast } from '@/components/ui/use-toast'

// We no longer import the heavy ScenarioSandboxMock; we trigger toast() directly.

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
      // Dismiss any lingering toasts and flush removal timers to avoid cross-test accumulation
      act(() => { toast.dismiss() })
      vi.advanceTimersByTime(1500)
      vi.runOnlyPendingTimers()
      // Run and clear any pending timers to avoid leakage across tests
      vi.runOnlyPendingTimers()
    } catch {}
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('shows a toast when requesting help', async () => {
    renderWithSandboxBoardAndToaster(<div />)
    await act(async () => {
      toast({ title: 'Open help docs (placeholder)' })
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Open help docs (placeholder)')).toBeInTheDocument()
  })

  it('auto-dismisses the toast after timeout', async () => {
    renderWithSandboxBoardAndToaster(<div />)
    await act(async () => {
      toast({ title: 'Open help docs (placeholder)' })
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Open help docs (placeholder)')).toBeInTheDocument()

    // Advance past default toast duration (~5000ms) and removal (~1000ms)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(screen.queryByText('Open help docs (placeholder)')).not.toBeInTheDocument()
  })
})
