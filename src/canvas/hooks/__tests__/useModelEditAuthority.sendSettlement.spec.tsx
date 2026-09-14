/**
 * ⭐⭐ A SEND THAT SETTLES SILENTLY IS A PENDING STATE WITH NO WAY TO END.
 *
 * ⛔⛔ WHY THIS FILE EXISTS, MEASURED BEFORE IT WAS WRITTEN: the string
 * `onSendSettled` appeared in EXACTLY THREE non-test files and in ZERO tests,
 * repo-wide. The five-way settlement derivation — including the `refused` vs
 * `unverified` split its own header calls "the more dangerous half" — was held
 * in place by nothing. Deleting the whole `.then`/`.catch` block and returning
 * `'sent'` unconditionally reddened NOTHING. That is CLAUDE.md trap 11.
 *
 * ⛔ AND THE DEFECT THAT FOLLOWED FROM THE SAME ROOT CAUSE: the rule was written
 * on `proposeOptionIntervention` and swept to neither sibling.
 * `proposeEdgeStrengthConfirmation` — the carrier for "I agree with this
 * estimate", the one act whose entire point is that the SERVER records it —
 * shipped `.catch(() => {})`. Every settlement collapsed to silence, the server
 * saying no included.
 *
 * ⚠ THE CONTRAST ARM IS LOAD-BEARING, NOT DECORATION. Each settlement case is
 * asserted for BOTH carriers in the same run. A test that pinned only the new
 * carrier would pass just as well against a copied block as against the shared
 * one, and a copy is the defect this change exists to remove — so the option
 * arm is what proves the extraction preserved the sibling's behaviour rather
 * than re-implementing it beside it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const sendSystemEvent = vi.fn()
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'
import {
  SEND_BLOCKED,
  SEND_DEFERRED,
  SystemEventSendError,
} from '../../conversation/useConversation'
import type { SystemEventSendSettlement } from '../../conversation/settleSystemEventSend'

const OPTION = 'opt_premium'
const FACTOR = 'fac_cost'
const EDGE = 'e-fac_cost-out_margin'
const HASH = '9f2c1b0ae4d37c5a'

/** A category `isProvenNoWriteConflict` certifies as "the producer wrote nothing". */
const PROVEN_NO_WRITE = 'BASE_HASH_DIVERGED'

function seed() {
  useCanvasStore.setState(
    {
      lastServerGraphHash: HASH,
      nodes: [
        { id: FACTOR, type: 'factor', position: { x: 0, y: 0 },
          data: { label: 'Cost', kind: 'factor' } },
        { id: 'out_margin', type: 'outcome', position: { x: 0, y: 0 },
          data: { label: 'Margin', kind: 'outcome' } },
        { id: OPTION, type: 'option', position: { x: 0, y: 0 },
          data: { label: 'Premium-first', kind: 'option', interventions: { [FACTOR]: 0.2 } } },
      ],
      edges: [
        {
          id: EDGE, source: FACTOR, target: 'out_margin',
          // A SERVER-STATED tuple, or `buildEdgeStrengthConfirmEvent` refuses:
          // there is no `expected` to ratify and nothing reaches the wire.
          data: { serverStrength: { mean: 0.4, effect_direction: 'positive' } },
        },
      ],
    } as never,
    false,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  seed()
})

/** Dispatch a confirmation and resolve whatever settlement it reports. */
async function settleConfirm(): Promise<SystemEventSendSettlement | 'NEVER_FIRED'> {
  const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
  let seen: SystemEventSendSettlement | 'NEVER_FIRED' = 'NEVER_FIRED'
  const outcome = result.current.proposeEdgeStrengthConfirmation(EDGE, {
    onSendSettled: s => { seen = s },
  })
  // The precondition this case is about. Pinned IN-TEST so a fixture that
  // stopped reaching the wire cannot read as "the callback did not fire".
  expect(outcome).toBe('dispatched')
  await vi.waitFor(() => expect(seen).not.toBe('NEVER_FIRED'))
  return seen
}

/** The contrast arm: the sibling carrier the derivation came from. */
async function settleIntervention(): Promise<SystemEventSendSettlement | 'NEVER_FIRED'> {
  const { result } = renderHook(() => useModelEditAuthority(OPTION))
  let seen: SystemEventSendSettlement | 'NEVER_FIRED' = 'NEVER_FIRED'
  const outcome = result.current.proposeOptionIntervention(FACTOR, 0.75, {
    onSendSettled: s => { seen = s },
  })
  expect(outcome).toBe('dispatched')
  await vi.waitFor(() => expect(seen).not.toBe('NEVER_FIRED'))
  return seen
}

