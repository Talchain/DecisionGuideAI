/**
 * ROADMAP 2.638 S2 — REVERSIBILITY, PER VALUE (Ruling 1's constraint).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A LOCAL CLEAR IS NOT A REVERSAL — the derivation this spec pins
 * ─────────────────────────────────────────────────────────────────────────────
 * "Confirm as is" writes NO number (`CalibrateDrillIn.commit(..., {writeValue:
 * false})`), so the value never moved and the reversal is exact by
 * construction: only the CLAIM has to be withdrawn. There is nothing to
 * restore, which is why this needs no snapshot.
 *
 * But a withdrawal that only deletes the local stamp is UNDONE ON THE NEXT
 * BOOT, silently. Measured at the bytes on both sides:
 *   · CEE's `set_factor_value` stamps `observed_state.source = USER_EDIT_SOURCE
 *     = 'user_override'` server-side on every applied edit — including a
 *     confirm-as-is, which CEE receipts as `noop`
 *     (`canonicalise-value-ops.ts:280`, `set-factor-value.ts:421`, CEE staging
 *     `d5b64246`). ⚠ This falsifies the standing in-repo claim that "CEE's bag
 *     can never carry a user source"; 2.396(b) landed exactly that write.
 *   · `mergeServerGraphOnHydrate` restores user stamps only from the snapshot
 *     the PRE-merge node held (`restoreUserProvenance` writes only locations
 *     the snapshot carried). A cleared stamp means an EMPTY snapshot, so the
 *     server's `user_override` survives the overlay untouched and the row is
 *     "checked by you" again on the next reload.
 *
 * So the withdrawal has to be a DURABLE, POSITIVE fact, not an absence — the
 * same shape as `userReviewedStrength`, the UI-only edge marker this codebase
 * already sanctions (`hydrateProvenance.ts:159-163`): a top-level `data` key
 * the wire never carries, which `overlayNode`'s `{...existing.data,
 * ...mapped.data}` spread therefore cannot clear.
 *
 * ⚠ Scope: withdrawing a confirmation changes NO number and NO analysis — the
 * confirmation never changed one either (that is S4, Neil-gated). This is a
 * disclosure reversal, and the copy must not promise more.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { withdrawUserConfirmation, isConfirmationWithdrawn } from '../hydrateProvenance'
import { isReviewedByUser } from '../../components/pre-analysis/utils/isReviewedByUser'
import { confirmOptimisticFactorEdit } from '../../conversation/optimisticFactorEdit'

const SCENARIO = '11111111-2222-4333-8444-555555555555'

function seed(nodes: unknown[]): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: structuredClone(nodes) as never,
    edges: [] as never,
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

function nodeById(id: string): Node {
  return useCanvasStore.getState().nodes.find((n: any) => n.id === id) as unknown as Node
}

/** A factor the user CONFIRMED AS IS: the stamp is `user_confirmed`, value untouched. */
function confirmedNode(value = 0.7) {
  return {
    id: 'fac_pricing_level',
    type: 'factor',
    position: { x: 10, y: 20 },
    data: {
      label: 'Pricing level',
      kind: 'factor',
      provenance: 'user_set',
      observedState: { value, source: 'user_confirmed', extractionType: 'explicit' },
      observed_state: { value, source: 'user_confirmed', extractionType: 'explicit' },
    },
  }
}

/**
 * What CEE's persisted graph actually holds after that same confirm turn —
 * `user_override`, because CEE collapses confirm and edit into one stamp.
 * The value is IDENTICAL (a confirm-as-is moves nothing), which is exactly the
 * branch that restores user stamps.
 */
function serverNodeAfterConfirm(value = 0.7) {
  return {
    id: 'fac_pricing_level',
    kind: 'factor',
    label: 'Pricing level',
    provenance: 'user_set',
    observed_state: { value, source: 'user_override' },
  }
}

beforeEach(() => {
  seed([confirmedNode()])
})

