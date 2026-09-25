/**
 * The Model tab's write seam must not claim authorship the engine has not accepted.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — the exact MIRROR of the one #1799 closed in the inspector
 * ─────────────────────────────────────────────────────────────────────────────
 * `proposeFactorValue` passed `{ source: 'user' }` straight into
 * `setObservedValue` on BOTH paths. `'user'` is a member of
 * `REVIEWED_SOURCES_LIST`, so the row read "checked by you" the instant the user
 * pressed Enter — before the turn was sent, and whatever the engine went on to
 * say about it. A refusal then reverted the number and left the claim's ghost in
 * every counter that had already incremented.
 *
 * Under-claim and over-claim are TWO harms and cannot share a fix (trap 22b), so
 * this ships apart from the inspector's. But they have one cause: three value
 * editors, three different provenance behaviours, none of them the ruled one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULING IS QUOTED, NOT RE-DECIDED
 * ─────────────────────────────────────────────────────────────────────────────
 * `SuccessTargetLine.tsx:66-75` already adjudicated this for this authority's
 * sibling: *"An optimistic `threshold_source: 'user'` stamp alongside the
 * dispatch is exactly the fabricated provenance that produced the reversion
 * above … The local write SURVIVES on the `local_only` path only, where there is
 * no dispatcher to own it and the copy says so plainly."*
 *
 * Both halves are load-bearing and this spec pins both, because a fix that only
 * removed the stamp would open the mirror defect: on `local_only` no receipt is
 * ever coming, so withholding would lose a claim only the client holds.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/**
 * The dispatcher reaches this hook through CONTEXT, not a prop, so the two
 * postures under test are two context shapes. Trap 12: spread the real module
 * rather than hand-listing its exports — a `vi.mock` factory REPLACES it.
 */
let conversationContext: Record<string, unknown> | undefined
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => conversationContext }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'
import { USER_VALUE_STAMP } from '../../domain/valueProvenance'
import {
  isReviewedByUser,
  resolveReviewSource,
} from '../../components/pre-analysis/utils/isReviewedByUser'
import { confirmOptimisticFactorEdit } from '../../conversation/optimisticFactorEdit'
import type { OptimisticFactorEdit } from '../../conversation/optimisticFactorEdit'

const NODE_ID = 'fac_eng_cost'
const CAP = 30000

function seed() {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: NODE_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Monthly Engineering Cost',
            kind: 'factor',
            factor_type: 'lever',
            observedState: {
              value: 1,
              raw_value: CAP,
              cap: CAP,
              unit: '£',
              // The PRODUCER's stamp — so a later `true` cannot be the fixture's.
              source: 'cee_inference',
            },
          },
        } as unknown as Node,
      ],
      edges: [],
      results: { status: 'idle', report: null },
    } as never,
    false,
  )
}

function currentNode(): Node {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === NODE_ID)
  expect(n).toBeTruthy()
  return n as Node
}

