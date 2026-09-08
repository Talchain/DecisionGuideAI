/**
 * ⭐⭐ THE REASONING TRAIL BELONGED TO THE SESSION, NOT TO THE DECISION.
 *
 * `selectHistory` filtered on STATUS ALONE, over a store persisted under one
 * fixed `sessionStorage` key that **nothing in product code has ever cleared**
 * — swept at `origin/staging`: `strengthen.lifecycle.v1` is removed in exactly
 * one place, inside `_reset`, and every caller of `_reset` is a spec file. The
 * contrast control fires in the same sweep: `olumi-cee-analysis-ready` and the
 * guidance key ARE cleared from product code, so the probe can see a clear
 * where one exists.
 *
 * So a reader who set two findings aside on one decision and then opened
 * another was shown those findings as the NEW decision's reasoning trail —
 * a record of thinking that never happened about it. The trail is precisely
 * the surface a reader trusts to say what they have already considered here.
 *
 * ⚠ THIS IS THE SIBLING STORE'S OWN RULING, APPLIED TO A STORE THAT DID NOT
 * FOLLOW IT. `guidanceStore` states the hazard in as many words: *"an
 * unidentified blob could be adopted by the wrong decision, and a silent write
 * with a wrong key is worse than no persistence at all."* It supplies its
 * identity through a provider installed on the canvas boot path; this store
 * now reads the SAME identity from the SAME place, because a second boot path
 * for one identity is how two stores come to disagree about which decision is
 * open.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  selectActive,
  selectHistory,
  useStrengthenStore,
} from '../strengthenStore'
import type { Recommendation } from '../../../components/results/strengthen/strengthenTypes'

const rec = (id: string, priority = 10): Recommendation => ({
  id,
  helpType: 'clarify',
  title: `Title ${id}`,
  signal: 'signal',
  whyNow: 'why',
  tryThis: 'try',
  sourceLine: 'Source: test.',
  action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', prompt: 'm' },
  targetId: null,
  priority,
})

const s = () => useStrengthenStore.getState()
const DECISION_A = 'scenario-a'
const DECISION_B = 'scenario-b'
let openDecision: string | null = DECISION_A

beforeEach(() => {
  openDecision = DECISION_A
  s()._reset()
  try { sessionStorage.clear() } catch { /* jsdom */ }
})

describe('the reasoning trail belongs to one decision', () => {
  it('a finding set aside on one decision is NOT the next decision History', () => {
    // Decision A: two findings, one set aside.
    s().reconcile([rec('a1'), rec('a2')], 'hash-a', openDecision, 1000)
    s().dismiss('a1', 1001)
    expect(selectHistory(s(), DECISION_A).map((r) => r.id)).toEqual(['a1'])

    // The reader opens a different decision. Nothing clears the store.
    openDecision = DECISION_B
    expect(selectHistory(s(), DECISION_B)).toEqual([])
  })

  it('and it is still there when they go back', () => {
    s().reconcile([rec('a1')], 'hash-a', openDecision, 1000)
    s().dismiss('a1', 1001)
    openDecision = DECISION_B
    expect(selectHistory(s(), DECISION_B)).toEqual([])

    openDecision = DECISION_A
    expect(selectHistory(s(), DECISION_A).map((r) => r.id)).toEqual(['a1'])
  })

  it('keeps each decision own trail when both have one', () => {
    s().reconcile([rec('a1')], 'hash-a', openDecision, 1000)
    s().dismiss('a1', 1001)

    openDecision = DECISION_B
    s().reconcile([rec('b1')], 'hash-b', openDecision, 2000)
    s().markAddressed('b1', 'gave the factor a range', 2001)

    expect(selectHistory(s(), DECISION_B).map((r) => r.id)).toEqual(['b1'])
    expect(selectHistory(s(), DECISION_A).map((r) => r.id)).toEqual(['a1'])
  })

  /**
   * ⭐ THE STAMP IS AUTHORSHIP, NEVER "WHATEVER IS OPEN NOW". Re-stamping on a
   * later write would launder a record into the decision that happened to be
   * on screen — which IS the defect, reached through the fix. `guidanceStore`
   * records the identical distinction for its graph hash, learned there the
   * expensive way.
   */
  it('a later write under another decision does NOT re-stamp the record', () => {
    s().reconcile([rec('a1')], 'hash-a', openDecision, 1000)

    openDecision = DECISION_B
    // A live analysis on B re-grounds the snapshot of an id that fires again.
    s().reconcile([rec('a1')], 'hash-b', openDecision, 2000)
    s().dismiss('a1', 2001)

    expect(selectHistory(s(), DECISION_B)).toEqual([])
    expect(selectHistory(s(), DECISION_A).map((r) => r.id)).toEqual(['a1'])
  })

  /**
   * ⭐ FAIL CLOSED IN BOTH DIRECTIONS. An unknown current decision claims
   * nothing, and an unattributable record is claimed nowhere. Neither is
   * deleted — both are simply not asserted to be this decision's history.
   */
  it('CONTROL: an unknown current decision shows nothing', () => {
    s().reconcile([rec('a1')], 'hash-a', openDecision, 1000)
    s().dismiss('a1', 1001)
    expect(selectHistory(s(), null)).toEqual([])
  })

  it('CONTROL: a record minted with no identity is claimed by no decision', () => {
    // Minted while the identity was unavailable — an honest unknown.
    s().reconcile([rec('x1')], 'hash-x', null, 1000)
    s().dismiss('x1', 1001)

    expect(selectHistory(s(), DECISION_A)).toEqual([])
    // Not deleted — still held, still recoverable, simply unattributed.
    expect(s().records['x1']).toBeTruthy()
    expect(s().records['x1'].scenarioId ?? null).toBeNull()
  })

  /**
   * ⭐ THE OPPOSITE CONTROL FOR SCOPE. `selectActive` answers a DIFFERENT
   * question — what is live now — is read by the parked hero, and is
   * deliberately untouched. A change that also scoped it would alter a surface
   * this lane does not own; this case fails if someone does.
   */
  it('CONTROL: selectActive is unscoped, deliberately', () => {
    s().reconcile([rec('a1')], 'hash-a', openDecision, 1000)
    openDecision = DECISION_B
    expect(selectActive(s()).map((r) => r.id)).toEqual(['a1'])
  })
})
