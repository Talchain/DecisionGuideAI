/**
 * A RECEIPT VALUE EQUAL TO A UI DEFAULT STILL REACHES THE CANVAS — RED-first.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, WITNESSED 23 Sep (scenario 58af9704, CEE's stored row read directly)
 * ─────────────────────────────────────────────────────────────────────────────
 * The user confirmed a link strength of 0.5. CEE stored `strength.mean 0.5` and
 * the applied receipt's `draft_graph` carried it. The CANVAS kept showing the
 * old weight 1.
 *
 * Mechanism: `overlayEdge` decided "the wire supplied this key" by comparing the
 * mapped value against the mapper's synthetic DEFAULT edge. `DEFAULT_EDGE_DATA
 * .weight` is 0.5, so a supplied `strength.mean: 0.5` compared equal to the
 * default and was discarded as "not supplied". Boot hydration was already fixed
 * for exactly this (L61, `mergeServerGraph.edgePresence.spec.ts`); the receipt
 * path had been left on equality on the premise that "a receipt echoes an edit
 * the user just made". That premise is false for a conversational edit: the
 * receipt is the ONLY transport of the edit's result (this module's own header).
 *
 * THE LANE INVARIANT: UI claim = wire receipt = CEE reread = reload.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS PINS
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. A key the wire ACTUALLY SUPPLIES applies when its value differs from the
 *      CANVAS's current value — even when it equals the mapper default.
 *   2. A key the wire does NOT supply never overwrites the canvas.
 *   3. A receipt whose supplied values all equal the canvas is a no-op for
 *      values: no history entry, no counted update. Stamps are metadata and
 *      never trigger a write on their own; a missing validated `serverStrength`
 *      tuple is ACQUIRED (Codex 5798417040), and once it matches too the edge
 *      keeps its object identity.
 *
 * Every case binds the edge by its own id (never a value predicate), and every
 * "did not overwrite" case is made to WRITE something else on the same edge, so
 * the no-op guard cannot make it pass for the wrong reason.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { overlayEdge, reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

const EDGE_ID = 'local-edge-58af'

const NODES = [
  {
    id: 'goal-1',
    type: 'goal',
    position: { x: 400, y: 40 },
    data: { kind: 'goal', label: 'Revenue' },
  },
  {
    id: 'factor-1',
    type: 'factor',
    position: { x: 40, y: 200 },
    data: { kind: 'factor', label: 'Price', observedState: { value: 1 } },
  },
]

const WIRE_NODES = [
  { id: 'goal-1', kind: 'goal', label: 'Revenue' },
  { id: 'factor-1', kind: 'factor', label: 'Price', observed_state: { value: 1 } },
]

function seedEdge(data: Record<string, unknown>): void {
  seedCanvas(NODES, [
    { id: EDGE_ID, source: 'factor-1', target: 'goal-1', type: 'styled', data },
  ])
}

/** Identity-bound: found by its OWN id, never by a value predicate. */
function theEdge(): any {
  const e = useCanvasStore.getState().edges.find((x: any) => x.id === EDGE_ID)
  expect(e, 'the seeded edge must still exist, bound by id').toBeTruthy()
  return e
}

function historyDepth(): number {
  return ((useCanvasStore.getState() as any).history?.past?.length ?? 0) as number
}

