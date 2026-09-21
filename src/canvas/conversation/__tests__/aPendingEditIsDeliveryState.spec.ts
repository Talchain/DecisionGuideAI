/**
 * ⭐⭐⭐ THE WITNESS CODEX REQUIRED, at its own wording.
 *
 * Independent review of #1837 (21 Sep 2026, `CHANGES_REQUIRED` at
 * `ef1186b64331d429b4c11f08fb996f43169a0e99`) specified the acceptance test, and
 * this file is it rather than an approximation of it:
 *
 * > with an AI-inferred `unit: "scale"` factor, type `0.77` and make dispatch
 * > remain unresolved; the card must continue to show `0.77`, keep the editor
 * > reachable, and make no confirmed-user or saved claim. **Opposite control: an
 * > untouched AI-inferred unanchored scale value remains suppressed.** Then
 * > resolve the same edit both ways […]
 *
 * ⚠ THE OPPOSITE CONTROL IS THE LOAD-BEARING HALF. Without it, a change that
 * simply stopped suppressing unanchored scale values would satisfy every other
 * assertion here — and that is the one thing the fix must NOT do, because it is
 * what stops `0.77 scale` reading as a measurement the product never made.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import {
  markFactorEditInFlight,
  settleFactorEditInFlight,
  pendingFactorEditValue,
  subscribePendingFactorEdits,
  __resetPendingFactorEditsForTest,
} from '../pendingFactorEdit'

/** The exact shape witnessed on the deployed board: CEE's inference, no anchor. */
const AI_INFERRED_SCALE = {
  label: 'Operational Overhead on Data Team',
  observedState: {
    value: 0.5,
    unit: 'scale',
    source: 'cee_inference',
    extractionType: 'inferred',
    factor_type: 'other',
  },
}

/** The same node after the local write: value moved, provenance untouched. */
const AFTER_LOCAL_WRITE = {
  label: 'Operational Overhead on Data Team',
  observedState: { value: 0.77, unit: 'scale', source: 'cee_inference', factor_type: 'other' },
}

beforeEach(() => { __resetPendingFactorEditsForTest() })

describe('the projection does not hide a number the person is watching', () => {
  it('⛔ OPPOSITE CONTROL: an untouched AI-inferred unanchored scale value stays SUPPRESSED', () => {
    expect(
      factorDisplayText(AI_INFERRED_SCALE),
      'the suppression has been loosened globally — an uncalibrated machine estimate is now rendering as though it were measured',
    ).toBeNull()
  })

  it('⛔ REPRODUCTION: after the local write, with nothing pending, the card still shows NOTHING', () => {
    // This is the witnessed defect. It must remain true with no pending edit,
    // because the canonical state genuinely carries no authorship yet.
    expect(factorDisplayText(AFTER_LOCAL_WRITE)).toBeNull()
  })

  it('⭐ with the edit IN FLIGHT, the exact typed number is visible', () => {
    const out = factorDisplayText({ ...AFTER_LOCAL_WRITE, pending_user_value: 0.77 })
    expect(out, 'the product is hiding the number the user just typed').not.toBeNull()
    expect(String(out)).toContain('0.77')
  })

  it('⭐ and it makes NO confirmed-user or saved claim — the number only, no stamp word', () => {
    const out = String(factorDisplayText({ ...AFTER_LOCAL_WRITE, pending_user_value: 0.77 }))
    for (const claim of ['confirmed', 'Confirmed', 'checked', 'Checked', 'saved', 'Saved', 'by you']) {
      expect(out, `the pending readout asserts "${claim}" — pending is delivery state, not authorship`).not.toContain(claim)
    }
  })

  it('⭐ a pending value NEVER rescues a DIFFERENT number (identity bind)', () => {
    // A stale in-flight figure must not make some other value visible. Without
    // the `pending_user_value === value` bind this would be a value predicate
    // any object could satisfy.
    expect(
      factorDisplayText({ ...AFTER_LOCAL_WRITE, pending_user_value: 0.42 }),
      'a stale pending value made an unrelated number visible',
    ).toBeNull()
  })

  it('a real unit is unaffected either way — the rescue is scoped to the unanchored case', () => {
    const anchored = {
      label: 'Annual Platform Cost',
      observedState: { value: 0.5, raw_value: 60000, unit: '£', source: 'cee_inference' },
    }
    const before = factorDisplayText(anchored)
    const after = factorDisplayText({ ...anchored, pending_user_value: 0.5 })
    expect(before).not.toBeNull()
    expect(after, 'the pending arm changed a case it has no business touching').toBe(before)
  })
})

