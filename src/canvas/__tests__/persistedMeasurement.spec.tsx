/**
 * ⛔⛔ A RESTORED BOARD'S CARD WIDTHS MUST COME FROM THIS SESSION'S MEASUREMENT,
 * NEVER FROM HEIGHTS PERSISTED BY AN EARLIER ONE (canvas audit edit-structure/F1,
 * the sticky half).
 *
 * The autosave stores React Flow nodes as they are, `measured` included. On the
 * served build a reload after one hand-moved card drew every factor at 191; the
 * heights React Flow measured AT 191 (Engineering Capacity 323) were autosaved,
 * and on the next reload `useRestoredLayoutWidth` ran straight away on them —
 * its "wait until a card has been measured" latch was satisfied before React Flow
 * had measured anything. The tall stale card spanned into the sub-row below, the
 * bound fell to 124, and the board drew at 191 again. Moving the card back to its
 * landing x did not repair it: the loop fed itself.
 *
 * ⭐ The spec: a `measured` value read back from storage describes a DOM that no
 * longer exists (another session, another width, another zoom), so the restore
 * boundary drops it and React Flow measures the cards afresh — exactly as it does
 * for a fresh draft. Asserted on BOTH restore routes (`hydrateGraphSlice` and the
 * store's `loadScenario`), and end to end through the hook: no per-kind width is
 * published before this session has measured, and the one published after is the
 * landing width.
 *
 * ⚠ 30 SEP 2026 (Paul, "wider and shorter"): the landing width of THIS served
 * board is no longer 248. A tier's fresh width is now its fair share of
 * `ROW_BUDGET_W` (these factors 4 + 4 → 325), wider than the board's saved 296
 * stride allows, so `solveRestoredCardWidths` bounds it to 296 − 24 − 24 = 248 (the
 * stride minus the VISIBLE gap, ELK padding + sibling gap): the board reopens exactly as saved. The
 * cases bind to that derived landing width — and, as the discriminator the
 * defect needs, to NOT the floor the broken bound collapsed to.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useLayoutStore } from '../layoutStore'
import { useRestoredLayoutWidth } from '../hooks/useRestoredLayoutWidth'
import * as scenarios from '../store/scenarios'
import { LAYOUT_NODE_GAP, LAYOUT_PADDING_X, NODE_LAYOUT_MIN_W } from '../utils/nodeLayoutConstants'
import { solveLayoutCardWidths } from '../utils/layout'

type Row = readonly [id: string, kind: string, x: number, y: number, hAt248: number, hAt191: number]

/** Served `build-vs-buy` (skeptic-F1 JSON): landing heights at 248, and the
 *  heights the broken reload measured at 191 — what the autosave carried. */
const BVB: readonly Row[] = [
  ['dec_billing', 'decision', 472, 24, 93, 93],
  ['opt_build', 'option', 172, 177, 226, 226],
  ['opt_stripe', 'option', 468, 177, 226, 226],
  ['opt_vendor', 'option', 764, 177, 226, 226],
  ['opt_status_quo', 'option', 1060, 177, 208, 207],
  ['fac_platform_migration', 'factor', 320, 464, 186, 233],
  ['fac_eng_capacity', 'factor', 616, 464, 250, 323],
  ['fac_billing_complexity', 'factor', 912, 464, 186, 186],
  ['fac_dev_time', 'factor', 1208, 464, 200, 223],
  ['fac_build_indicator', 'factor', 172, 758, 223, 223],
  ['fac_stripe_indicator', 'factor', 468, 758, 223, 223],
  ['fac_vendor_indicator', 'factor', 764, 758, 223, 223],
  ['fac_vendor_cost', 'factor', 1060, 758, 142, 186],
  ['risk_eng_overload', 'risk', 24, 1042, 188, 188],
  ['out_delivery_speed', 'outcome', 320, 1042, 144, 144],
  ['risk_billing_errors', 'risk', 616, 1042, 164, 164],
  ['out_billing_accuracy', 'outcome', 912, 1042, 144, 144],
  ['risk_vendor_lock', 'risk', 1208, 1042, 164, 164],
  ['goal_billing', 'goal', 472, 1290, 93, 93],
]

const widthOf = (kind: string, repeated: number) => (kind === 'decision' || kind === 'goal' ? 720 : repeated)

/** The board as the autosave holds it after the broken reload: measured at 191. */
function persistedBoard(): Node[] {
  return BVB.map(([id, kind, x, y, , h191]) => ({
    id, type: kind, position: { x, y }, data: { label: id }, zIndex: id === 'opt_vendor' ? 2 : undefined,
    measured: { width: widthOf(kind, 191), height: h191 },
  })) as Node[]
}

/** What React Flow reports in THIS session once the cards are drawn at 248. */
function measuredThisSession(nodes: Node[]): Node[] {
  const byId = new Map(BVB.map((r) => [r[0], r]))
  return nodes.map((n) => {
    const r = byId.get(n.id)!
    return { ...n, measured: { width: widthOf(r[1], 248), height: r[4] } }
  })
}

/** The served board's same-row stride (248 + 48 at landing) and the gap the bound keeps (max(24, spacing 15)). */
const LANDING_STRIDE = 296
const GAP = Math.max(LAYOUT_NODE_GAP, 15)
/** The factor width the UNMOVED served board restores at: its fresh fair share
 *  bounded by its own stride less the visible gap — min(325, 296 − 24 − 24) = 248: exactly as saved. */
