/**
 * THE LEADER-CLAIMABLE RUN STATES PARTITION THE CONTRACT'S OWN VOCABULARY.
 *
 * ⭐ WHY THIS EXISTS SEPARATELY FROM THE SETS IT CHECKS. `store.ts` decides
 * whether a producer's permission may clear a withholding by asking whether the
 * run state is in `LEADER_CLAIMABLE_RUN_STATE_KINDS`. A hand-kept list inside
 * the module that consumes it proves only that the module agrees with itself
 * (CLAUDE.md trap 12d: derivation proves agreement, a partition proves
 * completeness). `ANALYSIS_RUN_STATE_KINDS` is an INDEPENDENT source, imported
 * at runtime from the contract, and it is what makes "every kind is classified"
 * checkable rather than assumed.
 *
 * ⛔ THE FAILURE IT PREVENTS IS SILENT. A contract that gains a kind falls into
 * the deny default in `store.ts` — the safe direction, and an invisible one. A
 * new state would simply never restore a leader and nobody would know why. This
 * spec makes that arrival LOUD.
 *
 * ⛔⛔ AND IT PINS THE DISTINCTION THAT WAS NEARLY LOST. `blocked` and `refused`
 * are in the boot leg's `READ_TERMINAL_RUN_STATE_KINDS` and must NOT be here:
 * "may the boot leg rehydrate this verdict?" and "does this state license naming
 * a leading option?" are different questions under similar names (trap 21). The
 * first draft of the gate reused that predicate, which would have permitted a
 * designation over a blocked analysis. The assertion below is what stops that
 * reuse returning.
 */
import { describe, it, expect } from 'vitest'
import { ANALYSIS_RUN_STATE_KINDS } from '@talchain/schemas/boundary'
import {
  LEADER_CLAIMABLE_RUN_STATE_KINDS,
  LEADER_UNCLAIMABLE_RUN_STATE_KINDS,
} from '../store'
import { READ_TERMINAL_RUN_STATE_KINDS } from '../hydrate/applyScenarioAnalysisRead'

describe('leader-claimable run states', () => {
  it('PRECONDITION: the contract vocabulary is non-empty, or every assertion below is vacuous', () => {
    expect(ANALYSIS_RUN_STATE_KINDS.length).toBeGreaterThan(0)
  })

  it('the two sets PARTITION the contract exactly — no kind unclassified, none invented', () => {
    const union = [...LEADER_CLAIMABLE_RUN_STATE_KINDS, ...LEADER_UNCLAIMABLE_RUN_STATE_KINDS]
    expect([...union].sort()).toEqual([...ANALYSIS_RUN_STATE_KINDS].sort())
  })

  it('the two sets are DISJOINT — a kind cannot be both', () => {
    const overlap = LEADER_CLAIMABLE_RUN_STATE_KINDS.filter((k) =>
      (LEADER_UNCLAIMABLE_RUN_STATE_KINDS as readonly string[]).includes(k),
    )
    expect(overlap).toEqual([])
  })

  it('⛔ blocked and refused are terminal for the BOOT leg and NOT claimable here — trap 21, pinned', () => {
    // The reuse that was nearly shipped. Both halves asserted, so this REDs if
    // either the boot set stops containing them or this set starts to.
    for (const kind of ['blocked', 'refused'] as const) {
      expect(
        (READ_TERMINAL_RUN_STATE_KINDS as readonly string[]).includes(kind),
        `${kind} should still be boot-terminal, or this test is checking nothing`,
      ).toBe(true)
      expect(
        (LEADER_CLAIMABLE_RUN_STATE_KINDS as readonly string[]).includes(kind),
        `${kind} must never license naming a leading option`,
      ).toBe(false)
    }
  })
})
