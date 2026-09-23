/**
 * A MATCHING RECEIPT GRANTS THE NEXT STRENGTH EDIT — RED-first (Codex 5798417040, #1913).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * A canvas edge already shows 0.5 / positive but holds NO `serverStrength`
 * tuple. An applied receipt then carries `strength.mean: 0.5,
 * effect_direction: 'positive'`. The mapper validates that tuple
 * (`readServerStatedStrength`), but `overlayEdge` threw it away because every
 * DISPLAYED value already matched, and the receipt caller did not enable the
 * acquisition boot hydration uses. `buildEdgeStrengthEditEvent` refuses an edit
 * without that tuple, so the person could not make their NEXT strength edit
 * after the receipt had proved the saved value — until they reloaded, when boot
 * readback recorded the same tuple.
 *
 * The same discard left a STALE tuple in place when the canvas already showed
 * the receipt's value because of the person's own optimistic write: the next
 * edit then asserted the superseded server value and CEE, comparing with a bare
 * `!==`, refused it as a concurrent change.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS PINS
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. A receipt whose displayed values all match still RECORDS its validated
 *      server tuple — that tuple and nothing else: no history entry, no counted
 *      update, no freshness dirtying, no pulse, and every authorship field
 *      (`weightSource`, `directionSource`, `provenanceDisplay`, …) exactly as it
 *      was. CEE transporting an unchanged user value does not make it CEE's.
 *   2. Once value AND tuple match, a repeated receipt is a strict no-op: same
 *      edges array, same edge object, same history.
 *   3. A receipt with no VALID tuple manufactures no edit authority.
 *
 * Every case binds the edge by its own id, never by a value predicate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { __resetAppliedEditPulseForTests, PULSE_COALESCE_MS } from '../appliedEditPulse'
import { buildEdgeStrengthEditEvent } from '../../conversation/edgeStrengthEdit'
import { serverStatedStrengthOf } from '../../conversation/edgeServerStatedStrength'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

const EDGE_ID = 'local-edge-5798'
const OTHER_ID = 'local-edge-other'

const NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Price' } },
  { id: 'factor-2', type: 'factor', position: { x: 40, y: 360 }, data: { kind: 'factor', label: 'Reach' } },
]

const WIRE_NODES = [
  { id: 'goal-1', kind: 'goal', label: 'Revenue' },
  { id: 'factor-1', kind: 'factor', label: 'Price' },
  { id: 'factor-2', kind: 'factor', label: 'Reach' },
]

/** The unrelated edge: present on canvas and wire, supplying nothing analytical. */
const OTHER_CANVAS = { id: OTHER_ID, source: 'factor-2', target: 'goal-1', type: 'styled', data: { weight: 0.3, direction: 'positive' } }
const OTHER_WIRE = { from: 'factor-2', to: 'goal-1' }

/** A user-authored edge showing the receipt's value, with NO server tuple. */
const USER_AUTHORED = {
  weight: 0.5,
  direction: 'positive',
  weightSource: 'user',
  directionSource: 'user',
  provenanceDisplay: 'user_set',
  userReviewedStrength: true,
} as const

function seed(data: Record<string, unknown>): void {
  seedCanvas(NODES, [
    { id: EDGE_ID, source: 'factor-1', target: 'goal-1', type: 'styled', data },
    OTHER_CANVAS,
  ])
  useCanvasStore.setState({
    graphEditedSinceLastRun: false,
    analysisStateReady: true,
    analysisFreshnessDirty: false,
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
  } as never)
}

function theEdge(id = EDGE_ID): any {
  const e = useCanvasStore.getState().edges.find((x: any) => x.id === id)
  expect(e, `edge ${id} must still exist, bound by id`).toBeTruthy()
  return e
}