describe('2.638 S2 · withdrawUserConfirmation — the reversal is exact', () => {
  it('clears the claim at every rung isReviewedByUser reads, and leaves the VALUE alone', () => {
    const before = nodeById('fac_pricing_level')
    const nextData = withdrawUserConfirmation(before.data as Record<string, unknown>)

    // The claim is gone …
    const withdrawn = { ...before, data: nextData } as unknown as Node
    expect(isReviewedByUser(withdrawn)).toBe(false)
    expect(isConfirmationWithdrawn(nextData)).toBe(true)
    expect((nextData as any).observedState.source).toBeUndefined()
    expect((nextData as any).observed_state.source).toBeUndefined()
    // ⚠ The node-level `provenance` is CEE's field and is deliberately left
    // standing (the UI never writes it, and a deletion is not even expressible
    // through the store's shallow-merge `updateNode`). It does not need
    // clearing: the withdrawal marker is the FIRST rung `isReviewedByUser`
    // consults, which is why the predicate above already reads false.
    expect((nextData as any).provenance).toBe('user_set')

    // … and the number is untouched, in both spellings. A confirm-as-is never
    // moved it, so a withdrawal that moved it would be inventing a revert.
    expect((nextData as any).observedState.value).toBe(0.7)
    expect((nextData as any).observed_state.value).toBe(0.7)
    expect((nextData as any).label).toBe('Pricing level')
  })

  it('is inert on a node that was never confirmed (returns the same reference)', () => {
    const data = { label: 'X', observedState: { value: 1, source: 'cee_inference' } }
    expect(withdrawUserConfirmation(data)).toBe(data)
    expect(isConfirmationWithdrawn(data)).toBe(false)
  })

  it('withdraws a node reviewed ONLY through the wire-carried provenance rung', () => {
    // No `source` stamp anywhere — the badge came from `data.provenance ===
    // 'user_set'`, the rung CEE writes. The withdrawal must still bite, or a
    // value confirmed on another device could never be un-confirmed here.
    const node = {
      id: 'fac_wire_only',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: 'Wire only', kind: 'factor', provenance: 'user_set', observed_state: { value: 0.4 } },
    } as unknown as Node
    expect(isReviewedByUser(node)).toBe(true)

    const next = withdrawUserConfirmation(node.data as Record<string, unknown>)
    expect(next).not.toBe(node.data)
    expect(isConfirmationWithdrawn(next)).toBe(true)
    expect(isReviewedByUser({ ...node, data: next } as unknown as Node)).toBe(false)
  })

  it('leaves a PRODUCER stamp in place — the server owns those', () => {
    const data = {
      label: 'X',
      provenance: 'ai_inferred',
      observedState: { value: 1, source: 'user_confirmed' },
      observed_state: { value: 1, source: 'cee_inference' },
    }
    const next = withdrawUserConfirmation(data) as any
    expect(next.observedState.source).toBeUndefined()
    expect(next.observed_state.source).toBe('cee_inference')
    expect(next.provenance).toBe('ai_inferred')
    expect(next.observedState.value).toBe(1)
  })
})

describe('2.638 S2 · the withdrawal SURVIVES the boot merge (the round trip)', () => {
  it('a confirmation the user did NOT withdraw survives reload — the control', () => {
    const result = mergeServerGraphOnHydrate({
      nodes: [serverNodeAfterConfirm()],
      edges: [],
    })
    expect(result.accepted, result.refusedReason ?? '').toBe(true)
    const after = nodeById('fac_pricing_level')
    // Identity-bound: this node, still reviewed, still CONFIRMED (not demoted
    // to the server's collapsed `user_override`).
    expect(isReviewedByUser(after)).toBe(true)
    expect((after.data as any).observed_state.source).toBe('user_confirmed')
  })

  it('a WITHDRAWN confirmation is not resurrected by CEE\'s own user_override stamp', () => {
    const before = nodeById('fac_pricing_level')
    useCanvasStore.setState({
      nodes: [
        { ...before, data: withdrawUserConfirmation(before.data as Record<string, unknown>) },
      ] as never,
    } as never)
    expect(isReviewedByUser(nodeById('fac_pricing_level'))).toBe(false)

    const result = mergeServerGraphOnHydrate({
      nodes: [serverNodeAfterConfirm()],
      edges: [],
    })
    expect(result.accepted, result.refusedReason ?? '').toBe(true)

    const after = nodeById('fac_pricing_level')
    // THE POINT. The server bag lands (it is authoritative for the value), and
    // it carries `source: 'user_override'` — but the user withdrew the claim,
    // and the client is the only holder of that fact.
    expect(isConfirmationWithdrawn(after.data)).toBe(true)
    expect(isReviewedByUser(after)).toBe(false)
    // The VALUE still comes from the server, unchanged by the withdrawal.
    expect((after.data as any).observed_state.value).toBe(0.7)
  })

  it('a re-confirmation after a withdrawal is honoured — through the REAL receipt path', () => {
    // Not a hand-rolled clear: this drives `confirmOptimisticFactorEdit`, the
    // one place a user claim is earned. A withdrawal that outlived a receipted
    // re-confirmation would make the second confirmation invisible, and only
    // this path can prove it does not.
    const before = nodeById('fac_pricing_level')
    useCanvasStore.setState({
      nodes: [
        { ...before, data: withdrawUserConfirmation(before.data as Record<string, unknown>) },
      ] as never,
    } as never)
    expect(isReviewedByUser(nodeById('fac_pricing_level'))).toBe(false)

    const outcome = confirmOptimisticFactorEdit({
      nodeId: 'fac_pricing_level',
      sentValue: 0.7,
      prevObservedState: { value: 0.7 },
      prevDisplayValue: undefined,
      reviewedStamp: { source: 'user_confirmed', extractionType: 'explicit' },
    })
    expect(outcome).toBe('stamped')

    const after = nodeById('fac_pricing_level')
    expect(isConfirmationWithdrawn(after.data)).toBe(false)
    expect(isReviewedByUser(after)).toBe(true)
    expect((after.data as any).observedState.source).toBe('user_confirmed')
  })
})
