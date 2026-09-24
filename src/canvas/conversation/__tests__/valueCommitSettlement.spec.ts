/**
 * `didValueCommitRevert` and `VALUE_COMMIT_SETTLEMENT_COPY` — the pure logic
 * shared between `FactorControllablePanel`'s value editor and the on-canvas
 * `NodeValueEditor`, tested directly and exhaustively here.
 *
 * ⚠ WHY A DIRECT SPEC, NOT ONLY THE TWO INTEGRATION SUITES. Both real callers
 * guard against a same-value commit BEFORE ever reaching this predicate (a
 * commit that changes nothing is a no-op, never a dispatch), so
 * `optimisticallyWrittenTo === beforeCommit` is structurally unreachable
 * through either caller's own invariants. A mutant that drops the "did the
 * optimistic write land at all?" half of this predicate therefore SURVIVES
 * both `NodeValueEditor.settlementWords.spec.tsx` and
 * `FactorControllablePanel.aRefusedEditIsNotShownAsSaved.spec.tsx` — measured,
 * not assumed. This file exercises the predicate unconstrained by either
 * caller's upstream guard, so that exact case is pinned directly.
 */
import { describe, it, expect } from 'vitest'
import { didValueCommitRevert, VALUE_COMMIT_SETTLEMENT_COPY } from '../valueCommitSettlement'

describe('didValueCommitRevert', () => {
  it('TRUE — the optimistic write landed, then moved back to the pre-commit value', () => {
    expect(didValueCommitRevert(70000, 150000, 70000)).toBe(true)
  })

  it('FALSE — the optimistic write landed and STAYS there (accepted)', () => {
    expect(didValueCommitRevert(70000, 80000, 80000)).toBe(false)
  })

  /**
   * ⚠ THIS PREDICATE TAKES A SNAPSHOT, NOT A HISTORY, AND CANNOT SEE "HAS NOT
   * LANDED YET" ON ITS OWN. Given exactly these three numbers it reads
   * identically to a genuine revert — that is why `NodeValueEditor` never
   * calls it until its OWN `sawOptimisticWrite` ref confirms the optimistic
   * write has been observed to land at least once first (see that file's
   * header). Pinned here so the asymmetry is a stated property of this
   * function, not a surprise found by reading two call sites.
   */
  it('reads identically to a revert when called before the write has ever landed — enforced by the CALLER, not here', () => {
    expect(didValueCommitRevert(70000, 150000, 70000)).toBe(true)
  })

  /**
   * ⭐⭐ THE CASE NEITHER INTEGRATION SUITE CAN REACH (see this file's header).
   * If the optimistic write is a NO-OP — it "landed" at the exact value the
   * field already held — a later observation still sitting at that value must
   * NOT read as a revert: nothing was ever un-done, because nothing ever
   * genuinely moved.
   */
  it('⭐⭐ FALSE — the "optimistic write" never actually moved the value (a same-value commit)', () => {
    expect(didValueCommitRevert(70000, 70000, 70000)).toBe(false)
  })

  it('FALSE — a THIRD value now, neither the pre- nor post-commit one (some other change)', () => {
    expect(didValueCommitRevert(70000, 150000, 42)).toBe(false)
  })

  it('a null beforeCommit is a real value the field can revert BACK TO — a first-ever set that got refused', () => {
    // beforeCommit=null means "the factor had no value yet"; a refusal
    // genuinely puts it back there, so this is a TRUE revert, not an edge
    // case to special-case away.
    expect(didValueCommitRevert(null, 150000, null)).toBe(true)
  })

  it('FALSE when nothing was ever written (both the pre- and "written-to" value are null)', () => {
    expect(didValueCommitRevert(null, null, null)).toBe(false)
  })
})

describe('VALUE_COMMIT_SETTLEMENT_COPY', () => {
  it('the four words are four different sentences', () => {
    const said = new Set(Object.values(VALUE_COMMIT_SETTLEMENT_COPY).map((c) => c.message))
    expect(said.size).toBe(4)
  })

  it('role=alert ONLY on not_applied — the one confirmed fact, never the two uncertain ones', () => {
    expect(VALUE_COMMIT_SETTLEMENT_COPY.not_applied.role).toBe('alert')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.saving.role).toBe('status')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.unconfirmed.role).toBe('status')
  })

  it('not_applied is byte-identical to FactorControllablePanel’s own sentence (straight apostrophe)', () => {
    expect(VALUE_COMMIT_SETTLEMENT_COPY.not_applied.message).toBe(
      'Not saved. The model kept its previous value; Olumi\'s reply says why.',
    )
  })
})
