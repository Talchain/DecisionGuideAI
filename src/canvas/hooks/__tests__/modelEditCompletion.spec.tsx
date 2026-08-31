/**
 * The PER-EDIT COMPLETION INTERFACE — the four contract points, pinned.
 *
 * This spec exists because #1033 (the Model-tab UX lane) cannot tell a user
 * their edit saved without an authority that can tell it apart from an edit
 * that did not. The four points it pins:
 *
 *   1. a CORRELATED outcome — which attempt this answer belongs to;
 *   2. the CANONICAL resulting value — what the model holds, not what was
 *      optimistically rendered;
 *   3. the CANONICAL SOURCE of that value;
 *   4. a lifecycle that SURVIVES REMOUNT.
 *
 * ⭐⭐ THE LOAD-BEARING TEST IS THE DISCRIMINATING PAIR (`false-success class`).
 * Both arms record a RECEIPT. The ONLY thing that differs between them is the
 * cold-read bytes. So an implementation that trusted the receipt — which is the
 * measured CEE defect (`edit-graph.ts:2986-2992`, four false successes where the
 * number went to a dead `data/value` key and `observed_state.value` never moved,
 * pinned by `persisted-false-success-2026-07-23.test.ts`) — reports BOTH arms
 * committed and fails the pair. Neither arm alone shows this: the commit arm
 * alone is satisfied by trusting the receipt, and the refusal arm alone is
 * satisfied by never committing anything.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY (attempt id, node id) AND EXPECTATIONS ARE
 * LITERALS. Nothing here reads a value out of the ledger and then asserts the
 * ledger agrees with it — that shape (an expectation derived from the thing it
 * pins) has shipped repeatedly in this estate and is worth nothing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const sendSystemEvent = vi.fn().mockResolvedValue({})
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import {
  __resetModelEditCompletionLedger,
  beginModelEditAttempt,
  getModelEditAttempt,
  markModelEditUnresolved,
  readCanonicalFactorValue,
  recordModelEditReceipt,
  refuseModelEditAttempt,
  settleModelEditAttemptsFromCanonicalGraph,
} from '../modelEditCompletion'
import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'

const SCENARIO = 'scn_alpha'
const OTHER_SCENARIO = 'scn_beta'
const FACTOR_A = 'fac_delivery_time'
const FACTOR_B = 'fac_unit_cost'

/**
 * A cold-read graph in the witnessed shape:
 * `POST /bff/cee/scenarios/<id>/graph` body `{}` → nodes carrying
 * `observed_state { value, raw_value, source }`.
 */
function coldReadGraph(
  nodes: Array<{
    id: string
    value?: number
    rawValue?: number
    source?: string
    /** Node-level `provenance` — RESPONSE-ONLY, and never evidence. */
    provenance?: string
  }>,
) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      data: {
        label: n.id,
        ...(n.provenance ? { provenance: n.provenance } : {}),
        observed_state: {
          ...(n.value === undefined ? {} : { value: n.value }),
          ...(n.rawValue === undefined ? {} : { raw_value: n.rawValue }),
          ...(n.source === undefined ? {} : { source: n.source }),
        },
      },
    })),
  }
}

