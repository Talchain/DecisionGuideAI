// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { fireEvent, screen } from '@testing-library/react'
import * as analytics from '@/lib/analytics'
import { SnapshotTray } from '@/sandbox/components/SnapshotTray'
import { Toaster } from '@/components/ui/toast/toaster'

// Smoke: SnapshotTray emits sandbox_snapshot on save and restore via useTelemetry

// Avoid real Yjs/board wiring in tests
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

describe('SnapshotTray telemetry (smoke)', () => {
  beforeEach(() => {
    analytics.__clearTestBuffer()
    analytics.__setProdSchemaForTest(true)
    analytics.__setProdSchemaModeForTest('replace')
    vi.useFakeTimers()
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); analytics.__clearTestBuffer(); analytics.__setProdSchemaModeForTest(null as any) })

  it('emits sandbox_snapshot on save and restore', async () => {
    renderSandbox(
      <>
        <SnapshotTray boardId="snap-smoke" />
        <Toaster />
      </>,
      { sandbox: true, scenarioSnapshots: true }
    )

    // Click Save Snapshot to open prompt
    fireEvent.click(screen.getByRole('button', { name: 'Save Snapshot' }))
    // Click Save in the dialog
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Wait a tick for state updates
    await vi.advanceTimersByTimeAsync(1)

    // There should be at least one snapshot with a Load button
    const loadButtons = screen.getAllByRole('button', { name: 'Load' })
    expect(loadButtons.length).toBeGreaterThan(0)

    // Click Load to trigger restore event
    fireEvent.click(loadButtons[0])

    await vi.advanceTimersByTimeAsync(1)

    const names = analytics.__getTestBuffer().map(p => p.event)
    expect(names).toContain('sandbox_snapshot') // save
    expect(names.filter(n => n === 'sandbox_snapshot').length).toBeGreaterThan(1) // includes restore
  })
})