describe('the in-flight register is keyed by node AND value', () => {
  it('POSITIVE CONTROL: it can hold and report a value at all', () => {
    markFactorEditInFlight('fac_a', 0.77)
    expect(pendingFactorEditValue('fac_a')).toBe(0.77)
    expect(pendingFactorEditValue('fac_b')).toBeNull()
  })

  it('settles on an exact match — acceptance, refusal and interruption alike', () => {
    markFactorEditInFlight('fac_a', 0.77)
    expect(settleFactorEditInFlight('fac_a', 0.77)).toBe(true)
    expect(pendingFactorEditValue('fac_a')).toBeNull()
  })

  it('⭐ STANDS DOWN on a superseded value, rather than blanking the newer one', () => {
    // The defect this prevents: a late receipt for 0.77 arrives after the user
    // has typed 0.90. Clearing on node id alone would hide the 0.90 they can
    // see, re-creating the very defect. Same precondition
    // `revertOptimisticFactorEdit` uses, for the same reason.
    markFactorEditInFlight('fac_a', 0.77)
    markFactorEditInFlight('fac_a', 0.9)
    expect(settleFactorEditInFlight('fac_a', 0.77)).toBe(false)
    expect(pendingFactorEditValue('fac_a'), 'a late settlement blanked a newer edit').toBe(0.9)
    expect(settleFactorEditInFlight('fac_a', 0.9)).toBe(true)
    expect(pendingFactorEditValue('fac_a')).toBeNull()
  })

  it('refuses a non-finite value, so NaN cannot become a permanent pending state', () => {
    markFactorEditInFlight('fac_a', Number.NaN)
    expect(pendingFactorEditValue('fac_a')).toBeNull()
  })

  it('notifies subscribers on both edges, and unsubscribes cleanly', () => {
    let hits = 0
    const stop = subscribePendingFactorEdits(() => { hits++ })
    markFactorEditInFlight('fac_a', 0.77)
    settleFactorEditInFlight('fac_a', 0.77)
    expect(hits, 'the card would never re-render on a pending change').toBeGreaterThanOrEqual(2)
    stop()
    const atStop = hits
    markFactorEditInFlight('fac_b', 0.5)
    expect(hits, 'unsubscribe leaked — a listener fired after being removed').toBe(atStop)
  })

  it('⛔ it is NOT canonical state: nothing here touches the graph or its provenance', async () => {
    // A guard against the tempting "just put it in the store" refactor. The
    // canonical graph is persisted, autosaved and exported; an unacknowledged
    // keystroke must reach none of those.
    // ⚠ MATCH CODE, NOT PROSE. The first version of this assertion scanned the
    // whole file and RED on the module's own docblock, which says "NOT in
    // `useCanvasStore`" — the guard was measuring the comment that explains it
    // (CLAUDE.md: grep a structured file and you measure the grep). Strip
    // comments first, then look in import position.
    const src = await import('../pendingFactorEdit?raw').catch(() => null)
    if (!src) return
    const code = String((src as { default?: string }).default ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
      .join('\n')
    expect(code, 'the module now imports canonical state — pending must stay transient').not.toMatch(/import[^\n]*(useCanvasStore|canvas\/store)/)
    expect(code, 'the module writes provenance — pending is delivery state, not authorship').not.toMatch(/setObservedSource|observedState/)
    // Non-vacuity: the stripper must still be able to see real code.
    expect(code, 'comment stripping ate the module').toMatch(/export function markFactorEditInFlight/)
  })
})

describe('⭐ resolve the SAME edit both ways — the second half of the required witness', () => {
  /**
   * Codex asked for both outcomes, not just the pending frame:
   *
   * > Then resolve the same edit both ways: an applied receipt clears pending
   * > and leaves the accepted value visible under the earned stamp; refusal
   * > clears pending and restores the prior display.
   *
   * Tested at the seam that decides what the USER SEES — the register plus the
   * one projection. The canonical writes themselves are
   * `confirmOptimisticFactorEdit` / `revertOptimisticFactorEdit`, which have
   * their own suites; duplicating them here would test someone else's owner.
   */
  it('APPLIED: pending clears and the accepted value stays visible under the EARNED stamp', () => {
    markFactorEditInFlight('fac_ops', 0.77)
    // The pending frame.
    expect(String(factorDisplayText({ ...AFTER_LOCAL_WRITE, pending_user_value: pendingFactorEditValue('fac_ops') }))).toContain('0.77')

    // `confirmOptimisticFactorEdit` writes the stamp against the receipt, then
    // the send's finally settles pending.
    const stamped = {
      label: AFTER_LOCAL_WRITE.label,
      observedState: { ...AFTER_LOCAL_WRITE.observedState, source: 'user_confirmed' },
    }
    expect(settleFactorEditInFlight('fac_ops', 0.77)).toBe(true)
    expect(pendingFactorEditValue('fac_ops')).toBeNull()

    const after = factorDisplayText({ ...stamped, pending_user_value: pendingFactorEditValue('fac_ops') })
    expect(after, 'the accepted value vanished once pending cleared — the stamp should carry it now').not.toBeNull()
    expect(String(after)).toContain('0.77')
  })

  it('REFUSED: pending clears and the PRIOR display is restored, not a blank', () => {
    markFactorEditInFlight('fac_ops', 0.77)
    // `revertOptimisticFactorEdit` puts back the captured previous state.
    const reverted = AI_INFERRED_SCALE
    expect(settleFactorEditInFlight('fac_ops', 0.77)).toBe(true)

    const after = factorDisplayText({ ...reverted, pending_user_value: pendingFactorEditValue('fac_ops') })
    // The prior display for this shape was suppressed, and that is the CORRECT
    // restoration: the card is back to declining to assert Olumi's own
    // unanchored estimate. The refusal must not leave 0.77 on screen.
    expect(after, 'a refused edit left the rejected number visible').toBeNull()
  })

  it('⛔ a MISSED settle would be worse than the blank — pending cannot outlive its value', () => {
    // The failure mode the every-exit `finally` exists to prevent: if pending
    // were never cleared, the card would claim a value is in flight forever.
    // This pins that the register has no path to a permanent entry other than
    // a caller failing to settle, and that settling is idempotent.
    markFactorEditInFlight('fac_ops', 0.77)
    expect(settleFactorEditInFlight('fac_ops', 0.77)).toBe(true)
    expect(settleFactorEditInFlight('fac_ops', 0.77), 'a second settle claimed to do something').toBe(false)
    expect(pendingFactorEditValue('fac_ops')).toBeNull()
  })
})
