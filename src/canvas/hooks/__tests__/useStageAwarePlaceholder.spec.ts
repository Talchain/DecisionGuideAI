/**
 * useStageAwarePlaceholder — composer placeholder derives from the CEE freshness
 * verdict + local dirty overlay, NOT the dead useStaleGuard graph-hash path.
 *
 * Regression for the review finding: after a graph edit the composer kept claiming
 * "Ask about the latest analysis…" (because useStaleGuard.analysisState stayed
 * 'current' — _internal.graphHash is never written), contradicting the Results
 * surface's cannot-confirm state. It must never claim "latest" unless the verdict
 * is confirmed-fresh.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const selectionRef: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = { value: null }
vi.mock('../useSelectionContext', () => ({
  useSelectionContext: () => selectionRef.value,
}))

import { useStageAwarePlaceholder } from '../useStageAwarePlaceholder'
import { useCanvasStore } from '../../store'

const node = (id: string) => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } })
const placeholder = () => renderHook(() => useStageAwarePlaceholder()).result.current

beforeEach(() => {
  selectionRef.value = null
  useCanvasStore.setState({
    nodes: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: { status: 'idle' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
})

const complete = () => useCanvasStore.setState({ results: { status: 'complete' } as never })
const setFresh = () => useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })

describe('useStageAwarePlaceholder', () => {
  it('no model → "Describe your decision…"', () => {
    expect(placeholder()).toBe('Describe your decision…')
  })

  it('model exists, no analysis → "Ask about this model…"', () => {
    useCanvasStore.setState({ nodes: [node('a')] as never })
    expect(placeholder()).toBe('Ask about this model…')
  })

  it('selection wins over everything → "Ask about {label}…"', () => {
    useCanvasStore.setState({ nodes: [node('a')] as never })
    complete(); setFresh()
    selectionRef.value = { id: 'g', label: 'Switch jobs?', kind: 'node' }
    expect(placeholder()).toBe('Ask about Switch jobs?…')
  })

  it('confirmed-fresh analysis → "Ask about the latest analysis…"', () => {
    complete(); setFresh()
    expect(placeholder()).toBe('Ask about the latest analysis…')
  })

  it('CEE stale verdict → "Model changed. Ask or rerun…"', () => {
    complete()
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    expect(placeholder()).toBe('Model changed. Ask or rerun…')
  })

  it('REGRESSION: fresh analysis edited locally (cannot-confirm) → "Model changed…", NEVER "latest"', () => {
    complete(); setFresh()
    useCanvasStore.getState().markAnalysisFreshnessDirty()
    const p = placeholder()
    expect(p).toBe('Model changed. Ask or rerun…')
    expect(p).not.toMatch(/latest/i)
  })

  it('CEE-sourced unknown (cannot-confirm) → neutral "Ask about this analysis…", never "latest"', () => {
    complete()
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'unknown', freshness_reason: 'no_hash' })
    const p = placeholder()
    expect(p).toBe('Ask about this analysis…')
    expect(p).not.toMatch(/latest/i)
  })
})