function receipt(edge: Record<string, unknown>) {
  return {
    nodes: WIRE_NODES,
    edges: [{ id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', ...edge }],
  } as any
}

beforeEach(() => {
  seedEdge({ weight: 1, direction: 'positive', weightSource: 'user' })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §1 THE WITNESSED DEFECT — a supplied default-equal value lands
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§1 a receipt value equal to the UI default still reaches the canvas', () => {
  it('fixture really collides with the mapper default (asserted, not assumed)', () => {
    expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
    const baseline = mapDraftEdgeToCanvas({ from: '__a__', to: '__b__' }, 0).data
    expect(baseline.weight).toBe(0.5)
    expect(baseline.direction).toBe('positive')
  })

  it.each(['user', 'cee'] as const)(
    'HEADLINE — canvas weight 1 (%s source), receipt strength.mean 0.5 → canvas ends at 0.5',
    (source) => {
      seedEdge({ weight: 1, direction: 'positive', weightSource: source })
      const before = historyDepth()

      const result = reconcileAppliedGraph(receipt({ strength: { mean: 0.5 } }))

      expect(theEdge().data.weight).toBe(0.5)
      expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
      expect(historyDepth(), 'a real change is one undoable history entry').toBe(before + 1)
    },
  )

  it('the witnessed wire shape (user-confirmed, with std/exists/direction) lands too', () => {
    const wire = {
      strength: { mean: 0.5, std: 0.1 },
      exists_probability: 0.9,
      effect_direction: 'positive',
      provenance: { source: 'user_specified' },
    }
    reconcileAppliedGraph(receipt(wire))

    const data = theEdge().data
    const mapped = mapDraftEdgeToCanvas({ from: 'factor-1', to: 'goal-1', ...wire }, 0).data
    expect(data.weight).toBe(0.5)
    // The stamp rides WITH the value it describes, and says what the mapper says.
    expect(data.weightSource).toBe(mapped.weightSource)
    // The server tuple the next strength edit will assert matches the number shown.
    expect(data.serverStrength).toEqual({ mean: 0.5, effect_direction: 'positive' })
  })

  it('the negative twin — strength.mean -0.5 onto a canvas showing -1 lands at magnitude 0.5', () => {
    seedEdge({ weight: 1, direction: 'negative', weightSource: 'cee' })
    reconcileAppliedGraph(receipt({ strength: { mean: -0.5 }, effect_direction: 'negative' }))
    expect(theEdge().data.weight).toBe(0.5)
    expect(theEdge().data.direction).toBe('negative')
  })

  it('the SIGN twin — an explicit effect_direction positive overwrites a canvas negative', () => {
    seedEdge({ weight: 0.9, direction: 'negative', directionSource: 'cee' })
    reconcileAppliedGraph(receipt({ strength: { mean: 0.9 }, effect_direction: 'positive' }))
    expect(theEdge().data.direction).toBe('positive')
  })

  it('the flat strength_mean and bare weight spellings land identically', () => {
    reconcileAppliedGraph(receipt({ strength_mean: 0.5 }))
    expect(theEdge().data.weight).toBe(0.5)

    seedEdge({ weight: 1, direction: 'positive', weightSource: 'user' })
    reconcileAppliedGraph(receipt({ weight: 0.5 }))
    expect(theEdge().data.weight).toBe(0.5)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §2 CONTROLS — what must NOT change
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§2 controls — no-op identity and absence-never-overwrites survive', () => {
  it('(a) a receipt identical to the canvas — values AND server tuple — is a STRICT no-op', () => {
    seedEdge({
      weight: 0.5, direction: 'positive', weightSource: 'user',
      serverStrength: { mean: 0.5, effect_direction: 'positive' },
    })
    const edgesBefore = useCanvasStore.getState().edges
    const edgeBefore = theEdge()
    const before = historyDepth()

    // The wire would stamp 'cee' — METADATA that must not earn a write on an
    // unchanged number. Its tuple already matches, so nothing is acquired.
    const result = reconcileAppliedGraph(
      receipt({ strength: { mean: 0.5 }, effect_direction: 'positive' }),
    )

    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
    expect(theEdge()).toBe(edgeBefore)
    expect(historyDepth()).toBe(before)
    expect(theEdge().data.weightSource, 'the user stamp on an unchanged number survives').toBe('user')
  })

  // ⛔ UPDATED 23 Sep (Codex 5798417040, #1913). This case used to be the one
  // above with no tuple on the canvas, and it expected `serverStrength` to stay
  // UNDEFINED. That expectation encoded the defect: the receipt is the server's
  // proof of the saved value, and without the tuple `buildEdgeStrengthEditEvent`
  // refuses the person's NEXT strength edit until a reload. The tuple is now
  // acquired — and only the tuple: still no history, no counted update, and the
  // user's stamp survives. Full witness: `mergeAppliedGraph.receiptServerStrength.spec.ts`.
  it('(a) a matching receipt on an edge WITHOUT a tuple acquires ONLY the tuple — no history, stamps kept', () => {
    seedEdge({ weight: 0.5, direction: 'positive', weightSource: 'user' })
    const before = historyDepth()

    const result = reconcileAppliedGraph(
      receipt({ strength: { mean: 0.5 }, effect_direction: 'positive' }),
    )

    expect(result).toEqual(counts())
    expect(historyDepth()).toBe(before)
    expect(theEdge().data).toEqual({
      weight: 0.5, direction: 'positive', weightSource: 'user',
      serverStrength: { mean: 0.5, effect_direction: 'positive' },
    })
  })

  // Pins the option-less PRIMITIVE. Both production callers pass
  // `acquireServerStrengthOnNoop` (the receipt since 23 Sep), so this is the
  // strict-identity rule the acquisition is layered on, not the receipt's policy.
  it('(a) the option-less overlayEdge seam is a strict no-op — the SAME reference comes back', () => {
    const existing = {
      id: EDGE_ID, source: 'factor-1', target: 'goal-1',
      // `exists_probability` is its own mapped key beside `beliefExists`; an
      // identical canvas carries both.
      data: { weight: 0.5, direction: 'positive', beliefExists: 0.8, exists_probability: 0.8 },
    }
    const next = overlayEdge(existing, {
      from: 'factor-1', to: 'goal-1',
      strength: { mean: 0.5 }, effect_direction: 'positive', exists_probability: 0.8,
    })
    expect(next).toBe(existing)
  })

  it('(b) a wire edge WITHOUT strength does not reset a canvas weight 0.8 to the 0.5 default', () => {
    seedEdge({ weight: 0.8, direction: 'positive', weightSource: 'user', beliefExists: 0.3 })

    // The receipt DOES change something on this edge (exists_probability), so the
    // overlay writes and the no-op guard cannot mask a default fill-in.
    const result = reconcileAppliedGraph(receipt({ exists_probability: 0.6 }))

    const data = theEdge().data
    expect(data.beliefExists, 'proof the overlay really wrote').toBe(0.6)
    expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
    expect(data.weight).toBe(0.8)
    expect(data.weightSource, 'no stamp for a value the wire never sent').toBe('user')
  })

  it('(c) a wire edge WITHOUT exists_probability does not reset a canvas beliefExists 0.3 to the 0.8 default', () => {
    expect(DEFAULT_EDGE_DATA.beliefExists).toBe(0.8)
    seedEdge({ weight: 1, direction: 'positive', beliefExists: 0.3, beliefExistsSource: 'user' })

    // The strength change forces a write on the same edge.
    reconcileAppliedGraph(receipt({ strength: { mean: 0.7 } }))

    const data = theEdge().data
    expect(data.weight, 'proof the overlay really wrote').toBe(0.7)
    expect(data.beliefExists).toBe(0.3)
    expect(data.beliefExistsSource).toBe('user')
    expect(data).not.toHaveProperty('exists_probability')
  })

  it('(c) a SUPPLIED exists_probability equal to its default (0.8) lands on a canvas showing 0.3', () => {
    seedEdge({ weight: 1, direction: 'positive', beliefExists: 0.3, beliefExistsSource: 'user' })
    reconcileAppliedGraph(receipt({ exists_probability: 0.8 }))
    expect(theEdge().data.beliefExists).toBe(0.8)
    expect(theEdge().data.exists_probability).toBe(0.8)
  })

  it('a wire edge that supplies NOTHING analytical is a no-op, whatever the canvas holds', () => {
    seedEdge({ weight: 0.8, direction: 'negative', beliefExists: 0.3 })
    const edgeBefore = theEdge()
    const result = reconcileAppliedGraph(receipt({}))
    expect(result).toEqual(counts())
    expect(theEdge()).toBe(edgeBefore)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §3 THE TWO CALLERS CANNOT DRIFT
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§3 receipt and boot hydration decide "supplied" by the SAME rule', () => {
  const CORPUS: Array<[string, Record<string, unknown>]> = [
    ['strength.mean at default', { strength: { mean: 0.5 } }],
    ['strength_mean at default', { strength_mean: 0.5 }],
    ['weight at default', { weight: 0.5 }],
    ['explicit positive direction', { strength: { mean: 0.9 }, effect_direction: 'positive' }],
    ['exists_probability at default', { exists_probability: 0.8 }],
    ['belief_exists at default', { belief_exists: 0.8 }],
    ['nothing supplied', {}],
  ]

  it.each(CORPUS)('%s — receipt and boot land the same analytical values', (_name, wire) => {
    const canvasData = { weight: 1, direction: 'negative', beliefExists: 0.3, curvature: 0.9 }

    seedEdge({ ...canvasData })
    reconcileAppliedGraph(receipt(wire))
    const viaReceipt = { ...theEdge().data }

    seedEdge({ ...canvasData })
    const boot = mergeServerGraphOnHydrate({
      nodes: WIRE_NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', ...wire }],
    })
    // Non-vacuous: a REFUSED boot merge would leave the seed untouched and could
    // "agree" with a receipt that also did nothing.
    expect(boot.accepted, 'the boot merge must actually run').toBe(true)
    const viaBoot = { ...theEdge().data }

    for (const key of ['weight', 'direction', 'beliefExists', 'exists_probability', 'curvature']) {
      expect(viaReceipt[key], `${key} must not differ between the two callers`).toEqual(viaBoot[key])
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §4 NODE CONTRAST — overlayNode has NO default baseline (checked, not assumed)
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§4 overlayNode does not share the defect', () => {
  it('a wire node value lands whatever it equals — the node overlay has no default comparison', () => {
    // Contrast control for "only the edge overlay was affected": this is GREEN
    // at the unfixed base, because overlayNode spreads the mapped wire data over
    // the canvas data with no baseline filter.
    reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Price', observed_state: { value: 0.5 } },
      ],
      edges: [],
    } as any)
    const node = useCanvasStore.getState().nodes.find((n: any) => n.id === 'factor-1') as any
    expect(node.data.observedState).toEqual({ value: 0.5 })
  })
})
