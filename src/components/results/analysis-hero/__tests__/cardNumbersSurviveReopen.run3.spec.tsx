/**
 * ⭐ Run-3 judge U7 (live/runs/2026-10-12T153555Z; UI a9a5c26f, CEE 3fdf0f38): the card numbers changed on reopen while
 * the saved model and result did not.
 *   - hiring step 18: "O2 Hire two developers" → "O3", "O3 Continue as now" → "O2", and three factors renumbered;
 *   - marketing step 11: "F2 Campaign plan quality" → "F1", "F1 Founder time on campaign" → "F2".
 *
 * The mechanism, from the served rows (not inferred):
 *   - the session's option numbers are the SERVED graph's option order (hire_a_tech_lead, hire_two_developers,
 *     continue_as_now), not the canvas reading order (Continue as now sits in the middle). They were registered while
 *     the drafted cards still sat stacked at {0,0}, where a tie falls back to the order passed, and the append-only
 *     registry kept them;
 *   - the factor row was never seated in influence order in the session (hiring's #1 Delivery capacity sat last; marketing's
 *     top driver Campaign plan quality sat second). The seat ran on an unlaid-out row and did not run again when the
 *     layout landed.
 * A reopen lays the graph out first, so both read the laid-out model. Each case below runs the SESSION order (the Results
 * hook mounts on the stacked graph, then the layout lands) and the REOPEN order (the layout lands first); both must show
 * the numbers the reopen showed. The fixtures are the served read bodies before each reopen; `_capture` carries the
 * ordinals both sides showed (reopen.json) and the session's layout, read off its last Run screenshot (order only).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import hiring from './fixtures/run3-hiring-step18-served-read.json'
import marketing from './fixtures/run3-marketing-step11-served-read.json'
import { applyRealRead } from './helpers/realScenarioRead'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import { nodeTypeNumber, NODE_NUMBER_PREFIX, type NumberedNodeKind } from '../../../../canvas/nodes/shared/nodeTypeOrdinal'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'

type Capture = {
  ordinals_before_reopen: Record<string, string>
  ordinals_after_reopen: Record<string, string>
  session_layout: Record<string, [number, number]>
}
const CASES = [
  ['hiring step 18', hiring],
  ['marketing step 11', marketing],
] as const

beforeEach(() => { useCanvasStore.setState({ optionNumbering: {}, layoutVersion: 0, pendingLayout: false } as never) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

const capture = (read: unknown) => (read as { _capture: Capture })._capture

/** The layout lands: the session's on-screen positions, as one product layout (`layoutVersion` moves). */
function layoutLands(layout: Capture['session_layout']) {
  act(() => {
    const s = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: s.nodes.map(n => (layout[n.id] ? { ...n, position: { x: layout[n.id][0], y: layout[n.id][1] } } : n)),
      layoutVersion: s.layoutVersion + 1,
      pendingLayout: false,
    } as never)
  })
}

/** What each card wears: the store's own number for its kind, with its prefix (BaseNode's `nodeTypeNumber`). */
function cardNumbers(ids: readonly string[]): Record<string, string> {
  const { nodes, optionNumbering } = useCanvasStore.getState()
  return Object.fromEntries(ids.map(id => {
    const kind = nodes.find(n => n.id === id)?.type as NumberedNodeKind
    return [id, `${NODE_NUMBER_PREFIX[kind]}${nodeTypeNumber(kind, id, nodes as never, optionNumbering)}`]
  }))
}

describe('U7: the card numbers a reopen shows are the numbers the session showed', () => {
  it.each(CASES)('CONTROL, %s: the captured ordinals differ across the reopen, and every numbered card has a place', (_name, read) => {
    const c = capture(read)
    expect(c.ordinals_after_reopen).not.toEqual(c.ordinals_before_reopen)
    expect(Object.keys(c.session_layout).sort()).toEqual(Object.keys(c.ordinals_after_reopen).sort())
  })

  it('CONTROL, hiring: the session\'s option numbers are the served graph\'s option order, not the row\'s', () => {
    const c = capture(hiring)
    const served = (hiring as { graph: { nodes: { id: string; kind: string }[] } }).graph.nodes.filter(n => n.kind === 'option').map(n => n.id)
    const byNumber = (ords: Record<string, string>) => served.slice().sort((a, b) => ords[a].localeCompare(ords[b]))
    expect(byNumber(c.ordinals_before_reopen)).toEqual(served)
    const rowOrder = served.slice().sort((a, b) => c.session_layout[a][0] - c.session_layout[b][0])
    expect(rowOrder).not.toEqual(served)
    expect(byNumber(c.ordinals_after_reopen)).toEqual(rowOrder)
  })

  it.each(CASES)('REOPEN order, %s (the layout lands, then the Results hook mounts): the reopen\'s numbers', async (_name, read) => {
    const c = capture(read)
    await applyRealRead({ j: read })
    layoutLands(c.session_layout)
    renderHook(() => useResultsSectionData())
    expect(cardNumbers(Object.keys(c.ordinals_after_reopen))).toEqual(c.ordinals_after_reopen)
  })

  it.each(CASES)('⭐ SESSION order, %s (the Results hook mounts on the stacked graph, then the layout lands): the same numbers', async (_name, read) => {
    const c = capture(read)
    await applyRealRead({ j: read })
    renderHook(() => useResultsSectionData())
    layoutLands(c.session_layout)
    expect(cardNumbers(Object.keys(c.ordinals_after_reopen))).toEqual(c.ordinals_after_reopen)
  })

  it('once the cards have read their laid-out row, a later layout renumbers no option (append-only, as before)', async () => {
    const c = capture(hiring)
    await applyRealRead({ j: hiring })
    layoutLands(c.session_layout)
    renderHook(() => useResultsSectionData())
    const numbered = { ...useCanvasStore.getState().optionNumbering }
    // A later product layout swaps the two outer options' places.
    const moved = { ...c.session_layout, hire_a_tech_lead: c.session_layout.hire_two_developers, hire_two_developers: c.session_layout.hire_a_tech_lead }
    layoutLands(moved)
    expect(useCanvasStore.getState().optionNumbering).toEqual(numbered)
  })
})
