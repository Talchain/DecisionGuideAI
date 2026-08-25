/**
 * THE BOOT-RESTORABLE SET MUST NOTICE THE CONTRACT GROWING — A3 link 6.
 *
 * The sibling of `applyScenarioAnalysisRead.contractPartition.spec.ts`, and it
 * exists for the same reason: `BOOT_RESTORABLE_RUN_STATE_KINDS` is a JUDGEMENT
 * about what a boot read may safely say, not a fact the contract carries, so it
 * cannot be derived — deriving it from the contract would just be the contract,
 * and every kind would be restorable.
 *
 * What IS checkable is that the judgement has been made for every kind the
 * producer admits. Trap 12d: a derived guard proves agreement and can never
 * prove completeness; completeness needs a check NOT derived from the list under
 * test. Here that is `ANALYSIS_RUN_STATE_KINDS`, imported at runtime from the
 * contract itself.
 *
 * ⭐ AND ONE ASSERTION THIS FILE HAS THAT ITS SIBLING DOES NOT: the boot set must
 * be a STRICT SUBSET of the read-terminal set, and `complete_current` must be
 * the exact difference. That relationship IS derivable, it is the whole safety
 * argument of the boot leg, and pinning it means a later widening of either set
 * cannot silently re-admit the currency claim.
 */

import { describe, it, expect } from 'vitest'
import { ANALYSIS_RUN_STATE_KINDS } from '@talchain/schemas/boundary'

import {
  BOOT_RESTORABLE_RUN_STATE_KINDS,
  BOOT_DECLINED_RUN_STATE_KINDS,
  READ_TERMINAL_RUN_STATE_KINDS,
  isBootRestorableRunState,
} from '../applyScenarioAnalysisRead'

describe('the boot-restorable partition tracks the CONTRACT, not a copy of it', () => {
  it('POSITIVE CONTROL — the contract vocabulary is reachable and non-trivial', () => {
    // Without this, a broken import resolving to `undefined`/`[]` makes every
    // assertion below pass vacuously (trap 13). Magnitude matters as much as
    // sign: an empty array satisfies "is an array".
    expect(Array.isArray(ANALYSIS_RUN_STATE_KINDS)).toBe(true)
    expect(ANALYSIS_RUN_STATE_KINDS.length).toBeGreaterThanOrEqual(7)
    expect(ANALYSIS_RUN_STATE_KINDS).toContain('complete_current')
  })

  it('⭐ the two boot sets PARTITION the contract vocabulary exactly — a new kind REDs here', () => {
    const classified = [
      ...BOOT_RESTORABLE_RUN_STATE_KINDS,
      ...BOOT_DECLINED_RUN_STATE_KINDS,
    ].sort()
    const contract = [...ANALYSIS_RUN_STATE_KINDS].sort()

    // GROWTH: a kind the contract has and we have not classified. A new kind
    // must be reasoned about explicitly, not fall silently into the safe
    // default — silence is how a new state stops being noticed.
    expect(contract.filter((k) => !classified.includes(k))).toEqual([])
    // INVENTION: a kind we classify that the contract does not have.
    expect(classified.filter((k) => !contract.includes(k as never))).toEqual([])
    // Exact equality, which also catches a duplicate in either set.
    expect(classified).toEqual(contract)
  })

  it('the two boot sets are DISJOINT — no kind is both restorable and declined', () => {
    const overlap = BOOT_RESTORABLE_RUN_STATE_KINDS.filter((k) =>
      (BOOT_DECLINED_RUN_STATE_KINDS as readonly string[]).includes(k),
    )
    expect(overlap).toEqual([])
  })

  it('the predicate agrees with the declared sets over the WHOLE contract vocabulary', () => {
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const expected = (BOOT_RESTORABLE_RUN_STATE_KINDS as readonly string[]).includes(kind)
      expect({ kind, restorable: isBootRestorableRunState(kind) }).toEqual({
        kind,
        restorable: expected,
      })
    }
  })

  it('⭐ boot ⊂ read-terminal, and the difference is NAMED — three kinds, one reason each', () => {
    // THE SAFETY ARGUMENT, PINNED. The boot leg may restore only kinds the
    // polling leg already considers terminal — never MORE permissive — and the
    // kinds it ADDITIONALLY refuses are refused because THE BOOT MERGE CAN
    // FALSIFY THEM in the interval between CEE composing the verdict and the
    // client reading it:
    //
    //   `complete_current`  asserts CURRENCY the client cannot verify
    //   `blocked`           asserts the model is NOT ANALYSABLE — and the merge
    //                       may supply the very values CEE refused over
    //   `refused`           same shape: a previous session's refusal, asserted
    //                       as still true
    //
    // Only `complete_stale` survives, because staleness is MONOTONE: it cannot
    // become false without a new run, and a new run yields a new verdict.
    //
    // ⚠ THIS ASSERTION EARNED ITS KEEP. It RED-ed when `blocked` / `refused`
    // were removed from the boot set, forcing this reasoning to be restated
    // rather than silently widened — which is exactly what a partition guard is
    // for (trap 12d).
    const terminal = [...READ_TERMINAL_RUN_STATE_KINDS]
    const boot = [...BOOT_RESTORABLE_RUN_STATE_KINDS]

    expect(boot.filter((k) => !(terminal as readonly string[]).includes(k))).toEqual([])
    const difference = terminal.filter((k) => !(boot as readonly string[]).includes(k))
    expect(difference).toEqual(['complete_current', 'blocked', 'refused'])
    // STRICTLY smaller, stated separately so a future widening to equality REDs.
    expect(boot.length).toBeLessThan(terminal.length)
  })

  it('`complete_current` is NEVER boot-restorable — the assertion the whole leg rests on', () => {
    expect(isBootRestorableRunState('complete_current')).toBe(false)
    expect(BOOT_RESTORABLE_RUN_STATE_KINDS).not.toContain('complete_current' as never)
    // ...and it IS a real contract kind, so the assertion above is about the
    // producer's vocabulary rather than about a string nobody emits.
    expect(ANALYSIS_RUN_STATE_KINDS).toContain('complete_current')
  })

  it('CONTRAST CONTROL — the predicate rejects a kind the contract does not carry', () => {
    // Proves the predicate discriminates rather than answering broadly.
    expect(isBootRestorableRunState('complete_stale_XYZ')).toBe(false)
    expect(ANALYSIS_RUN_STATE_KINDS).not.toContain('complete_stale_XYZ' as never)
    // ...against a member it DOES accept, in the same run. Absence is only
    // proven when the target reads false AND the contrast reads true.
    expect(isBootRestorableRunState('complete_stale')).toBe(true)
  })
})
