/**
 * The PER-EDIT COMPLETION INTERFACE — the four contract points, pinned.
 *
 *   1. a CORRELATED outcome — which attempt this answer belongs to;
 *   2. the CANONICAL resulting value — what the model holds, not what was
 *      optimistically rendered;
 *   3. the CANONICAL SOURCE of that value;
 *   4. a lifecycle that SURVIVES REMOUNT.
 *
 * ⭐⭐ THE LOAD-BEARING TEST IS THE DISCRIMINATING PAIR (`false-success class`).
 * Both arms record a RECEIPT. The ONLY thing that differs between them is the
 * cold-read bytes. So an implementation that trusted the receipt — the measured
 * CEE defect (`edit-graph.ts:2986-2992`, four false successes where the number
 * went to a dead `data/value` key and `observed_state.value` never moved) —
 * reports BOTH arms committed and fails the pair. Neither arm alone shows this.
 *
 * ⚠ THE DEFAULT FIXTURE IS THE **WIRE** SHAPE. `fetchScenarioGraph` returns
 * `scenarios.graph` verbatim, whose nodes carry `observed_state` at the TOP
 * LEVEL with no `data` key. The first cut of this spec used only the CANVAS
 * shape, so the branch that executes in production had zero coverage while
 * every test passed. Both shapes are now exercised and named.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY (attempt id, node id) AND EXPECTATIONS ARE
 * LITERALS. Nothing here reads a value out of the ledger and then asserts the
 * ledger agrees with it.
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
  canColdReadScenario,
  getModelEditAttempt,
  hasAttemptsAwaitingCanonical,
  markCanonicalReadIssued,
  markModelEditUnresolved,
  readCanonicalFactor,
  readCanonicalFactorValue,
  recordModelEditReceipt,
  refuseModelEditAttempt,
  settleModelEditAttemptsFromCanonicalGraph,
} from '../modelEditCompletion'
import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'

/** Real UUIDs — a non-UUID scenario has no cold read at all (see F5 block). */
const SCENARIO = '11111111-2222-4333-8444-555555555555'
const OTHER_SCENARIO = '99999999-8888-4777-8666-555555555555'
const LOCAL_DRAFT_ID = 'local-draft-42'
const FACTOR_A = 'fac_delivery_time'
const FACTOR_B = 'fac_unit_cost'

interface NodeSpec {
  id: string
  value?: number
  rawValue?: number
  source?: string
  /** Node-level `provenance` — RESPONSE-ONLY, and never evidence. */
  provenance?: string
  /** Emit the node with NO observed state at all. */
  noObservedState?: boolean
}

function observedState(n: NodeSpec) {
  return {
    ...(n.value === undefined ? {} : { value: n.value }),
    ...(n.rawValue === undefined ? {} : { raw_value: n.rawValue }),
    ...(n.source === undefined ? {} : { source: n.source }),
  }
}

/**
 * THE PRODUCTION SHAPE. `observed_state` at the top level, no `data` key —
 * `scenarios.graph` verbatim, as `applyDraftResult` destructures it.
 */
function wireGraph(nodes: NodeSpec[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      ...(n.provenance ? { provenance: n.provenance } : {}),
      ...(n.noObservedState ? {} : { observed_state: observedState(n) }),
    })),
  }
}

/** The CANVAS shape — `observed_state` nested under `data`. Also supported. */
function canvasGraph(nodes: NodeSpec[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      data: {
        label: n.id,
        ...(n.provenance ? { provenance: n.provenance } : {}),
        ...(n.noObservedState ? {} : { observed_state: observedState(n) }),
      },
    })),
  }
}

