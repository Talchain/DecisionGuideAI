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
import { describe, it, expect, vi } from 'vitest'
import { awaitSavedModelRead, didValueCommitRevert, valueCommitSettlementWord, VALUE_COMMIT_SETTLEMENT_COPY, type SavedModelReadWord } from '../valueCommitSettlement'

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
  it('the settlement words are different sentences', () => {
    const said = new Set(Object.values(VALUE_COMMIT_SETTLEMENT_COPY).map((c) => c.message))
    // Seven words since recovery Batch B added the moved-base read ('checking' and 'saved'); eight since Batch R3 split
    // the no-reply refusal ('refused') from the 200 that wrote nothing ('not_applied').
    // The failed-read state retains the server's no-write guarantee, separately from an unknown send.
    expect(said.size).toBe(9)
  })

  it('role=alert on a confirmed refusal, never the uncertain states', () => {
    expect(VALUE_COMMIT_SETTLEMENT_COPY.not_applied.role).toBe('alert')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.revision_conflict.role).toBe('alert')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.refused_unread.role).toBe('alert')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.saving.role).toBe('status')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.unconfirmed.role).toBe('status')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.checking.role).toBe('status')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.saved.role).toBe('status')
  })

  it('not_applied is byte-identical to FactorControllablePanel’s own sentence (straight apostrophe)', () => {
    expect(VALUE_COMMIT_SETTLEMENT_COPY.not_applied.message).toBe(
      'Not saved. The model kept its previous value; Olumi\'s reply says why.',
    )
  })
})

/**
 * Batch R3 (served `live/runs/2026-10-12T144844Z/capacity`, row 6): a refused send gets no reply, and a moved-base
 * refusal says what the saved model holds once it has been read.
 */
describe('a refusal claims no reply, and a moved-base read says what the model holds', () => {
  it('a refused send (declined, or a fence verdict) says "Not saved" with no reply clause; a 200 that wrote nothing keeps it', () => {
    for (const detail of [{ refusal: 'declined' as const, reason: 'system_event_refused_no_write' },
      { refusal: 'conflict' as const, conflictCategory: 'turn_fence_stopped' }]) {
      const w = valueCommitSettlementWord('refused', 1, 2, () => 1, detail)
      expect(w).toBe('refused')
      expect(VALUE_COMMIT_SETTLEMENT_COPY[w!].message).toBe('Not saved. The model kept its previous value.')
      expect(VALUE_COMMIT_SETTLEMENT_COPY[w!].role).toBe('alert')
    }
    // CONTRAST: a 200 whose value visibly reverted — the reply came, so it may say where the reason is.
    expect(valueCommitSettlementWord('sent', 1, 2, () => 1)).toBe('not_applied')
  })

  /** Moves the base once, then reports the word the read settles on. */
  function readSettlesOn(held: number, opts: { beforeCommit: number; committedTo: number }): SavedModelReadWord | null {
    vi.useFakeTimers()
    try {
      let base = 'revision-3'
      let listener: (() => void) | null = null
      let said: SavedModelReadWord | null = null
      awaitSavedModelRead({
        baseBeforeRead: base, readBase: () => base, subscribe: l => { listener = l; return () => { listener = null } },
        readNow: () => held, onWord: w => { said = w }, ...opts,
      })
      base = 'revision-4'
      listener!()
      vi.advanceTimersByTime(1)
      return said
    } finally {
      vi.useRealTimers()
    }
  }

  it('the read decides: the typed value → saved; the old value → refused; a third value → the revision notice', () => {
    expect(readSettlesOn(0.25, { beforeCommit: 0.1, committedTo: 0.25 })).toBe('saved')
    expect(readSettlesOn(0.1, { beforeCommit: 0.1, committedTo: 0.25 })).toBe('refused')
    // Run 2: tab B typed 5 (0.25) over 2 (0.1); tab A's 4 (0.2) got in first.
    expect(readSettlesOn(0.2, { beforeCommit: 0.1, committedTo: 0.25 })).toBe('revision_conflict')
    expect(VALUE_COMMIT_SETTLEMENT_COPY.revision_conflict.message).toBe('The scenario changed while I was saving, so nothing was saved. Try again.')
  })

  it.each([[2, 4], [70000, 90000]])('a failed read preserves definite non-save without claiming what the model holds (%s → %s)', (beforeCommit, committedTo) => {
    vi.useFakeTimers()
    try {
      const onWord = vi.fn()
      awaitSavedModelRead({ baseBeforeRead: 'known-base', readBase: () => 'known-base',
        subscribe: () => () => undefined, beforeCommit, committedTo,
        readNow: () => { throw new Error('no fresh read is available'); }, onWord, timeoutMs: 1 })
      vi.advanceTimersByTime(2)
      expect(onWord).toHaveBeenCalledTimes(1)
      expect(onWord).toHaveBeenCalledWith('refused_unread')
      expect(VALUE_COMMIT_SETTLEMENT_COPY.refused_unread.message).toBe(
        'Not saved on this attempt. The latest model could not be refreshed. Reload it before editing again.',
      )
      expect(valueCommitSettlementWord('unverified', beforeCommit, committedTo, () => beforeCommit)).toBe('unconfirmed')
    } finally {
      vi.useRealTimers()
    }
  })
})
