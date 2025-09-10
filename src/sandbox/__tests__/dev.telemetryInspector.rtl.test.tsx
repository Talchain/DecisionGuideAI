// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as analytics from '@/lib/analytics'
import { TelemetryInspector } from '@/sandbox/dev/TelemetryInspector'

describe('TelemetryInspector (dev-only)', () => {
  beforeEach(() => {
    analytics.__clearTestBuffer()
    vi.useFakeTimers()
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); analytics.__clearTestBuffer() })

  it('renders recent events and Clear empties it (dev)', async () => {
    // push some events
    analytics.track('sandbox_panel', { op: 'tab_select', decisionId: 'd1', ts: 1 })
    analytics.track('sandbox_snapshot', { action: 'save', decisionId: 'd1', snapshotId: 's1', ts: 2 })

    const { getByTestId, getByLabelText } = render(<TelemetryInspector />)

    await vi.advanceTimersByTimeAsync(600)
    const list = getByTestId('telemetry-list')
    expect(list.textContent).toContain('sandbox_panel')

    // clear
    const clearBtn = getByLabelText('Clear telemetry')
    clearBtn.click()
    await vi.advanceTimersByTimeAsync(10)
    expect(getByTestId('telemetry-list').textContent).not.toContain('sandbox_panel')
  })

  it('does not render in prod mode', () => {
    ;(globalThis as any).__DM_FORCE_PROD = true
    const { queryByTestId } = render(<TelemetryInspector />)
    expect(queryByTestId('telemetry-list')).toBeNull()
    ;(globalThis as any).__DM_FORCE_PROD = false
  })
})
