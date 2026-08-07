/**
 * Wave F-B — isStaleAfterEdit sources staleness from the CANONICAL freshness
 * owner (brief §5.3: no local freshness derivation). The old local heuristic
 * (had-results && edited-this-session) fabricated staleness independently of
 * CEE's verdict + the dirty overlay.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useEditConfirmation } from '../useEditConfirmation'
import { useCanvasStore } from '../../../store'

beforeEach(() => {
  useCanvasStore.setState({
    analysisFreshness: { freshness: 'fresh', freshnessReason: null, computedAt: 1 },
    analysisFreshnessDirty: false,
  } as never)
})

describe('useEditConfirmation × canonical freshness (Wave F-B)', () => {
  it('no stale prompt while the canonical verdict is confirmably fresh, even after an edit confirm', () => {
    const { result } = renderHook(() => useEditConfirmation())
    act(() => result.current.confirm('weight'))
    expect(result.current.isStaleAfterEdit).toBe(false)
  })

  it('prompts when the local dirty overlay downgrades a fresh verdict after an edit', () => {
    const { result } = renderHook(() => useEditConfirmation())
    act(() => {
      result.current.confirm('weight')
      useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    })
    expect(result.current.isStaleAfterEdit).toBe(true)
  })

  it('never prompts without an edit in this panel, whatever the verdict', () => {
    useCanvasStore.setState({
      analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_changed', computedAt: 1 },
    } as never)
    const { result } = renderHook(() => useEditConfirmation())
    expect(result.current.isStaleAfterEdit).toBe(false)
  })
})
