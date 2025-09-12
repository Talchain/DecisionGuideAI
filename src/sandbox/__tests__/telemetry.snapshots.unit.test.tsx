// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FlagsProvider } from '@/lib/flags'
import { render } from '@testing-library/react'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'

// Mock analytics
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

function DriveOps() {
  const api = useGraph()
  React.useEffect(() => {
    const { snapId } = api.saveSnapshot('N')
    api.duplicateSnapshot(snapId)
    api.renameSnapshot(snapId, 'R')
    api.restoreSnapshot(snapId)
    api.deleteSnapshot(snapId)
  }, [])
  return null
}

describe('telemetry.snapshots', () => {
  beforeEach(() => { trackSpy.mockReset(); localStorage.clear() })
  afterEach(() => { trackSpy.mockReset(); localStorage.clear() })

  it('emits snapshot CRUD events', async () => {
    render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: false, sandboxCompare: true }}>
        <GraphProvider decisionId={'demo'}>
          <DriveOps />
        </GraphProvider>
      </FlagsProvider>
    )

    const events = trackSpy.mock.calls.map(c => c[0])
    expect(events.includes('sandbox_snapshot_create')).toBe(true)
    expect(events.includes('sandbox_snapshot_duplicate')).toBe(true)
    expect(events.includes('sandbox_snapshot_restore')).toBe(true)
    expect(events.includes('sandbox_snapshot_rename')).toBe(true)
    expect(events.includes('sandbox_snapshot_delete')).toBe(true)
  })
})
