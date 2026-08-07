/**
 * analysisHighlight store slice — the analysis-graph projection state.
 *
 * Pins: setAnalysisHighlight stores the source + resolved ids as Sets; a second
 * set REPLACES the previous projection wholesale; clearAnalysisHighlight resets
 * to the empty projection and is a no-op (no Set-identity churn) when already
 * clear.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'

describe('analysisHighlight slice', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearAnalysisHighlight()
  })

  it('starts empty', () => {
    const h = useCanvasStore.getState().analysisHighlight
    expect(h.source).toBeNull()
    expect(h.edgeIds.size).toBe(0)
    expect(h.nodeIds.size).toBe(0)
  })

  it('setAnalysisHighlight("flip_risks", …) stores edge ids as a Set under the flip_risks source', () => {
    useCanvasStore.getState().setAnalysisHighlight('flip_risks', { edgeIds: ['e1', 'e2'] })
    const h = useCanvasStore.getState().analysisHighlight
    expect(h.source).toBe('flip_risks')
    expect([...h.edgeIds]).toEqual(['e1', 'e2'])
    expect(h.nodeIds.size).toBe(0)
    expect(h.edgeIds.has('e1')).toBe(true)
  })

  it('setAnalysisHighlight("drivers", …) stores node ids under the drivers source', () => {
    useCanvasStore.getState().setAnalysisHighlight('drivers', { nodeIds: ['n1', 'n2'] })
    const h = useCanvasStore.getState().analysisHighlight
    expect(h.source).toBe('drivers')
    expect([...h.nodeIds]).toEqual(['n1', 'n2'])
    expect(h.edgeIds.size).toBe(0)
  })

  it('a second set REPLACES the previous projection (swap, never merge)', () => {
    useCanvasStore.getState().setAnalysisHighlight('drivers', { nodeIds: ['n1'] })
    useCanvasStore.getState().setAnalysisHighlight('flip_risks', { edgeIds: ['e9'] })
    const h = useCanvasStore.getState().analysisHighlight
    expect(h.source).toBe('flip_risks')
    expect([...h.edgeIds]).toEqual(['e9'])
    expect(h.nodeIds.size).toBe(0)
  })

  it('clearAnalysisHighlight resets to the empty projection', () => {
    useCanvasStore.getState().setAnalysisHighlight('flip_risks', { edgeIds: ['e1'] })
    useCanvasStore.getState().clearAnalysisHighlight()
    const h = useCanvasStore.getState().analysisHighlight
    expect(h.source).toBeNull()
    expect(h.edgeIds.size).toBe(0)
    expect(h.nodeIds.size).toBe(0)
  })

  it('clearAnalysisHighlight is a no-op when already clear (same object reference)', () => {
    const before = useCanvasStore.getState().analysisHighlight
    useCanvasStore.getState().clearAnalysisHighlight()
    const after = useCanvasStore.getState().analysisHighlight
    // No write occurred, so the slice reference is unchanged — this is what
    // spares every edge/node projection selector a needless re-run.
    expect(after).toBe(before)
  })
})
