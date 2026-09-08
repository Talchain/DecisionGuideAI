/**
 * `expected` MAY ONLY ASSERT WHAT THE SERVER STATED — the fix-forward on #1287.
 *
 * ⭐ THE DEFECT, as a user meets it. `expected` is an optimistic-concurrency
 * assertion: the contract's own words are *"the exact signed mean last read from
 * the canonical persisted edge ... not the requested value"*. #1287 built it
 * from `resolveEdgeSignedStrengthDisplay`, which admits any value carrying a
 * provenance stamp — INCLUDING the `weightSource: 'user'` stamp `setStrength`
 * writes unconditionally, on every local edit, including edits the wire never
 * carried. So the UI asserted a CLIENT-ONLY number to CEE as a readback of the
 * persisted edge, and CEE can answer a fabricated concurrent-modification
 * message ("someone else changed this — refresh and reconfirm") for an edit
 * that was fine and a third party that does not exist.
 *
 * ⚠ WHY THE FIXTURE IS BUILT BY `mapDraftEdgeToCanvas` AND NOT BY HAND. The
 * defect is UNREACHABLE on a hand-written fixture that carries `strength_mean`:
 * that raw producer field is never overwritten by a local edit, so `expected`
 * stays correct by accident. The real drafted edge has NO `strength_mean` key —
 * the mapper emits `weight` + `weightSource: 'cee'` and drops the raw spelling.
 * A fixture written from this author's head would have reproduced the safe
 * shape and certified the defect as fixed (CLAUDE.md trap 16-inverse: a fixture
 * you wrote yourself is not evidence about the wire). So the ingestion mapper
 * builds it, and the test asserts its own precondition — that the shape it is
 * about to drive genuinely LACKS `strength_mean` — before driving it.
 *
 * ⚠ (A) AND (B) ARE SEQUENCE DEFECTS AND CANNOT BE SEEN IN A SINGLE CALL. The
 * self-perpetuating arm only appears across CONSECUTIVE edits: the first edit
 * poisons the local value, and every later edit is judged against the poison.
 * Each sequence case therefore drives several edits through the real store and
 * asserts what was on the wire at EACH step.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY (CLAUDE.md trap 19). Events are compared
 * field-for-field against exact literals; store reads name the edge id. A
 * second edge with the same shape is seeded so an assertion that matched "an
 * edge with weight 0.6" would fail on the wrong object.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

function dispatchedEvent(index = 0): WireSystemEvent {
  const call = sendSystemEvent.mock.calls[index]
  expect(call, `expected a dispatched event at call index ${index}`).toBeDefined()
  return call[0]
}

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { useEdgeMutations } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'

const EDGE = 'e_price_revenue'
const OTHER_EDGE = 'e_churn_revenue'

/**
 * The edge as CEE actually drafts it, through the REAL ingestion mapper.
 * `strength: { mean: 0.4 }` + `effect_direction: 'positive'` is the shape the
 * draft path carries; the mapper stores an absolute `weight`, a separate
 * `direction`, and the `'cee'` provenance stamps.
 */
function draftedEdgeData(mean = 0.4): Record<string, unknown> {
  const mapped = mapDraftEdgeToCanvas(
    {
      id: EDGE,
      from: 'fac_price',
      to: 'goal_revenue',
      strength: { mean },
      effect_direction: mean < 0 ? 'negative' : 'positive',
    },
    0,
  )
  return mapped.data as Record<string, unknown>
}

function seed(edgeData: Record<string, unknown>) {
  useCanvasStore.setState(
    {
      nodes: [],
      edges: [
        { id: EDGE, source: 'fac_price', target: 'goal_revenue', data: { ...edgeData } },
        // THE DISCRIMINATION CONTROL — same shape, different identity.
        {
          id: OTHER_EDGE,
          source: 'fac_churn',
          target: 'goal_revenue',
          data: { ...edgeData },
        },
      ],
    } as never,
    false,
  )
}

function readEdge(id: string) {
  return useCanvasStore.getState().edges.find((e) => e.id === id)
}

beforeEach(() => {
  sendSystemEvent.mockClear()
})

describe('the drafted-edge precondition this whole file rests on', () => {
  /**
   * ⚠ PINNED, NOT ASSUMED. If ingestion ever starts preserving `strength_mean`,
   * every sequence case below silently stops exercising the defect and starts
   * passing for a reason that has nothing to do with the fix. This RED is the
   * tell (CLAUDE.md trap 13b: a discriminator must pin its own precondition).
   */
  it('a CEE-drafted edge carries a stamped `weight` and NO raw `strength_mean`', () => {
    const data = draftedEdgeData(0.4)
    expect(data.weight).toBe(0.4)
    expect(data.weightSource).toBe('cee')
    expect(data.direction).toBe('positive')
    expect(data.directionSource).toBe('cee')
    expect('strength_mean' in data).toBe(false)
    expect('effect_direction' in data).toBe(false)
  })
})

