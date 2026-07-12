/**
 * Wave F-A — option-numbering store slice + outside-React snapshot.
 *
 * The numbering map lives in the canvas store so (a) it survives reruns
 * within a scenario session, (b) non-React consumers (canvas OptionNode in
 * Wave 4, AI-context builders later) can read the SAME numbers via the
 * published snapshot (§12.4 one-selector rule).
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../../../canvas/store'
import { getAnalysisDisplaySnapshot } from '../analysisDisplaySelector'

beforeEach(() => {
  useCanvasStore.setState({ optionNumbering: {} } as never)
})

describe('registerOptionNumbering', () => {
  it('assigns and persists ordinals in the store', () => {
    useCanvasStore.getState().registerOptionNumbering(['opt-a', 'opt-b'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ 'opt-a': 1, 'opt-b': 2 })
  })

  it('is stable across re-registration with flipped order and appends new ids', () => {
    const s = useCanvasStore.getState()
    s.registerOptionNumbering(['opt-a', 'opt-b'])
    s.registerOptionNumbering(['opt-b', 'opt-a', 'opt-c'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({
      'opt-a': 1,
      'opt-b': 2,
      'opt-c': 3,
    })
  })

  it('no-ops on an empty id list', () => {
    useCanvasStore.getState().registerOptionNumbering(['opt-a'])
    useCanvasStore.getState().registerOptionNumbering([])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ 'opt-a': 1 })
  })

  it('resets when a scenario is hydrated (numbering is per-scenario continuity)', () => {
    useCanvasStore.getState().registerOptionNumbering(['opt-a', 'opt-b'])
    useCanvasStore.getState().hydrateGraphSlice({
      nodes: [],
      edges: [],
      currentScenarioId: 'scenario-2',
    })
    expect(useCanvasStore.getState().optionNumbering).toEqual({})
  })
})

describe('getAnalysisDisplaySnapshot', () => {
  it('exposes the numbering map to non-React consumers', () => {
    useCanvasStore.getState().registerOptionNumbering(['opt-a', 'opt-b'])
    const snapshot = getAnalysisDisplaySnapshot()
    expect(snapshot.numbering).toEqual({ 'opt-a': 1, 'opt-b': 2 })
    expect(snapshot.stableNumberFor('opt-b')).toBe(2)
    expect(snapshot.stableNumberFor('unknown')).toBeNull()
  })
})