describe('the Model tab waits for the engine before claiming authorship', () => {
  beforeEach(() => {
    seed()
  })

  it('1 — ON THE DISPATCH PATH the claim is WITHHELD until the receipt', () => {
    const sendSystemEvent = vi.fn().mockResolvedValue('SENT')
    conversationContext = { sendSystemEvent }
    const { result } = renderHook(() => useModelEditAuthority(NODE_ID))

    // Precondition, asserted rather than assumed.
    expect(isReviewedByUser(currentNode())).toBe(false)

    let outcome: string | undefined
    act(() => {
      outcome = result.current.proposeFactorValue(20000) as string
    })
    expect(outcome).toBe('dispatched')

    // The NUMBER moved.
    const obs = (currentNode().data as { observedState?: { raw_value?: number } }).observedState
    expect(obs?.raw_value).toBe(20000)

    // RED before the fix: `{ source: 'user' }` made this `true` immediately.
    expect(isReviewedByUser(currentNode())).toBe(false)
  })

  it('2 — the claim RIDES THE UNDO, so the receipt can write it', () => {
    const sendSystemEvent = vi.fn().mockResolvedValue('SENT')
    conversationContext = { sendSystemEvent }
    const { result } = renderHook(() => useModelEditAuthority(NODE_ID))
    act(() => {
      result.current.proposeFactorValue(20000)
    })

    const opts = sendSystemEvent.mock.calls[0][1] as
      | { optimisticFactorEdit?: OptimisticFactorEdit }
      | undefined
    const undo = opts?.optimisticFactorEdit
    expect(undo).toBeTruthy()
    // PIN THE PRECONDITION (trap 13b): this snapshot must address OUR node.
    expect(undo!.nodeId).toBe(NODE_ID)
    // RED before the fix: no stamp travelled at all.
    expect(undo!.reviewedStamp).toEqual(USER_VALUE_STAMP)
  })

  it('3 — and the receipt then MAKES the claim, so nothing is lost', () => {
    const sendSystemEvent = vi.fn().mockResolvedValue('SENT')
    conversationContext = { sendSystemEvent }
    const { result } = renderHook(() => useModelEditAuthority(NODE_ID))
    act(() => {
      result.current.proposeFactorValue(20000)
    })
    const undo = (
      sendSystemEvent.mock.calls[0][1] as { optimisticFactorEdit: OptimisticFactorEdit }
    ).optimisticFactorEdit

    expect(confirmOptimisticFactorEdit(undo)).toBe('stamped')
    expect(isReviewedByUser(currentNode())).toBe(true)
  })

  it('4 — ⭐ THE MIRROR GUARD: on local_only the claim IS made, because no receipt is coming', () => {
    // No dispatcher at all — the edit really is local, and this client holds the
    // only record that a person made it.
    conversationContext = {}
    const { result } = renderHook(() => useModelEditAuthority(NODE_ID))

    let outcome: string | undefined
    act(() => {
      outcome = result.current.proposeFactorValue(20000) as string
    })
    expect(outcome).toBe('local_only')

    // A "fix" that removed the stamp unconditionally would RED here — which is
    // exactly why this case exists beside the three above.
    expect(isReviewedByUser(currentNode())).toBe(true)
    // ⚠ Read through `resolveReviewSource`, the accessor the badge itself uses,
    // NOT a hand-picked key. `setObservedValue` writes the camelCase spelling
    // only, while `confirmOptimisticFactorEdit` writes both — so asserting on
    // `observed_state` here would fail for a reason that has nothing to do with
    // this change, and asserting on `observedState` would pin a spelling rather
    // than the claim. Re-implementing the fallback chain at a test site is the
    // trap-12 mirror one layer down.
    expect(resolveReviewSource(currentNode())).toBe(USER_VALUE_STAMP.source)
  })
})

describe('proposeFactorValue reports how the send settled (the card editor says "Not saved" on it)', () => {
  beforeEach(() => {
    seed()
  })

  it('a send that left settles `sent`, once', async () => {
    const sendSystemEvent = vi.fn().mockResolvedValue('SENT')
    conversationContext = { sendSystemEvent }
    const { result } = renderHook(() => useModelEditAuthority(NODE_ID))
    const onSendSettled = vi.fn()
    act(() => {
      result.current.proposeFactorValue(20000, { onSendSettled })
    })
    await vi.waitFor(() => expect(onSendSettled).toHaveBeenCalled())
    expect(onSendSettled.mock.calls).toEqual([['sent']])
  })

  it('CONTRAST — a send the busy lock refused settles `blocked`, and the local stamp is still applied', async () => {
    const sendSystemEvent = vi.fn().mockResolvedValue('send_blocked')
    conversationContext = { sendSystemEvent }
    const { result } = renderHook(() => useModelEditAuthority(NODE_ID))
    const onSendSettled = vi.fn()
    act(() => {
      result.current.proposeFactorValue(20000, { onSendSettled })
    })
    await vi.waitFor(() => expect(onSendSettled).toHaveBeenCalled())
    expect(onSendSettled.mock.calls).toEqual([['blocked']])
    expect(resolveReviewSource(currentNode())).toBe(USER_VALUE_STAMP.source)
  })
})