describe('`expected` is never built from a client-stamped value', () => {
  it('a producer-stated edge still dispatches, asserting the SERVER value (positive control)', () => {
    seed(draftedEdgeData(0.4))
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    expect(result.current.setStrength(0.75)).toBe('dispatched')
    expect(dispatchedEvent()).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.75,
        direction_intent: 'positive',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
  })

  /**
   * ⭐ THE BLOCKING CASE. Two consecutive in-range edits. The SECOND must not
   * assert the first edit's number: the server was never told the first one
   * landed (nothing in this client can observe an acceptance), so 0.75 is a
   * client-only number and asserting it as a readback is the fabrication.
   */
  it('a second edit does NOT assert the first edit\'s own number as the server\'s', () => {
    seed(draftedEdgeData(0.4))
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    result.current.setStrength(0.75)
    result.current.setStrength(0.6)

    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    const second = dispatchedEvent(1)
    // The whole event, field for field — `expected` must still be the last
    // value the SERVER stated, not the 0.75 this client wrote a moment ago.
    expect(second).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.6,
        direction_intent: 'positive',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
    // Stated as its own assertion too, so the RED names the defect rather than
    // merely reporting a mismatched object: 0.75 is a number only this client
    // has ever seen, and it is not a readback of anything.
    expect(second).not.toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          expected: { mean: 0.75, effect_direction: 'positive' },
        }),
      }),
    )
  })

  /**
   * ⭐ (B) — THE SELF-PERPETUATING ARM. An out-of-range value cannot be sent
   * (the contract caps magnitude at 1). Under #1287 it was written locally
   * anyway, and every LATER edit on that edge was then judged against the
   * out-of-range local number and silently dropped too — including edits back
   * into range — for the rest of the session.
   *
   * The out-of-range edit itself is not required to reach the wire. What must
   * be true is that it does not POISON the next one.
   */
  it('an out-of-range local weight does not silence later IN-RANGE edits', () => {
    seed(draftedEdgeData(0.4))
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    // 1.5 exceeds the contract's magnitude cap; nothing may be asserted for it.
    const outOfRange = result.current.setStrength(1.5, { preserveDirection: true })
    expect(outOfRange).not.toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(0)
    // The local write lands regardless — #1287's deliberate choice, unchanged.
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 1.5, weightSource: 'user' })

    // …and the NEXT edit, which is perfectly in range, must reach the server.
    const backInRange = result.current.setStrength(0.6, { preserveDirection: true })
    expect(backInRange).toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(dispatchedEvent()).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.6,
        direction_intent: 'preserve',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
    // The sibling was never touched — binding by identity, not by value.
    expect(readEdge(OTHER_EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'cee' })
  })

  /**
   * ⭐ THE SECOND LAUNDERING DOOR, and the one that proves `weightSource` alone
   * cannot gate the wire. `ModelTabBody.handleResolveContested` (accepted_pass2)
   * writes the producer's PASS-2 mean locally and stamps `weightSource: 'cee'`
   * — correctly, because the number really is the producer's. But CEE persists
   * the adjudication as a turn FACT AND WRITES NO GRAPH, so the persisted edge
   * still holds its pre-adjudication value. A `'cee'` stamp is therefore an
   * answer to *whose number is this?* and never to *what does the server hold?*
   * — the two questions `edgeValueProvenance.ts`'s "NOT FOR WIRE PAYLOADS"
   * header names apart.
   */
  it('a locally-applied pass-2 estimate stamped `cee` is NOT assertable as the server\'s', () => {
    // ⚠ THE FIXTURE THIS CASE NEEDED WAS NOT THE ONE FIRST WRITTEN, and the
    // correction is worth recording because it is the whole point of the case.
    // The first attempt overlaid the pass-2 value onto a DRAFTED edge — which
    // carries an ingestion record, so the server's value genuinely IS known and
    // dispatching is CORRECT there. The hazard needs an edge with NO ingestion
    // record at all: a user-drawn edge, or one from a graph persisted before
    // that record existed, onto which `handleResolveContested` (accepted_pass2)
    // or `useModelActionApply` has written a producer number and stamped
    // `weightSource: 'cee'`. Nothing here has ever heard from the server about
    // this edge, and the `'cee'` stamp does not change that.
    seed({
      weight: 0.9,
      direction: 'positive',
      weightSource: 'cee',
      directionSource: 'cee',
    })
    // The precondition, pinned in-test: nothing on this edge records a server
    // statement, so a dispatch could only come from a client-side number.
    expect('serverStrength' in (readEdge(EDGE)?.data ?? {})).toBe(false)
    expect('strength_mean' in (readEdge(EDGE)?.data ?? {})).toBe(false)

    const { result } = renderHook(() => useEdgeMutations(EDGE))
    const outcome = result.current.setStrength(0.5, { preserveDirection: true })

    expect(outcome).toBe('not_wire_encodable')
    expect(sendSystemEvent).toHaveBeenCalledTimes(0)
    // The local edit still lands — a refusal to ASSERT is not a refusal to EDIT.
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.5, weightSource: 'user' })
  })
})
