import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'

/**
 * Diagnostics RunMeta reducer tests
 */

describe('Canvas Store – runMeta', () => {
  beforeEach(() => {
    // Reset runMeta slice before each test
    useCanvasStore.getState().setRunMeta({
      diagnostics: undefined,
      correlationIdHeader: undefined,
      degraded: undefined,
    })
  })

  it('merges top-level runMeta fields', () => {
    const { setRunMeta } = useCanvasStore.getState()

    setRunMeta({ correlationIdHeader: 'hdr-1' })
    let state = useCanvasStore.getState().runMeta

    expect(state.correlationIdHeader).toBe('hdr-1')
    expect(state.degraded).toBeUndefined()

    setRunMeta({ degraded: true })
    state = useCanvasStore.getState().runMeta

    expect(state.correlationIdHeader).toBe('hdr-1')
    expect(state.degraded).toBe(true)
  })

  it('replaces diagnostics object while preserving other fields', () => {
    const { setRunMeta } = useCanvasStore.getState()

    const diag1 = {
      resumes: 1,
      trims: 0 as const,
      recovered_events: 2,
      correlation_id: 'corr-1',
    }

    const diag2 = {
      resumes: 3,
      trims: 1 as const,
      recovered_events: 5,
      correlation_id: 'corr-2',
    }

    setRunMeta({ diagnostics: diag1, correlationIdHeader: 'hdr-1' })
    let state = useCanvasStore.getState().runMeta

    expect(state.diagnostics).toEqual(diag1)
    expect(state.correlationIdHeader).toBe('hdr-1')

    setRunMeta({ diagnostics: diag2 })
    state = useCanvasStore.getState().runMeta

    expect(state.diagnostics).toEqual(diag2)
    expect(state.correlationIdHeader).toBe('hdr-1')
  })
})
