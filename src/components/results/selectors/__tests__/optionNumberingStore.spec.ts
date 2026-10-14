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
  useCanvasStore.setState({ optionNumbering: {}, optionNumberingProvisional: [], nodes: [] } as never)
})

const card = (id: string, x: number, y = 0) => ({ id, type: 'option', position: { x, y }, data: { label: id } })

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

  it('re-registration with no new ids leaves the map reference-equal (loop-guard pin)', () => {
    const s = useCanvasStore.getState()
    s.registerOptionNumbering(['opt-a', 'opt-b'])
    const before = useCanvasStore.getState().optionNumbering
    s.registerOptionNumbering(['opt-b', 'opt-a'])
    expect(useCanvasStore.getState().optionNumbering).toBe(before)
  })

  /**
   * Run-3 judge U7 (hiring step 18): the drafted cards sit stacked at {0,0} until the layout lands. Numbers given then
   * follow the caller's order, so they are provisional: the first registration once the cards are spread gives them
   * again along the row. A settled number is never changed.
   */
  it('cards on one point are numbered provisionally; once spread, the same ids are numbered along the row', () => {
    const s = useCanvasStore.getState()
    useCanvasStore.setState({ nodes: [card('tech', 0), card('two', 0), card('cont', 0)] } as never)
    s.registerOptionNumbering(['tech', 'two', 'cont'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ tech: 1, two: 2, cont: 3 })
    expect(useCanvasStore.getState().optionNumberingProvisional).toEqual(['tech', 'two', 'cont'])
    useCanvasStore.setState({ nodes: [card('tech', 0), card('two', 500), card('cont', 250)] } as never)
    s.registerOptionNumbering(['tech', 'two', 'cont'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ tech: 1, cont: 2, two: 3 })
    expect(useCanvasStore.getState().optionNumberingProvisional).toEqual([])
    // Settled: a later move renumbers nothing.
    useCanvasStore.setState({ nodes: [card('tech', 500), card('two', 0), card('cont', 250)] } as never)
    s.registerOptionNumbering(['tech', 'two', 'cont'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ tech: 1, cont: 2, two: 3 })
  })

  it('new cards dropped on one point beside settled ones: only the new ones are given again, after the settled numbers', () => {
    const s = useCanvasStore.getState()
    useCanvasStore.setState({ nodes: [card('a', 300), card('b', 0)] } as never)
    s.registerOptionNumbering(['a', 'b'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ b: 1, a: 2 })
    // A later layout swaps the settled pair and drops two new cards on one point below them.
    useCanvasStore.setState({ nodes: [card('a', 0), card('b', 300), card('c', 0, 400), card('d', 0, 400)] } as never)
    s.registerOptionNumbering(['a', 'b', 'c', 'd'])
    expect(useCanvasStore.getState().optionNumberingProvisional).toEqual(['c', 'd'])
    useCanvasStore.setState({ nodes: [card('a', 0), card('b', 300), card('c', 900, 400), card('d', 600, 400)] } as never)
    s.registerOptionNumbering(['a', 'b', 'c', 'd'])
    expect(useCanvasStore.getState().optionNumbering).toEqual({ b: 1, a: 2, d: 3, c: 4 })
  })

  it('resets on resetCanvas (fresh decision, fresh ordinal history)', () => {
    useCanvasStore.getState().registerOptionNumbering(['opt-a'])
    useCanvasStore.setState({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'x' } }],
      edges: [],
    } as never)
    useCanvasStore.getState().resetCanvas()
    expect(useCanvasStore.getState().optionNumbering).toEqual({})
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
