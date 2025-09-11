// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'
import userEvent from '@testing-library/user-event'
import { SnapshotTray } from '@/sandbox/components/SnapshotTray'
import { saveSnapshot as storageSaveSnapshot, listSnapshots as storageListSnapshots } from '@/sandbox/state/snapshots'
import { Toaster } from '@/components/ui/toast/toaster'

// Flags provided via renderSandbox

// Partially mock board state to avoid Yjs, but preserve constants used by snapshots.ts
vi.mock('@/sandbox/state/boardState', async () => {
  const actual = await vi.importActual<typeof import('@/sandbox/state/boardState')>('@/sandbox/state/boardState')
  return {
    ...actual,
    useBoardState: () => ({
      getUpdate: () => new Uint8Array(),
      replaceWithUpdate: () => {},
    }),
  }
})

// Capture analytics at the module level so storage-level telemetry (snapshots.ts) is intercepted
let calls: Array<{ event: string; props: any }> = []
vi.mock('@/lib/analytics', () => ({
  track: (event: string, props: any = {}) => calls.push({ event, props }),
  model_segment_changed: () => {},
}))

describe('SnapshotTray Clear All', () => {
  const decisionId = 'tray-clear'

  beforeEach(() => {
    calls = []
    try { localStorage.clear() } catch {}
  })

  it('clears all snapshots via SnapshotTray UI and emits correct telemetry', async () => {
    // Seed snapshots
    const bytes = new Uint8Array()
    storageSaveSnapshot(decisionId, bytes, { note: 'A' })
    storageSaveSnapshot(decisionId, bytes, { note: 'B' })
    expect(storageListSnapshots(decisionId)).toHaveLength(2)

    const user = userEvent.setup()

    const { SnapshotTray: Tray } = await import('@/sandbox/components/SnapshotTray')
    renderSandbox(
      <>
        <Tray boardId={decisionId} />
        <Toaster />
      </>,
      { sandbox: true, scenarioSnapshots: true }
    )

    // Button should be visible since there are snapshots
    const clearBtn = await screen.findByRole('button', { name: /Clear all snapshots/i })
    await user.click(clearBtn)

    // UI list should now be empty
    expect(screen.getByText(/No snapshots yet/i)).toBeInTheDocument()

    // Telemetry: two deletes and one clear summary
    const dels = calls.filter(c => c.event === 'sandbox_snapshot' && c.props.op === 'delete')
    const clr = calls.filter(c => c.event === 'sandbox_snapshot' && c.props.op === 'clear')
    expect(dels).toHaveLength(2)
    expect(clr).toHaveLength(1)
    expect(clr[0].props.decisionId).toBe(decisionId)
    expect(clr[0].props.count).toBe(2)
  })
})
