/**
 * THE MODEL LIGHTS UP WHAT THE AI IS TALKING ABOUT, lease (a) (DL #85 5939855664; Paul's investor-UX ask).
 *
 * Every "What changed" row (the canvas pill's head and detail rows, and the Compare tab's rows) lights ITS element on the
 * canvas on hover / keyboard focus and focuses it on click, bound by IDENTITY (the row's node id, or the edge found by
 * its two end ids). Fixtures are 0.70 link rows that must parse against the contract.
 *
 * Rows:
 *   L1  pill head row: hover → exactly the row's edge is highlighted; leave → nothing; keyboard focus/blur the same;
 *       click → `focusEdgeById(<that edge>)`.
 *   L2  pill detail rows: each lights its own edge.
 *   L3  Compare tab rows: hover/focus light the row's edge; click focuses it.
 *   L4  IDENTITY CONTRAST: two links whose ends carry the SAME labels. Only the link whose END IDS match the row lights.
 *   L5  NO-REF CONTRAST: a row whose ends are not a link on the canvas has no control and lights nothing.
 *   L6  a row that unmounts while hovered (the pill closes) leaves nothing lit.
 *   L7  edge focus moves the camera ONLY when the link is not already comfortably in view (no camera jumps); an
 *       unmeasurable camera fails open; an unknown edge does nothing.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta } from '@talchain/schemas/fixtures'
import { useCanvasStore } from '../../store'
import { RunChangesSummary, RUN_CHANGES_SUMMARY_TESTID } from '../../components/RunChangesSummary'
import { CompareRunPairBody } from '../../compare-tab/CompareRunPairBody'
import { WHATS_CHANGED_TESTID } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { focusEdgeById } from '../../utils/focusHelpers'
import { computeEdgeFocusPlan } from '../../utils/focusNeighbourhood'
import { MIN_READABLE_ZOOM, type FocusCamera } from '../../utils/cameraComfort'

vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const P = RUN_CHANGES_SUMMARY_TESTID

// Two links whose ends carry the SAME labels ("Team size" → "Revenue"): only ids tell them apart.
const NODES = [
  { id: 'f_team_a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team size' } },
  { id: 'f_rev_a', type: 'factor', position: { x: 300, y: 0 }, data: { label: 'Revenue' } },
  { id: 'f_team_b', type: 'factor', position: { x: 0, y: 200 }, data: { label: 'Team size' } },
  { id: 'f_rev_b', type: 'factor', position: { x: 300, y: 200 }, data: { label: 'Revenue' } },
  { id: 'opt_a', type: 'option', position: { x: 0, y: 400 }, data: { label: 'Keep' } },
  { id: 'opt_b', type: 'option', position: { x: 300, y: 400 }, data: { label: 'Change' } },
]
const EDGES = [
  { id: 'e_a', source: 'f_team_a', target: 'f_rev_a' },
  { id: 'e_b', source: 'f_team_b', target: 'f_rev_b' },
]

const accept = (from: string, to: string) => ({
  entity_kind: 'link', entity_id: `${from}->${to}`, link: { from, to },
  field: 'sizing', before: { raw: 'placeholder' }, after: { raw: 'olumi_accepted' }, change: 'changed',
})

function delta(changes: unknown[]): RunDelta {
  const d = { ...maximalRunDelta, input_coverage: 'complete', input_changes: changes }
  const parsed = RunDeltaSchema.safeParse(d)
  expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true)
  return d as unknown as RunDelta
}

function seed(changes: unknown[]): void {
  useCanvasStore.setState({
    runDelta: { delta: delta(changes), analysisHash: 'hash-A', scenarioId: 'scn-1' },
    currentScenarioId: 'scn-1',
    nodes: NODES,
    edges: EDGES,
    results: { status: 'complete', hash: 'hash-A', report: {} },
  } as never)
  useCanvasStore.getState().setHighlightedNodes([])
  useCanvasStore.getState().setHighlightedEdges([])
}

const lit = () => ({
  edges: [...useCanvasStore.getState().highlightedEdges].sort(),
  nodes: [...useCanvasStore.getState().highlightedNodes].sort(),
})
const NOTHING = { edges: [], nodes: [] }

beforeEach(() => { vi.mocked(focusEdgeById).mockClear() })
afterEach(() => { cleanup() })

describe('L1 · the pill head row lights its own link', () => {
  it('hover / leave, keyboard focus / blur, click → focus', () => {
    seed([accept('f_team_b', 'f_rev_b')])
    render(<RunChangesSummary />)
    const head = screen.getByTestId(`${P}-focus`)
    expect(head).toHaveAttribute('data-canvas-target', 'edge:e_b')
    fireEvent.mouseEnter(head)
    expect(lit()).toEqual({ edges: ['e_b'], nodes: [] })
    fireEvent.mouseLeave(head)
    expect(lit()).toEqual(NOTHING)
    fireEvent.focus(head)
    expect(lit()).toEqual({ edges: ['e_b'], nodes: [] })
    fireEvent.blur(head)
    expect(lit()).toEqual(NOTHING)
    fireEvent.click(head)
    expect(vi.mocked(focusEdgeById)).toHaveBeenCalledWith('e_b')
  })
})

describe('L2 · each pill detail row lights its own link', () => {
  it('two Accepts: the first row lights e_a, the second e_b', () => {
    seed([accept('f_team_a', 'f_rev_a'), accept('f_team_b', 'f_rev_b')])
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${P}-why-toggle`))
    const rows = screen.getAllByTestId(`${P}-detail-focus`)
    expect(rows.map((r) => r.getAttribute('data-canvas-target'))).toEqual(['edge:e_a', 'edge:e_b'])
    fireEvent.mouseEnter(rows[1])
    expect(lit()).toEqual({ edges: ['e_b'], nodes: [] })
    fireEvent.mouseLeave(rows[1])
    fireEvent.mouseEnter(rows[0])
    expect(lit()).toEqual({ edges: ['e_a'], nodes: [] })
  })
})

describe('L3 · the Compare tab rows light their link', () => {
  it('hover / focus light it, leave clears, click focuses', () => {
    seed([accept('f_team_b', 'f_rev_b')])
    render(<CompareRunPairBody responseHash="hash-A" />)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row-focus`)
    fireEvent.mouseEnter(row)
    expect(lit()).toEqual({ edges: ['e_b'], nodes: [] })
    fireEvent.mouseLeave(row)
    expect(lit()).toEqual(NOTHING)
    fireEvent.focus(row)
    expect(lit()).toEqual({ edges: ['e_b'], nodes: [] })
    fireEvent.blur(row)
    fireEvent.click(row)
    expect(vi.mocked(focusEdgeById)).toHaveBeenCalledWith('e_b')
  })
})

describe('L4 · IDENTITY CONTRAST: same labels, different ids', () => {
  it('the row names f_team_b → f_rev_b: e_b lights, never e_a (whose ends read the same words)', () => {
    seed([accept('f_team_b', 'f_rev_b')])
    render(<RunChangesSummary />)
    fireEvent.mouseEnter(screen.getByTestId(`${P}-focus`))
    expect(lit().edges).toEqual(['e_b'])
    expect(lit().edges).not.toContain('e_a')
  })
})

describe('L5 · NO-REF CONTRAST: nothing on the canvas stands for the row', () => {
  it('a link whose ends are not joined on the canvas: no control on the pill or in Compare, and nothing lights', () => {
    seed([accept('f_team_a', 'f_rev_b')])
    render(<RunChangesSummary />)
    expect(screen.queryByTestId(`${P}-focus`)).toBeNull()
    fireEvent.mouseEnter(screen.getByTestId(`${P}-line`))
    expect(lit()).toEqual(NOTHING)
    cleanup()
    render(<CompareRunPairBody responseHash="hash-A" />)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row`)
    expect(within(row).queryByRole('button')).toBeNull()
    fireEvent.mouseEnter(row)
    expect(lit()).toEqual(NOTHING)
  })
})

describe('L6 · a row that goes away while hovered leaves nothing lit', () => {
  it('unmount during hover clears the highlight it set', () => {
    seed([accept('f_team_b', 'f_rev_b')])
    const { unmount } = render(<RunChangesSummary />)
    fireEvent.mouseEnter(screen.getByTestId(`${P}-focus`))
    expect(lit().edges).toEqual(['e_b'])
    unmount()
    expect(lit()).toEqual(NOTHING)
  })
})

describe('L7 · edge focus: no camera jump when the link is already in view', () => {
  const nodes = [
    { id: 'a', position: { x: 100, y: 100 } },
    { id: 'b', position: { x: 500, y: 100 } },
    { id: 'far', position: { x: 4000, y: 100 } },
  ]
  const edges = [
    { id: 'e_in', source: 'a', target: 'b' },
    { id: 'e_out', source: 'a', target: 'far' },
  ]
  const camera: FocusCamera = {
    viewport: { x: 0, y: 0, zoom: Math.max(1, MIN_READABLE_ZOOM) },
    paneWidth: 1280,
    paneHeight: 800,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
  } as FocusCamera
  it('both ends comfortably visible → the camera does not move', () => {
    expect(computeEdgeFocusPlan('e_in', nodes, edges, camera)?.moveCamera).toBe(false)
  })
  it('an end off screen → it moves, to the link midpoint', () => {
    expect(computeEdgeFocusPlan('e_out', nodes, edges, camera)).toEqual({ midX: 2050, midY: 100, moveCamera: true })
  })
  it('an unmeasurable camera fails open (moves); an unknown edge does nothing', () => {
    expect(computeEdgeFocusPlan('e_in', nodes, edges, null)?.moveCamera).toBe(true)
    expect(computeEdgeFocusPlan('e_missing', nodes, edges, camera)).toBeNull()
  })
})