describe('every send settles exactly once, and both carriers agree', () => {
  const CASES: ReadonlyArray<
    readonly [name: string, send: () => Promise<unknown>, expected: SystemEventSendSettlement]
  > = [
    ['the POST left and was not queued', () => Promise.resolve(undefined), 'sent'],
    ['the sender buffered it behind a turn', () => Promise.resolve(SEND_DEFERRED), 'queued'],
    ['the busy lock refused it', () => Promise.resolve(SEND_BLOCKED), 'blocked'],
    [
      'the server answered and certified it wrote nothing',
      () => Promise.reject(new SystemEventSendError('server', { conflictCategory: PROVEN_NO_WRITE })),
      'refused',
    ],
    [
      'the server failed the turn but proved no such thing',
      () => Promise.reject(new SystemEventSendError('server', { conflictCategory: 'SOMETHING_ELSE' })),
      'unverified',
    ],
    [
      'the server failed the turn and named no category at all',
      () => Promise.reject(new SystemEventSendError('server')),
      'unverified',
    ],
    [
      'the transport failed, which proves non-delivery of neither half',
      () => Promise.reject(new SystemEventSendError('transport')),
      'unverified',
    ],
    [
      'a rejection shape this seam does not recognise',
      () => Promise.reject(new Error('something nobody modelled')),
      'unverified',
    ],
  ]

  for (const [name, send, expected] of CASES) {
    it(`confirmation: ${name} → ${expected}`, async () => {
      sendSystemEvent.mockImplementation(send)
      expect(await settleConfirm()).toBe(expected)
    })

    it(`option intervention (contrast): ${name} → ${expected}`, async () => {
      sendSystemEvent.mockImplementation(send)
      expect(await settleIntervention()).toBe(expected)
    })
  }
})

describe('the confirmation opts out of the sender hidden queue, as its sibling does', () => {
  /**
   * ⭐ THE MECHANISM IS DERIVED AT THIS EVENT'S OWN BYTES, NOT BORROWED.
   * `proposeOptionIntervention`'s reason is that the queue holds `SendTurnOpts`
   * VERBATIM, so a deferred copy keeps the `base_graph_hash` read at enqueue.
   * `buildEdgeStrengthConfirmEvent` emits NO `base_graph_hash` — so that exact
   * sentence does not transfer, and asserting it would be justification by
   * sibling.
   *
   * What it DOES carry is `expected`, read from the store at enqueue: a
   * deferred confirmation ratifies a value the model may no longer hold, and
   * CEE refuses it as `edge_expected_tuple_mismatch`. Same conclusion, this
   * event's own fence.
   *
   * And the mechanism-independent half, which is the primary reason for both:
   * `SEND_DEFERRED` resolves BEFORE the turn exists, so `onSendSettled` fires
   * `'queued'` for the last time and a row that entered it could never leave.
   */
  it('passes deferIfBusy:false so a queued send cannot become an exitless state', async () => {
    sendSystemEvent.mockResolvedValue(undefined)
    await settleConfirm()
    expect(sendSystemEvent.mock.calls[0]?.[1]).toMatchObject({ deferIfBusy: false })
  })

  it('sends the confirm_current carrier, not a set wearing its name', async () => {
    sendSystemEvent.mockResolvedValue(undefined)
    await settleConfirm()
    expect(sendSystemEvent.mock.calls[0]?.[0]).toMatchObject({
      type: 'edge_strength_edit',
      payload: { intent: 'confirm_current', direction_intent: 'preserve' },
    })
  })
})

describe('a refusal that never reached the wire never settles', () => {
  /**
   * ⛔ THE INTERLOCK. The three non-dispatch outcomes return BEFORE any send, so
   * a caller that rendered "saving" on them would hang forever. This is the
   * exitless state one step earlier than the one above, and it is the case a
   * settlement callback makes newly reachable.
   */
  it('refused_unassertable: no server-stated tuple, so nothing is sent and nothing settles', async () => {
    useCanvasStore.setState(
      { edges: [{ id: EDGE, source: FACTOR, target: 'out_margin', data: {} }] } as never,
      false,
    )
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    const settled: SystemEventSendSettlement[] = []
    expect(
      result.current.proposeEdgeStrengthConfirmation(EDGE, {
        onSendSettled: s => settled.push(s),
      }),
    ).toBe('refused_unassertable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(settled).toEqual([])
  })

  it('not_encodable: an id that is not the active edge is a caller holding the wrong authority', async () => {
    const { result } = renderHook(() => useModelEditAuthority(null, EDGE))
    const settled: SystemEventSendSettlement[] = []
    expect(
      result.current.proposeEdgeStrengthConfirmation('e-somebody-elses', {
        onSendSettled: s => settled.push(s),
      }),
    ).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(settled).toEqual([])
  })
})
