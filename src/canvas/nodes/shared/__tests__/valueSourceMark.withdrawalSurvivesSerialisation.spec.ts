/**
 * Independent review (PR #2046, Blocking 2) — the "withdrawn extraction
 * marker" signal `extractionMarkerWithdrawn` reads must survive a JSON round
 * trip, or a user's own pending/unconfirmed edit is misread as Olumi's
 * estimate after any autosave/restore with no server readback.
 *
 * THE DEFECT. The writers (`useInspectorMutations.ts`'s `setObservedValue`,
 * `applyV5State.ts`'s `set_factor_value` path) withdrew the producer's stale
 * `extractionType` claim by writing `extractionType: undefined` — a key that
 * is PRESENT but holds no value, deliberately distinct from a key that was
 * never written at all. `JSON.stringify` DROPS a key whose value is
 * `undefined`, so after `saveAutosave` (`scenarios.ts`, a whole-object
 * `JSON.stringify`) and a restore with no server readback, the withdrawn key
 * is gone — indistinguishable from a producer draft that never wrote one.
 * Rule 4a (A4c) then classifies it `olumi` ("Estimated by Olumi") instead of
 * rule 4's `unknown` ("no source") — a false claim over a value the user
 * typed and has not yet confirmed.
 *
 * THE FIX. The writers now clear with `extractionType: null`, which
 * `JSON.stringify` keeps as a present key. `extractionMarkerWithdrawn`
 * accepts both `undefined` (in-session, before any round trip) and `null`
 * (after one).
 */
import { describe, it, expect } from 'vitest'
import { factorValueSourceMark } from '../valueSourceMark'

/** The pre-fix shape a withdrawal writer used to produce, in session. */
function withdrawnInSessionLegacy() {
  return {
    observedState: {
      value: 0.7,
      source: 'cee_inference',
      extractionType: undefined,
    },
  }
}

/** The shape the FIXED writers now produce, in session. */
function withdrawnInSession() {
  return {
    observedState: {
      value: 0.7,
      source: 'cee_inference',
      extractionType: null,
    },
  }
}

/** The same node after an autosave + restore round trip with no server readback. */
function withdrawnAfterRoundTrip() {
  return JSON.parse(JSON.stringify(withdrawnInSession()))
}

describe('a withdrawn extraction marker survives a JSON round trip', () => {
  it('in session (either representation): reads "no source", never "Olumi estimate"', () => {
    expect(factorValueSourceMark(withdrawnInSessionLegacy())?.kind).toBe('unknown')
    expect(factorValueSourceMark(withdrawnInSession())?.kind).toBe('unknown')
  })

  it('the LEGACY (undefined) shape does not survive a JSON round trip at all — proving the defect is in serialisation, not the reader', () => {
    const roundTripped = JSON.parse(JSON.stringify(withdrawnInSessionLegacy()))
    expect('extractionType' in roundTripped.observedState).toBe(false)
  })

  it('after a JSON round trip: still reads "no source", NOT "Olumi estimate"', () => {
    // Precondition, pinned: the round trip preserved the withdrawal key as a
    // present `null` — the fix — so a pass below is the reader correctly
    // reading a `null` it actually received, not an artefact of a round trip
    // that silently dropped the key (as the legacy shape does, pinned above).
    const roundTripped = withdrawnAfterRoundTrip()
    expect('extractionType' in roundTripped.observedState).toBe(true)
    expect(roundTripped.observedState.extractionType).toBeNull()

    const mark = factorValueSourceMark(roundTripped)
    // RED before the fix: `extractionMarkerWithdrawn` checked `=== undefined`
    // only, so a `null` (present, no value, but not literally `undefined`)
    // fell through rule 4a and read `'olumi'`.
    expect(mark?.kind).toBe('unknown')
    expect(mark?.kind).not.toBe('olumi')
  })

  it('CONTRAST: a producer draft that never wrote a marker at all (key absent, not withdrawn) still reads Olumi\'s estimate', () => {
    const neverWritten = { observedState: { value: 1, source: 'cee_inference' } }
    expect('extractionType' in neverWritten.observedState).toBe(false)
    expect(factorValueSourceMark(neverWritten)?.kind).toBe('olumi')
  })
})