function landingFactorWidth(): number {
  return Math.min(solveLayoutCardWidths(persistedBoard(), { direction: 'DOWN', spacing: 15 }).factor, LANDING_STRIDE - GAP - LAYOUT_PADDING_X)
}

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.getState().resetCanvas()
  act(() => {
    useLayoutStore.setState({ layoutNodeWidth: null, layoutCardWidths: null, direction: 'DOWN', respectLocked: true, nodeSpacing: 15 } as never)
  })
})

describe('a persisted `measured` never reaches the restored board (F1, sticky half)', () => {
  it('⛔ hydrate route: the store holds no persisted measurement — and nothing else is lost', () => {
    const persisted = persistedBoard()
    act(() => { useCanvasStore.getState().hydrateGraphSlice({ nodes: persisted, edges: [] }) })
    const nodes = useCanvasStore.getState().nodes
    // Positive control first: the restore happened, by identity.
    expect(nodes.map((n) => n.id)).toEqual(BVB.map((r) => r[0]))
    for (const n of nodes) {
      expect((n as { measured?: unknown }).measured, `${n.id} kept a measurement from another session`).toBeUndefined()
    }
    // Everything the user authored survives: position, kind, label, paint order.
    const vendor = nodes.find((n) => n.id === 'opt_vendor')!
    expect(vendor.position).toEqual({ x: 764, y: 177 })
    expect(vendor.type).toBe('option')
    expect((vendor.data as { label: string }).label).toBe('opt_vendor')
    expect(vendor.zIndex).toBe(2)
    // The persisted object itself is not mutated.
    expect((persisted[0] as { measured?: unknown }).measured).toBeDefined()
  })

  it('⛔ loadScenario route: a saved local scenario restores without its persisted measurement', () => {
    const saved = scenarios.createScenario({ name: 'bvb', nodes: persistedBoard(), edges: [] })
    // Precondition: the saved record really does carry the stale measurement.
    expect((scenarios.getScenario(saved.id)!.graph.nodes[0] as { measured?: unknown }).measured).toBeDefined()
    act(() => { expect(useCanvasStore.getState().loadScenario(saved.id)).toBe(true) })
    const nodes = useCanvasStore.getState().nodes
    expect(nodes.length).toBe(BVB.length)
    for (const n of nodes) expect((n as { measured?: unknown }).measured, n.id).toBeUndefined()
  })

  it('⛔ END TO END: the per-kind width waits for THIS session to measure, then lands at the landing width (30 Sep: 248, exactly as saved)', () => {
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({ nodes: persistedBoard(), edges: [], currentScenarioId: 'bvb' })
    })
    const { rerender } = renderHook(() => useRestoredLayoutWidth())
    // Before React Flow has measured anything in this session there is no
    // evidence, so no per-kind record — the stale heights must not decide it.
    expect(useLayoutStore.getState().layoutCardWidths, 'a per-kind width was published from another session’s heights').toBeNull()

    // React Flow measures the cards as they are drawn now.
    act(() => { useCanvasStore.setState({ nodes: measuredThisSession(useCanvasStore.getState().nodes) } as never) })
    rerender()
    // RE-PINNED 30 Sep 2026: was `toBe(REPEATED_CARD_W)` (248).
    expect(useLayoutStore.getState().layoutCardWidths?.factor).toBe(landingFactorWidth())
    expect(useLayoutStore.getState().layoutCardWidths?.factor).toBe(248)
    expect(useLayoutStore.getState().layoutCardWidths?.factor).toBeGreaterThan(NODE_LAYOUT_MIN_W)
  })

  /**
   * ⛔ FOUND IN THE BROWSER, NOT BY THE CASE ABOVE. With the persisted heights
   * gone, measurement arrives in batches, and the latch read "ANY card
   * measured". The served nudge-and-reload then published factor 190.88: the
   * factors were not measured yet, so every factor pair fell to `shareARow`'s
   * no-evidence answer ("same row"), the two sub-rows interleaved at a 148
   * stride, and the bound collapsed to the floor. The persisted heights had
   * hidden this — they made "any" and "all" the same thing.
   */
  it('⛔ PARTIAL MEASUREMENT: no per-kind width until every card has been measured', () => {
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: persistedBoard().map((n) => (n.id === 'fac_vendor_indicator' ? { ...n, position: { x: 854, y: 758 } } : n)),
        edges: [],
        currentScenarioId: 'bvb-moved',
      })
    })
    const { rerender } = renderHook(() => useRestoredLayoutWidth())
    // Every card but the factors measured — the batch the browser delivered first.
    const all = measuredThisSession(useCanvasStore.getState().nodes)
    act(() => {
      useCanvasStore.setState({
        nodes: all.map((n) => (n.type === 'factor' ? { ...n, measured: undefined } : n)),
      } as never)
    })
    rerender()
    expect(useLayoutStore.getState().layoutCardWidths, 'the bound was taken before the cards it bounds were measured').toBeNull()
    act(() => { useCanvasStore.setState({ nodes: all } as never) })
    rerender()
    // RE-PINNED 30 Sep 2026: was `toBe(REPEATED_CARD_W)` (248). The defect this
    // guards published the FLOOR (190.88 then); the landing width is well above it.
    expect(useLayoutStore.getState().layoutCardWidths?.factor).toBe(landingFactorWidth())
    expect(useLayoutStore.getState().layoutCardWidths?.factor).toBeGreaterThan(NODE_LAYOUT_MIN_W)
  })
})
