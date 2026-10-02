/**
 * ⭐ WHERE THIS CHANGE FLOWS (DL GO #85 5947426886). On a C1 pair, a Changes row click lights its element's route
 * through the model's own links to the Goal; every other pair is unchanged.
 *
 * Served before (`b1fa145b`, R3's C1 pair: one link changed slight → strong): the row click selected the link and lit
 * only its two ends, and the Changes view's subdue kept 11/16 cards and 18/19 links dim, the route among them.
 *
 * Rows (every assertion binds element ids, never a count):
 *   R1  usePathHighlight, real store: a C1 route request on the selected LINK → the link + its downstream route to the
 *       goal are highlighted, the route's cards stay, everything else dims. CONTROL: no request → today's
 *       endpoints-only focus with no path claimed. IDENTITY: a request for another link does nothing to this one.
 *   R2  `selectRunChangesRouteLit`: true only while the requested element IS the selection (link or card).
 *   R3  the Changes subdue yields while the route is lit, on a card (`linkOnlyChangeSubdues.spec` L2b) and a link
 *       (`StyledEdge.filterCompose.spec`); CONTROL: requested but not selected → subdued as before.
 *   R4  surfaces: a C1 row click records the request (Compare tab and the pill); a C2 row click records nothing; the
 *       pair turning non-C1 or the surface unmounting releases it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta } from '@talchain/schemas/fixtures'
import { useCanvasStore } from '../../store'
import type { EdgeData } from '../../domain/edges'
import { usePathHighlight } from '../../hooks/usePathHighlight'
import { selectRunChangesRouteLit, useRunChangesRouteFocus } from '../routeFocus'
import { RunChangesSummary, RUN_CHANGES_SUMMARY_TESTID } from '../../components/RunChangesSummary'
import { CompareRunPairBody } from '../../compare-tab/CompareRunPairBody'
import { WHATS_CHANGED_TESTID } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { focusEdgeById } from '../../utils/focusHelpers'

vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const node = (id: string, type: string): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, kind: type } })
const edge = (id: string, source: string, target: string): Edge<EdgeData> => ({ id, source, target, data: {} as EdgeData })

//   opt ──e_opt──> f_a ──e_ab (CHANGED)──> f_b ──e_bg──> goal
//                   └──e_ac──> f_c                  far ──e_fg──> goal
const NODES = [node('opt', 'option'), node('f_a', 'factor'), node('f_b', 'factor'), node('f_c', 'factor'), node('far', 'factor'), node('goal', 'goal')]
const EDGES = [edge('e_opt', 'opt', 'f_a'), edge('e_ab', 'f_a', 'f_b'), edge('e_bg', 'f_b', 'goal'), edge('e_ac', 'f_a', 'f_c'), edge('e_fg', 'far', 'goal')]

const sorted = (s: ReadonlySet<string>) => [...s].sort()
const state = () => useCanvasStore.getState()
const selectEdge = (id: string | null) =>
  useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(id ? [id] : []), anchorPosition: null } })

let original: ReturnType<typeof useCanvasStore.getState>
beforeEach(() => {
  original = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: NODES,
    edges: EDGES,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    highlightedEdges: new Set(),
    dimmedNodeIds: new Set(),
    dimmedEdgeIds: new Set(),
    focusDimSourceId: null,
    runChangesRouteFocusId: null,
    ceeAnalysisReady: null,
  })
  vi.mocked(focusEdgeById).mockClear()
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState(original)
})

describe('R1 · a C1 route request on the selected link lights its route to the goal', () => {
  it('the link + its downstream route highlight; the route stays, everything else dims', () => {
    state().setRunChangesRouteFocus('e_ab')
    selectEdge('e_ab')
    renderHook(() => usePathHighlight())
    expect(sorted(state().highlightedEdges)).toEqual(['e_ab', 'e_bg'])
    expect(sorted(state().dimmedEdgeIds)).toEqual(['e_ac', 'e_fg', 'e_opt'])
    expect(sorted(state().dimmedNodeIds)).toEqual(['f_c', 'far', 'opt'])
  })

  it('CONTROL: no request → the endpoints-only focus, and no path is claimed', () => {
    selectEdge('e_ab')
    renderHook(() => usePathHighlight())
    expect(sorted(state().highlightedEdges)).toEqual([])
    expect(sorted(state().dimmedNodeIds)).toEqual(['f_c', 'far', 'goal', 'opt'])
    expect(sorted(state().dimmedEdgeIds)).toEqual(['e_ac', 'e_bg', 'e_fg', 'e_opt'])
  })

  it('IDENTITY: a request for ANOTHER link leaves this selection endpoints-only', () => {
    state().setRunChangesRouteFocus('e_ac')
    selectEdge('e_ab')
    renderHook(() => usePathHighlight())
    expect(sorted(state().highlightedEdges)).toEqual([])
    expect(sorted(state().dimmedNodeIds)).toEqual(['f_c', 'far', 'goal', 'opt'])
  })

  it('a request that arrives while the link is ALREADY selected still lights the route', () => {
    selectEdge('e_ab')
    renderHook(() => usePathHighlight())
    expect(sorted(state().highlightedEdges)).toEqual([])
    act(() => state().setRunChangesRouteFocus('e_ab'))
    expect(sorted(state().highlightedEdges)).toEqual(['e_ab', 'e_bg'])
  })
})

describe('R2 · the route is lit only while the requested element IS the selection', () => {
  it('link and card ids; null and an unselected id are not lit', () => {
    const sel = (nodeIds: string[], edgeIds: string[]) => ({ nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds) })
    expect(selectRunChangesRouteLit({ runChangesRouteFocusId: 'e_ab', selection: sel([], ['e_ab']) })).toBe(true)
    expect(selectRunChangesRouteLit({ runChangesRouteFocusId: 'f_a', selection: sel(['f_a'], []) })).toBe(true)
    expect(selectRunChangesRouteLit({ runChangesRouteFocusId: 'e_ab', selection: sel([], ['e_bg']) })).toBe(false)
    expect(selectRunChangesRouteLit({ runChangesRouteFocusId: null, selection: sel([], ['e_ab']) })).toBe(false)
    expect(selectRunChangesRouteLit({ runChangesRouteFocusId: 'e_ab' })).toBe(false)
  })
})

// ── R4 · the surfaces ───────────────────────────────────────────────────────────────────────────────────────────
const SURFACE_NODES = [
  { id: 'f_team', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team size' } },
  { id: 'f_rev', type: 'factor', position: { x: 300, y: 0 }, data: { label: 'Revenue' } },
]
const SURFACE_EDGES = [{ id: 'e_tr', source: 'f_team', target: 'f_rev' }]
const strength = { entity_kind: 'link', entity_id: 'f_team->f_rev', link: { from: 'f_team', to: 'f_rev' }, field: 'strength', before: { raw: 'slight' }, after: { raw: 'strong' }, change: 'changed' }

function delta(c1: boolean): RunDelta {
  const d = c1
    ? { ...maximalRunDelta, input_coverage: 'complete', input_changes: [strength] }
    : {
        ...maximalRunDelta,
        attribution_case: 'C2_unpaired',
        pair_provenance: { ...maximalRunDelta.pair_provenance, seed_equal: false },
        input_coverage: 'complete',
        input_changes: [strength],
      }
  const parsed = RunDeltaSchema.safeParse(d)
  expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true)
  expect(d.attribution_case).toBe(c1 ? 'C1_attributable' : 'C2_unpaired')
  return d as unknown as RunDelta
}
function seed(c1: boolean): void {
  useCanvasStore.setState({
    runDelta: { delta: delta(c1), analysisHash: 'hash-A', scenarioId: 'scn-1' },
    currentScenarioId: 'scn-1',
    nodes: SURFACE_NODES,
    edges: SURFACE_EDGES,
    results: { status: 'complete', hash: 'hash-A', report: {} },
  } as never)
}

describe('R4 · surfaces: C1 rows ask for the route, every other pair is unchanged', () => {
  it('Compare tab, C1: the row click records the request for its link, then focuses it', () => {
    seed(true)
    render(<CompareRunPairBody responseHash="hash-A" />)
    fireEvent.click(screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row-focus`))
    expect(state().runChangesRouteFocusId).toBe('e_tr')
    expect(vi.mocked(focusEdgeById)).toHaveBeenCalledWith('e_tr')
  })

  it('CONTROL · Compare tab, C2: the same row click focuses the link and records NOTHING', () => {
    seed(false)
    render(<CompareRunPairBody responseHash="hash-A" />)
    fireEvent.click(screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row-focus`))
    expect(vi.mocked(focusEdgeById)).toHaveBeenCalledWith('e_tr')
    expect(state().runChangesRouteFocusId).toBeNull()
  })

  it('the pill, C1 vs C2: only the C1 head row records the request', () => {
    seed(true)
    const c1 = render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${RUN_CHANGES_SUMMARY_TESTID}-focus`))
    expect(state().runChangesRouteFocusId).toBe('e_tr')
    c1.unmount()
    expect(state().runChangesRouteFocusId).toBeNull()
    seed(false)
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${RUN_CHANGES_SUMMARY_TESTID}-focus`))
    expect(vi.mocked(focusEdgeById)).toHaveBeenCalledTimes(2)
    expect(state().runChangesRouteFocusId).toBeNull()
  })

  it('releases when the pair stops being C1 and when the surface goes', () => {
    const { rerender, unmount } = renderHook(({ c1 }) => useRunChangesRouteFocus(c1), { initialProps: { c1: true } })
    state().setRunChangesRouteFocus('e_tr')
    rerender({ c1: false })
    expect(state().runChangesRouteFocusId).toBeNull()
    rerender({ c1: true })
    state().setRunChangesRouteFocus('e_tr')
    unmount()
    expect(state().runChangesRouteFocusId).toBeNull()
  })
})