/** Mint an attempt that the receipt channel has already answered. */
function receiptedAttempt(nodeId = FACTOR_A, scenarioId: string | null = SCENARIO) {
  const id = beginModelEditAttempt({
    nodeId,
    scenarioId,
    attemptedValue: 0.7,
    attemptedRawValue: 21000,
  })
  recordModelEditReceipt(id)
  return id
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

    const readAt = markCanonicalReadIssued()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([
        { id: FACTOR_A, value: 0.85, rawValue: 0.85, source: 'user_override' },
        // ⚠ DISAGREES ON **BOTH** BASES. An earlier draft moved only
        // `raw_value` and left `value` equal to the attempt — which now
        // correctly COMMITS, because agreeing on any basis means the model
        // holds the number. A refusal fixture has to refuse on every basis.
        { id: FACTOR_B, value: 0.9, rawValue: 0.9, source: 'cee_inference' },
      ]),
      readAt,
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

  it('two concurrent attempts on the SAME factor settle independently', () => {
    // The first is superseded in value terms but is still its own transaction.
    const first = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.6,
      attemptedRawValue: 18000,
    })
    const second = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.7,
      attemptedRawValue: 21000,
    })
    recordModelEditReceipt(first)
    recordModelEditReceipt(second)

    const readAt = markCanonicalReadIssued()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      readAt,
    )

    // The model holds the SECOND number. The first attempt's number is not in
    // the model, and it is told so on its own id.
    expect(getModelEditAttempt(second)?.completion.phase).toBe('committed')
    expect(getModelEditAttempt(first)?.completion.phase).toBe('refused')
  })

  it('a late receipt-channel answer cannot re-open an attempt that already settled', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')

    refuseModelEditAttempt(attempt, 'late refusal that must be ignored')
    markModelEditUnresolved(attempt, 'late uncertainty that must be ignored')
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')
  })

  it('does not settle an attempt against another scenario’s graph', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      OTHER_SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ the discriminating pair — a receipt cannot buy a commit', () => {
  it('COMMITTED arm — the cold read proves the model holds the number', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'committed',
      canonical: { value: 0.7, rawValue: 21000, source: 'user_override' },
    })
  })

  it('REFUSED arm — the SAME receipt, but the persisted value never moved', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.5, rawValue: 15000, source: 'cee_inference' }]),
      markCanonicalReadIssued(),
    )
    const completion = getModelEditAttempt(attempt)?.completion
    expect(completion?.phase).toBe('refused')
    expect(completion).toMatchObject({
      evidence: 'canonical',
      canonical: { value: 0.5, rawValue: 15000, source: 'cee_inference' },
    })
  })

  it('a receipt on its own is never `committed`', () => {
    const attempt = receiptedAttempt()
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
  })

  it('the CANVAS node shape adjudicates identically to the wire shape', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      canvasGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ the two bases must AGREE — a partial write is not a commit', () => {
  /**
   * ⚠ THE CLASS THE CORPUS PREVIOUSLY EXCLUDED, and its absence is why a
   * `some` → `every` mutant survived 43/43: no fixture ever had `raw_value` and
   * `value` disagreeing, so nothing could tell "any basis agrees" from "every
   * basis agrees". A full kill-rate against a corpus that omits the value class
   * the predicate is ABOUT is a perfect score on the wrong exam.
   *
   * `value` is the magnitude over the node's cap, so the two are two statements
   * of ONE fact. Disagreement means the persisted state is incoherent — one
   * field moved and the other did not — which is the partial-write shape of the
   * measured CEE defect. Both directions are pinned, so neither `some` nor a
   * single-basis rule can pass.
   */
  const SENT_MODEL = 0.7
  const SENT_RAW = 21000

  function attemptSendingBoth() {
    const id = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: SENT_MODEL,
      attemptedRawValue: SENT_RAW,
    })
    recordModelEditReceipt(id)
    return id
  }

  it('RAW agrees but VALUE does not → REFUSED, with the canonical bytes', () => {
    const attempt = attemptSendingBoth()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.5, rawValue: SENT_RAW, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'refused',
      reason: 'The model did not take this change.',
      evidence: 'canonical',
      canonical: { value: 0.5, rawValue: SENT_RAW, source: 'user_override' },
    })
  })

  it('VALUE agrees but RAW does not → REFUSED, with the canonical bytes', () => {
    const attempt = attemptSendingBoth()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: SENT_MODEL, rawValue: 15000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'refused',
      reason: 'The model did not take this change.',
      evidence: 'canonical',
      canonical: { value: SENT_MODEL, rawValue: 15000, source: 'user_override' },
    })
  })

  it('BOTH agree → COMMITTED (the opposite-direction twin)', () => {
    const attempt = attemptSendingBoth()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: SENT_MODEL, rawValue: SENT_RAW, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'committed',
      canonical: { value: SENT_MODEL, rawValue: SENT_RAW, source: 'user_override' },
    })
  })

  it('only ONE basis is comparable, and it agrees → COMMITTED', () => {
    // The graph states no `raw_value`, so `value` is the only statement of the
    // fact available. `every` over one basis is that basis — not a refusal.
    const attempt = attemptSendingBoth()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: SENT_MODEL, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')
  })

  /**
   * ⭐ ZERO bases comparable — the empty-set hole in `every`.
   *
   * `[].every(p)` is `true`, so the ONLY thing standing between "nothing was
   * comparable" and a `committed` receipt is the `bases.length === 0` early
   * return. That guard was reasoned about in the module header and pinned by
   * nothing: deleting the line left all 47 tests GREEN, because every fixture
   * happened to produce at least one basis. It is the same omission that let
   * `some` survive 43/43 — a corpus that never contains the value class cannot
   * certify the code over it (trap 12d/22).
   *
   * REACHABLE, not hypothetical: the read reports `kind: 'value'` whenever
   * EITHER field is present, so a graph carrying `raw_value` but no `value`,
   * adjudicating an attempt that sent no raw magnitude, produces exactly zero
   * comparable bases. Committing there would be the module's own false-success
   * defect, reached through an empty set instead of a bad receipt.
   */
  it('ZERO bases comparable → stays open; an empty set is NOT agreement', () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: SENT_MODEL,
      attemptedRawValue: null, // sent no raw magnitude → basis A unavailable
    })
    recordModelEditReceipt(attempt)
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      // states a raw_value (so the node reads as `value`, not `noValue`) but no
      // `value` → basis B unavailable too
      wireGraph([{ id: FACTOR_A, rawValue: SENT_RAW, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
    expect(getModelEditAttempt(attempt)?.completion.phase).not.toBe('committed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ F2 — bytes read BEFORE the edit may not adjudicate it', () => {
  it('a cold read issued before the receipt leaves the attempt open, not refused', () => {
    // Boot hydration is already in flight when the user commits: its read was
    // issued first, so its bytes describe a model that never saw this edit.
    const staleRead = markCanonicalReadIssued()
    const attempt = receiptedAttempt()

    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.5, rawValue: 15000, source: 'cee_inference' }]),
      staleRead,
    )
    // ⚠ NOT `refused`. The honest phase already exists and this is it.
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
  })

  it('and a later, correctly-ordered read still settles it', () => {
    const staleRead = markCanonicalReadIssued()
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.5, rawValue: 15000, source: 'cee_inference' }]),
      staleRead,
    )
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('committed')
  })

  it('an attempt with no receipt at all is never adjudicated', () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.7,
      attemptedRawValue: 21000,
    })
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.5, rawValue: 15000, source: 'cee_inference' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('pending')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ F3 — a receipt-derived refusal is PROVISIONAL', () => {
  it('canonical evidence overturns a receipt refusal the model actually took', () => {
    // `responseAppliedFactorEdit` returns false for a patch with status
    // 'pending' — a queued-then-applied edit. That must not be the last word.
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR_A,
      scenarioId: SCENARIO,
      attemptedValue: 0.7,
      attemptedRawValue: 21000,
    })
    refuseModelEditAttempt(attempt, 'The model did not take this change.')
    expect(getModelEditAttempt(attempt)?.completion).toMatchObject({
      phase: 'refused',
      evidence: 'receipt',
    })

    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'committed',
      canonical: { value: 0.7, rawValue: 21000, source: 'user_override' },
    })
  })

  it('but a CANONICAL refusal is terminal', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.5, rawValue: 15000, source: 'cee_inference' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toMatchObject({ evidence: 'canonical' })

    // A contradictory later read cannot flip a settled canonical verdict.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('refused')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('contract 3 — provenance from observed_state.source, never NodeV3.provenance', () => {
  it('ignores `provenance: "user_set"` and refuses on the persisted bytes', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([
        {
          id: FACTOR_A,
          value: 0.5,
          rawValue: 15000,
          source: 'cee_inference',
          provenance: 'user_set',
        },
      ]),
      markCanonicalReadIssued(),
    )
    const completion = getModelEditAttempt(attempt)?.completion
    expect(completion?.phase).toBe('refused')
    expect(completion).toMatchObject({ canonical: { source: 'cee_inference' } })
  })

  it('reads the source verbatim off observed_state', () => {
    expect(
      readCanonicalFactorValue(
        wireGraph([
          { id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override', provenance: 'user_set' },
        ]),
        FACTOR_A,
      ),
    ).toEqual({ value: 0.7, rawValue: 21000, source: 'user_override' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ F5 — what the cold read can and cannot establish', () => {
  it('an UNREADABLE graph does NOT manufacture a refusal', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(SCENARIO, { notAGraph: true }, markCanonicalReadIssued())
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('receipted')
    expect(readCanonicalFactor({ notAGraph: true }, FACTOR_A)).toEqual({ kind: 'unreadable' })
  })

  it('a factor DELETED server-side is refused — the graph is readable and says so', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_B, value: 0.4, source: 'cee_inference' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'refused',
      reason: 'This factor is no longer in the model.',
      evidence: 'canonical',
      canonical: null,
    })
  })

  it('a node PRESENT but carrying no observed state is refused, distinctly', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, noObservedState: true }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toMatchObject({
      phase: 'refused',
      reason: 'The model holds no value for this factor.',
    })
  })

  it('observed_state present with BOTH value and raw_value absent is refused', () => {
    const attempt = receiptedAttempt()
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, source: 'cee_inference' }]),
      markCanonicalReadIssued(),
    )
    expect(getModelEditAttempt(attempt)?.completion).toMatchObject({
      phase: 'refused',
      reason: 'The model holds no value for this factor.',
    })
  })

  it('an edit under a LOCAL DRAFT ID resolves honestly — it can never be cold-read', () => {
    expect(canColdReadScenario(LOCAL_DRAFT_ID)).toBe(false)
    expect(canColdReadScenario(SCENARIO)).toBe(true)
    const attempt = receiptedAttempt(FACTOR_A, LOCAL_DRAFT_ID)
    // ⚠ NOT `receipted`. There is no success path for this scenario at all, and
    // leaving it open would render as "still working" for the life of the page.
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('unresolved')
    expect(hasAttemptsAwaitingCanonical(LOCAL_DRAFT_ID)).toBe(false)
  })

  it('the same is true with no scenario id at all', () => {
    const attempt = receiptedAttempt(FACTOR_A, null)
    expect(getModelEditAttempt(attempt)?.completion.phase).toBe('unresolved')
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
              observedState: { value: 0.5, raw_value: 15000, cap: 30000, source: 'cee_inference' },
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
    recordModelEditReceipt(attemptId)

    // ⚠ THE GRAPH CARRIES A LITERAL 21000, not a number read back out of the
    // ledger — so this also pins that the authority recorded the magnitude it
    // SENT. If it recorded anything else this settles `refused`.
    settleModelEditAttemptsFromCanonicalGraph(
      SCENARIO,
      wireGraph([{ id: FACTOR_A, value: 0.7, rawValue: 21000, source: 'user_override' }]),
      markCanonicalReadIssued(),
    )

    first.unmount() // the panel goes away — the user switched tabs

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
