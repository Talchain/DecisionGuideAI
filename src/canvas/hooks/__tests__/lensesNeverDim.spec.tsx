/**
 * ⛔ NOTHING DIMS (vision spec §2e/§3, 23 Oct 2026): "A lens re-weights marks that already exist … It never fades cards",
 * and a selected option changes only its own card and routes. Each row binds the lens's marks by id and asserts that no
 * card or link is set aside; each has a contrast that the lens still marks something.
 */
import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, cleanup, act, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { useLensFilter } from '../useLensFilter'
import { usePathHighlight } from '../usePathHighlight'
import { useWhatIfStore } from '../../stores/whatIfStore'

const worksheet = { current: null as unknown }
vi.mock('../../artefacts/lenses', async (orig) => ({
  ...(await orig<object>()),
  useCurrentPremortemWorksheet: () => worksheet.current,
}))

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const link = (source: string, target: string): Edge => ({ id: `${source}>${target}`, source, target, data: { weight: 0.5, weightSource: 'user' } })

function Filter() { useLensFilter(); return null }
const lens = () => useCanvasStore.getState().lens

beforeEach(() => {
  worksheet.current = null
  useCanvasStore.setState({
    nodes: [node('opt_a', 'option'), node('opt_b', 'option'), node('price', 'factor'), node('spend', 'factor'), node('reach', 'factor'), node('goal', 'goal')],
    edges: [link('opt_a', 'price'), link('opt_b', 'spend'), link('price', 'goal'), link('spend', 'goal'), link('reach', 'goal')],
    ceeAnalysisReady: { goal_node_id: 'goal', options: [{ id: 'opt_a', interventions: { price: 1 } }, { id: 'opt_b', interventions: { spend: 1 } }] },
    outcomeNodeId: 'goal',
    results: {
      status: 'complete', progress: 100,
      report: { factor_sensitivity: [{ factor_id: 'spend', sensitivity: 0.9 }, { factor_id: 'price', sensitivity: 0.4 }, { factor_id: 'reach', sensitivity: 0.1 }] },
    },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  useCanvasStore.setState((s) => ({ lens: { ...s.lens, active: 'full', selectedOptionId: null, _restsOn: new Map(), _emphasisEdgeIds: new Set(), _dimmedNodeIds: new Set(), _dimmedEdgeIds: new Set() } }) as never)
})
afterEach(() => cleanup())

const nothingDims = () => {
  assert.equal(lens()._dimmedNodeIds.size, 0, 'no card set aside')
  assert.equal(lens()._dimmedEdgeIds.size, 0, 'no link set aside')
}

describe('lenses re-weight, never dim', () => {
  it('option isolation: the option’s routes take the emphasis; every other card and link stays at rest', () => {
    render(<Filter />)
    act(() => useCanvasStore.getState().setLens('option', 'opt_a'))
    nothingDims()
    assert.deepEqual([...lens()._emphasisEdgeIds].sort(), ['opt_a>price', 'price>goal'])
    // CONTRAST: the other option's route is not emphasised.
    assert.equal(lens()._emphasisEdgeIds.has('opt_b>spend'), false)
  })

  it('What would change: rank chips 1–3 on the links leaving the factors the result moves with most; nothing fades', () => {
    render(<Filter />)
    act(() => useCanvasStore.getState().setLens('what_changes'))
    nothingDims()
    const chip = (id: string) => lens()._restsOn.get(`edge:${id}`)
    assert.equal(chip('spend>goal')?.n, 1)
    assert.equal(chip('price>goal')?.n, 2)
    assert.equal(chip('reach>goal')?.n, 3)
    assert.equal(chip('spend>goal')?.label, '1: what the result moves with most · Yours')
    // CONTRAST: option links carry no rank (an option is not a factor the result moves with).
    assert.equal(chip('opt_b>spend'), undefined)
    // The chips leave with the lens.
    act(() => useCanvasStore.getState().setLens('full'))
    assert.equal(lens()._restsOn.size, 0)
  })

  it('If it failed: the links the stories rest on take the emphasis; nothing dims', () => {
    worksheet.current = { rows: [{ option_id: 'opt_a', grounding: { kind: 'link', ids: ['price>goal', 'price'] } }] }
    render(<Filter />)
    act(() => useCanvasStore.getState().setLens('premortem'))
    nothingDims()
    assert.deepEqual([...lens()._emphasisEdgeIds], ['price>goal'])
  })

  it('What if: a held change dims nothing (its own mark says it)', () => {
    render(<Filter />)
    act(() => {
      useWhatIfStore.getState().hold({ scenarioId: 's1', baseGraphHash: 'h1', nodeId: 'price', label: 'Price', saved: 1, whatIf: 2, unit: '' } as never)
      useCanvasStore.getState().setLens('what_if')
    })
    nothingDims()
    act(() => useWhatIfStore.getState().clear())
    assert.equal(lens()._emphasisEdgeIds.size, 0)
  })
})

describe('a selected option card changes only itself and its routes', () => {
  const select = (id: string) => useCanvasStore.setState({ selection: { nodeIds: new Set([id]), edgeIds: new Set(), anchorPosition: null } } as never)

  it('its routes light at full weight; no other card or link greys', () => {
    select('opt_a')
    renderHook(() => usePathHighlight())
    const s = useCanvasStore.getState()
    assert.equal(s.highlightedEdges.has('price>goal'), true)
    assert.equal(s.dimmedNodeIds.size, 0)
    assert.equal(s.dimmedEdgeIds.size, 0)
  })

  it('an option with no route yet: still nothing greys', () => {
    useCanvasStore.setState({ ceeAnalysisReady: { goal_node_id: 'goal', options: [] } } as never)
    select('opt_a')
    renderHook(() => usePathHighlight())
    assert.equal(useCanvasStore.getState().dimmedNodeIds.size, 0)
    assert.equal(useCanvasStore.getState().dimmedEdgeIds.size, 0)
  })

  it('CONTRAST: a selected factor keeps its path focus (outside this change)', () => {
    select('reach')
    renderHook(() => usePathHighlight())
    assert.equal(useCanvasStore.getState().dimmedNodeIds.has('opt_a'), true)
  })
})
