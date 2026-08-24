/**
 * ROADMAP 2.1271 — THE TERMINAL SET MUST NOTICE THE CONTRACT GROWING.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS WRONG WITH THE SET AS SHIPPED
 * ═══════════════════════════════════════════════════════════════════════════
 * `READ_TERMINAL_RUN_STATE_KINDS` is a hardcoded four-element array, arrived at
 * by reading the contract's `.describe()` prose at 0.46.0 by hand. Nothing
 * asserted it against the producer, so it was a hand-maintained mirror of a
 * vocabulary that lives in another repo (trap 12).
 *
 * It errs WIDE rather than narrow — an unclassified kind falls to the
 * non-terminal default, which declines to write and keeps polling — so it was
 * never a correctness blocker. But the failure it does have is SILENT: a
 * contract that gains an eighth kind produces no signal anywhere, and this
 * applier simply never learns to handle it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A PARTITION ASSERTION AND NOT A DERIVATION
 * ═══════════════════════════════════════════════════════════════════════════
 * The terminal set is a JUDGEMENT (what can a fact read prove?), not a fact
 * carried in the contract, so it cannot be derived — deriving it from the
 * contract would just be the contract, and every kind would be terminal.
 *
 * What IS checkable is that the judgement has been made for every kind the
 * contract admits. Trap 12d: a derived guard proves agreement and can never
 * prove completeness; completeness needs a check that is NOT derived from the
 * list under test. Here that check is the contract's own exported vocabulary,
 * `ANALYSIS_RUN_STATE_KINDS` — an independent source, imported at runtime, that
 * grows when the producer grows.
 *
 * So: terminal ⊎ non-terminal ≡ ANALYSIS_RUN_STATE_KINDS. Exactly. A new kind
 * belongs to neither of our sets and REDs here, by name.
 */

import { describe, it, expect } from 'vitest'
import { ANALYSIS_RUN_STATE_KINDS } from '@talchain/schemas/boundary'

import {
  READ_TERMINAL_RUN_STATE_KINDS,
  READ_NON_TERMINAL_RUN_STATE_KINDS,
  isReadTerminalRunState,
} from '../applyScenarioAnalysisRead'

describe('the read-terminal partition tracks the CONTRACT, not a copy of it', () => {
  it('POSITIVE CONTROL — the contract vocabulary is actually reachable and non-trivial', () => {
    // Without this, a broken import resolving to `undefined`/`[]` would make
    // every assertion below pass vacuously (trap 13). The magnitude matters as
    // much as the sign: an empty array would satisfy "is an array".
    expect(Array.isArray(ANALYSIS_RUN_STATE_KINDS)).toBe(true)
    expect(ANALYSIS_RUN_STATE_KINDS.length).toBeGreaterThanOrEqual(7)
    // A member we can name, so the array is the one we think it is.
    expect(ANALYSIS_RUN_STATE_KINDS).toContain('complete_current')
  })

  it('⭐ the two sets PARTITION the contract vocabulary exactly — a new kind REDs here', () => {
    const classified = [
      ...READ_TERMINAL_RUN_STATE_KINDS,
      ...READ_NON_TERMINAL_RUN_STATE_KINDS,
    ].sort()
    const contract = [...ANALYSIS_RUN_STATE_KINDS].sort()

    // GROWTH: a kind the contract has and we have not classified.
    const unclassified = contract.filter((k) => !classified.includes(k))
    expect(unclassified).toEqual([])

    // SHRINK / INVENTION: a kind we classify that the contract does not have.
    const invented = classified.filter((k) => !contract.includes(k as never))
    expect(invented).toEqual([])

    // And exact equality, which also catches a duplicate in either of our sets.
    expect(classified).toEqual(contract)
  })

  it('the two sets are DISJOINT — no kind is both terminal and not', () => {
    const overlap = READ_TERMINAL_RUN_STATE_KINDS.filter((k) =>
      (READ_NON_TERMINAL_RUN_STATE_KINDS as readonly string[]).includes(k),
    )
    expect(overlap).toEqual([])
  })

  it('the predicate agrees with the declared sets over the WHOLE contract vocabulary', () => {
    // Binds the runtime predicate to the same source of truth, so a set edited
    // without touching `isReadTerminalRunState` cannot drift past this file.
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const expected = (READ_TERMINAL_RUN_STATE_KINDS as readonly string[]).includes(kind)
      expect({ kind, terminal: isReadTerminalRunState(kind) }).toEqual({ kind, terminal: expected })
    }
  })

  it('CONTRAST CONTROL — the predicate rejects a kind the contract does not carry', () => {
    // Proves the predicate discriminates rather than answering `true` broadly.
    expect(isReadTerminalRunState('complete_current_XYZ')).toBe(false)
    expect(ANALYSIS_RUN_STATE_KINDS).not.toContain('complete_current_XYZ' as never)
  })
})