beforeEach(() => {
  __resetModelEditCompletionLedger()
  sendSystemEvent.mockClear()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('contract 1 — the outcome is correlated to THE attempt that produced it', () => {
  it('settles the right attempt while another is outstanding on a different factor', () => {
    const attemptA = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.85,
      attemptedRawValue: 0.85,
    })
    const attemptB = beginModelEditAttempt({
      nodeId: FACTOR_B,
      scenarioId: SCENARIO,
      attemptedValue: 0.4,
      attemptedRawValue: 0.4,
    })
    expect(attemptA).not.toBe(attemptB)

    recordModelEditReceipt(attemptA)
    recordModelEditReceipt(attemptB)

    // The cold read confirms A and contradicts B, in ONE graph.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([
        { id: FACTOR_A, value: 0.85, rawValue: 0.85, source: 'user_override' },
        { id: FACTOR_B, value: 0.4, rawValue: 0.9, source: 'cee_inference' },
      ]),
    )

    // ⭐ BOUND BY ATTEMPT ID. A per-node or "last edit" flag cannot pass this:
    // the two attempts settle to OPPOSITE phases from one adjudication.
    expect(getModelEditAttempt(attemptA)?.completion).toEqual({
      phase: 'committed',
      canonical: { value: 0.85, rawValue: 0.85, source: 'user_override' },
    })
    expect(getModelEditAttempt(attemptB)?.completion.phase).toBe('refused')
    expect(getModelEditAttempt(attemptA)?.nodeId).toBe(FACTOR_A)
    expect(getModelEditAttempt(attemptB)?.nodeId).toBe(FACTOR_B)
  })

  it('a late answer cannot re-open an attempt that already settled', () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.85,
      attemptedRawValue: 0.85,
    })
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([{ id: FACTOR_A, value: 0.85, rawValue: 0.85, source: 'user_override' }]),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')

    // A's slow refusal lands after the user has moved on. It must not win.
    refuseModelEditAttempt(attempt, 'late refusal that must be ignored')
    markModelEditUnresolved(attempt, 'late uncertainty that must be ignored')
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')
  })

  it('does not settle an attempt against another scenario’s graph', () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.85,
      attemptedRawValue: 0.85,
    })
    recordModelEditReceipt(attempt)
    settleModelEditAttemptsFromCanonicalGraph(
      OTHER_SCENARIO,
      coldReadGraph([{ id: FACTOR_A, value: 0.85, rawValue: 0.85, source: 'user_override' }]),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ the discriminating pair — a receipt cannot buy a commit', () => {
  /**
   * Both arms are byte-identical up to the cold read: same attempted value,
   * same receipt. Only the persisted bytes differ.
   */
  function armWithReceipt() {
    return beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.85,
      attemptedRawValue: 0.85,
    })
  }

  it('COMMITTED arm — the cold read proves the model holds the number', () => {
    const attempt = armWithReceipt()
    recordModelEditReceipt(attempt)
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([{ id: FACTOR_A, value: 0.85, rawValue: 0.85, source: 'user_override' }]),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'committed',
      canonical: { value: 0.85, rawValue: 0.85, source: 'user_override' },
    })
  })

  it('REFUSED arm — the SAME receipt, but the persisted value never moved', () => {
    const attempt = armWithReceipt()
    recordModelEditReceipt(attempt)
    // The measured false-success shape: the turn reported the edit applied and
    // `observed_state` still holds the engine's own estimate.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([{ id: FACTOR_A, value: 0.5, rawValue: 0.5, source: 'cee_inference' }]),
    )
    const completion = getModelEditAttempt(attempt)?.completion
    expect(completion?.phase).toBe('refused')
    // Contract 2 + 3: the row is handed what the model ACTUALLY holds, so it
    // can stop rendering the optimistic 0.85.
    expect(completion).toMatchObject({
      canonical: { value: 0.5, rawValue: 0.5, source: 'cee_inference' },
    })
  })

  it('a receipt on its own is never `committed`', () => {
    const attempt = armWithReceipt()
    recordModelEditReceipt(attempt)
    // No cold read has happened. The honest phase is `receipted` — a state
    // #1033 must not render as "saved".
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('contract 3 — provenance comes from observed_state.source, never NodeV3.provenance', () => {
  it('ignores `provenance: "user_set"` and refuses on the persisted bytes', () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.85,
      attemptedRawValue: 0.85,
    })
    recordModelEditReceipt(attempt)
    // `user_set` is NOT in `OBSERVED_STATE_SOURCE_LITERALS`; it lives on
    // `NodeV3.provenance`, which is RESPONSE-ONLY and recomputed every
    // response. A completion signal taken from it would report "saved" here.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([
        {
          id: FACTOR_A,
          value: 0.5,
          rawValue: 0.5,
          source: 'cee_inference',
          provenance: 'user_set',
        },
      ]),
    )
    const completion = getModelEditAttempt(attempt)?.completion
    expect(completion?.phase).toBe('refused')
    expect(completion).toMatchObject({ canonical: { source: 'cee_inference' } })
  })

  it('reads the source verbatim off observed_state', () => {
    const canonical = readCanonicalFactorValue(
      coldReadGraph([
        { id: FACTOR_A, value: 0.85, rawValue: 0.85, source: 'user_override', provenance: 'user_set' },
      ]),
      FACTOR_A,
    )
    expect(canonical).toEqual({ value: 0.85, rawValue: 0.85, source: 'user_override' })
  })

  it('an unreadable graph does NOT manufacture a refusal', () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.85,
      attemptedRawValue: 0.85,
    })
    recordModelEditReceipt(attempt)
    // The node is absent from the cold read: "I could not tell" is not "it did
    // not move", and conflating them would accuse the user's data falsely.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([{ id: FACTOR_B, value: 0.4, source: 'cee_inference' }]),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('contract 4 — the outcome survives a remount', () => {
  beforeEach(() => {
    useCanvasStore.setState(
      {
        currentScenarioId: SCENARIO,
        nodes: [
          {
            id: FACTOR_A,
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Delivery time',
              kind: 'factor',
              observedState: {
                value: 0.5,
                raw_value: 15000,
                cap: 30000,
                source: 'cee_inference',
              },
            },
          },
        ],
      } as never,
      false,
    )
  })

  it('a settled outcome is still readable from a FRESH hook instance', () => {
    const first = renderHook(() => useModelEditAuthority(FACTOR_A))

    let attemptId: string | null = null
    act(() => {
      const proposal = first.result.current.proposeFactorValue(21000)
      expect(proposal.outcome).toBe('dispatched')
      attemptId = proposal.attemptId
    })
    expect(attemptId).toBeTruthy()

    // ⚠ THE GRAPH CARRIES A LITERAL 21000, not a number read back out of the
    // ledger. So this also pins that the authority recorded the magnitude it
    // SENT — if it recorded anything else, this settles `refused` and the
    // assertion below fails.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      coldReadGraph([
        { id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' },
      ]),
    )

    // The panel goes away — the user switched tabs.
    first.unmount()

    // A brand-new hook instance, exactly as a remount produces.
    const second = renderHook(() => useModelEditAuthority(FACTOR_A))
    const retained = second.result.current.completionFor(attemptId)
    expect(retained?.attemptId).toBe(attemptId)
    expect(retained?.nodeId).toBe(FACTOR_A)
    expect(retained?.completion).toEqual({
      phase: 'committed',
      canonical: { value: 0.7, rawValue: 21000, source: 'user_override' },
    })
    second.unmount()
  })

  it('an UNRESOLVED outcome survives too — uncertainty must not be forgotten', () => {
    const first = renderHook(() => useModelEditAuthority(FACTOR_A))
    let attemptId: string | null = null
    act(() => {
      attemptId = first.result.current.proposeFactorValue(21000).attemptId
    })
    markModelEditUnresolved(attemptId, 'The turn was interrupted before the change settled.')
    first.unmount()

    const second = renderHook(() => useModelEditAuthority(FACTOR_A))
    expect(second.result.current.completionFor(attemptId)?.completion).toEqual({
      phase: 'unresolved',
      reason: 'The turn was interrupted before the change settled.',
    })
    second.unmount()
  })

  it('the authority mints one attempt per proposal, never a shared one', () => {
    const view = renderHook(() => useModelEditAuthority(FACTOR_A))
    let firstId: string | null = null
    let secondId: string | null = null
    act(() => {
      firstId = view.result.current.proposeFactorValue(21000).attemptId
    })
    act(() => {
      secondId = view.result.current.proposeFactorValue(24000).attemptId
    })
    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()
    expect(firstId).not.toBe(secondId)
    view.unmount()
  })
})