function receipt(edge: Record<string, unknown>, other: Record<string, unknown> = OTHER_WIRE) {
  return {
    nodes: WIRE_NODES,
    edges: [{ id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', ...edge }, other],
  } as any
}

/** The tuple the mapper validates for this wire edge — asserted, never assumed. */
function validatedTuple(wire: Record<string, unknown>) {
  const tuple = mapDraftEdgeToCanvas({ from: 'factor-1', to: 'goal-1', ...wire }, 0).data.serverStrength
  expect(tuple, 'fixture: the mapper must actually validate this tuple').toBeDefined()
  return tuple
}

function withoutTuple(data: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...data }
  delete copy.serverStrength
  return copy
}

beforeEach(() => {
  __resetAppliedEditPulseForTests()
  vi.useFakeTimers()
})
afterEach(() => {
  __resetAppliedEditPulseForTests()
  vi.useRealTimers()
})

/* ══════════════════════════════════════════════════════════════════════════
 * §1 a matching receipt records its validated tuple, and only that
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§1 a display-matching receipt grants the next strength edit', () => {
  const WITNESSED = {
    strength: { mean: 0.5, std: 0.1 },
    exists_probability: 0.9,
    effect_direction: 'positive',
    provenance: { source: 'user_specified' },
  }

  const CASES: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    // Codex's exact shape. The wire alone would stamp 'cee' — the user's stamps must survive.
    ['default-equal positive onto a user-authored edge', USER_AUTHORED, { strength: { mean: 0.5 }, effect_direction: 'positive' }],
    ['negative onto a user-authored edge', { ...USER_AUTHORED, weight: 0.35, direction: 'negative' }, { strength: { mean: -0.35 }, effect_direction: 'negative' }],
    // The witnessed user-confirmed wire, canvas seeded as its own mapping minus the tuple.
    ['witnessed user-confirmed shape', withoutTuple(mapDraftEdgeToCanvas({ from: 'factor-1', to: 'goal-1', ...WITNESSED }, 0).data), WITNESSED],
  ]

  it.each(CASES)('%s — tuple acquired exactly; next edit builds on it; history and authorship unchanged', (_name, canvasData, wire) => {
    seed({ ...canvasData })
    const tuple = validatedTuple(wire)
    const seededData = { ...theEdge().data }
    const history = useCanvasStore.getState().history
    const other = theEdge(OTHER_ID)

    // Precondition — the refusal the person sees today.
    expect(serverStatedStrengthOf(theEdge().data), 'precondition: no server authority yet').toBeNull()
    expect(buildEdgeStrengthEditEvent({ edge: theEdge(), requestedMean: 0.8, preserveDirection: true })).toBeNull()

    const result = reconcileAppliedGraph(receipt(wire))

    // The tuple, exactly as the receipt validated it — and NOTHING else on the edge.
    expect(theEdge().data.serverStrength).toEqual(tuple)
    expect(theEdge().data, 'authorship and every value unchanged; only the tuple added').toEqual({ ...seededData, serverStrength: tuple })
    expect(theEdge().data.weightSource, 'an unchanged user value is not restamped because CEE transported it').toBe(seededData.weightSource)

    // The NEXT edit is now assertable, against exactly that tuple.
    const event = buildEdgeStrengthEditEvent({ edge: theEdge(), requestedMean: 0.8, preserveDirection: true })
    expect(event, 'the next strength edit must build').not.toBeNull()
    expect((event as any).payload.expected).toEqual(tuple)

    // Not an edit: no history, no counted update, no staleness, no pulse.
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
    expect(useCanvasStore.getState()).toMatchObject({
      graphEditedSinceLastRun: false, analysisStateReady: true, analysisFreshnessDirty: false,
    })
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect(useCanvasStore.getState().highlightedEdges.size).toBe(0)
    // An unrelated edge is untouched by identity.
    expect(theEdge(OTHER_ID)).toBe(other)
  })

  it('a STALE tuple is replaced by the receipt’s — the next edit asserts what the server now holds', () => {
    // The person's own optimistic write moved 0.7 → 0.5; the tuple still says 0.7.
    seed({ ...USER_AUTHORED, serverStrength: { mean: 0.7, effect_direction: 'positive' } })
    const history = useCanvasStore.getState().history

    const result = reconcileAppliedGraph(receipt({ strength: { mean: 0.5 }, effect_direction: 'positive' }))

    expect(theEdge().data).toEqual({ ...USER_AUTHORED, serverStrength: { mean: 0.5, effect_direction: 'positive' } })
    const event = buildEdgeStrengthEditEvent({ edge: theEdge(), requestedMean: 0.8, preserveDirection: true })
    expect((event as any)?.payload.expected).toEqual({ mean: 0.5, effect_direction: 'positive' })
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
  })

  it('beside a REAL change elsewhere: one history entry, one counted update, the acquisition not pulsed', () => {
    seed({ ...USER_AUTHORED })
    const before = useCanvasStore.getState().history.past.length

    // The other edge genuinely moves (0.3 → 0.9); this edge only gains its tuple.
    const result = reconcileAppliedGraph(
      receipt({ strength: { mean: 0.5 }, effect_direction: 'positive' }, { ...OTHER_WIRE, strength: { mean: 0.9 } }),
    )

    expect(theEdge(OTHER_ID).data.weight, 'proof the real change landed').toBe(0.9)
    expect(theEdge().data).toEqual({ ...USER_AUTHORED, serverStrength: { mean: 0.5, effect_direction: 'positive' } })
    expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
    expect(useCanvasStore.getState().history.past).toHaveLength(before + 1)
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect([...useCanvasStore.getState().highlightedEdges]).toEqual([OTHER_ID])
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §2 replay is idempotent once value and tuple both match
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§2 replaying the same receipt changes nothing', () => {
  it('same edges array, same edge object, same history — no edge or node write', () => {
    seed({ ...USER_AUTHORED })
    const wire = { strength: { mean: 0.5 }, effect_direction: 'positive' }
    reconcileAppliedGraph(receipt(wire))
    expect(theEdge().data.serverStrength, 'precondition: the first receipt acquired').toEqual({ mean: 0.5, effect_direction: 'positive' })

    const edges = useCanvasStore.getState().edges
    const nodes = useCanvasStore.getState().nodes
    const edge = theEdge()
    const history = useCanvasStore.getState().history
    let graphWrites = 0
    const unsubscribe = useCanvasStore.subscribe((s, prev) => {
      if (s.edges !== prev.edges || s.nodes !== prev.nodes || s.history !== prev.history) graphWrites += 1
    })
    try {
      const result = reconcileAppliedGraph(receipt(wire))
      expect(result).toEqual(counts())
    } finally {
      unsubscribe()
    }

    expect(graphWrites).toBe(0)
    expect(useCanvasStore.getState().edges).toBe(edges)
    expect(useCanvasStore.getState().nodes).toBe(nodes)
    expect(theEdge()).toBe(edge)
    expect(useCanvasStore.getState().history).toBe(history)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §3 OPPOSITE CONTROL — no valid tuple, no authority
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§3 a receipt without a valid server tuple manufactures no edit authority', () => {
  it.each([
    ['mean only', { strength: { mean: 0.5 } }],
    ['flat mean only', { strength_mean: 0.5 }],
    ['direction declined', { strength: { mean: 0.5 }, effect_direction: 'unknown' }],
    ['nothing analytical', {}],
  ] as const)('%s — the edge is untouched and the next edit is still refused', (_name, wire) => {
    seed({ ...USER_AUTHORED })
    expect(
      mapDraftEdgeToCanvas({ from: 'factor-1', to: 'goal-1', ...wire }, 0).data.serverStrength,
      'fixture: the mapper must NOT validate a tuple here',
    ).toBeUndefined()
    const edges = useCanvasStore.getState().edges
    const edge = theEdge()
    const history = useCanvasStore.getState().history

    const result = reconcileAppliedGraph(receipt(wire))

    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().edges).toBe(edges)
    expect(theEdge()).toBe(edge)
    expect(theEdge().data).not.toHaveProperty('serverStrength')
    expect(serverStatedStrengthOf(theEdge().data)).toBeNull()
    expect(buildEdgeStrengthEditEvent({ edge: theEdge(), requestedMean: 0.8, preserveDirection: true })).toBeNull()
    expect(useCanvasStore.getState().history).toBe(history)
  })
})
