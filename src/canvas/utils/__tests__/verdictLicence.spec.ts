/**
 * `verdictLicenceSuperseded` — the licence identity is the PAIR
 * (ROADMAP 2.635, invariant I-4).
 *
 * ── Why this file exists: a surviving mutant, settled by demonstration ────
 * The 2.635 battery ran 14 mutants; 13 bit. The survivor (M12) deleted the
 * `stale` half of the comparison:
 *
 *     licensed.verdictAtMs !== current.verdictAtMs || licensed.stale !== current.stale
 *  →  licensed.verdictAtMs !== current.verdictAtMs
 *
 * CLAUDE.md trap 13c is explicit that a survivor is a claim either way, and
 * that an equivalent mutant must be DEMONSTRATED rather than asserted. Here is
 * the demonstration, derived from the store rather than argued:
 *
 *   · `readinessStore` has exactly ONE writer of `stale: true` (the canvas
 *     subscription, `readinessStore.ts:980`), and it sets `stale` AND NOTHING
 *     ELSE — `readiness` and `verdictAtMs` are untouched.
 *   · Every path that sets `readiness` from an answer stamps `verdictAtMs` in
 *     the same `setState`.
 *
 * So the store cannot produce "the verdict changed to one that objects while
 * `verdictAtMs` stayed put". At the CURRENT wiring M12 is therefore equivalent
 * end-to-end, and writing a component-level fixture for that state would be
 * exactly the error CLAUDE.md trap 16's inverse names: a fixture I wrote myself
 * is not evidence about what the producer can emit.
 *
 * ── So why pin it at all? ────────────────────────────────────────────────
 * Because equivalence-today is a property of the STORE, not of this function,
 * and the function's own contract says the licence is the pair. The day a
 * second `stale` writer appears — or a verdict lands within the same
 * millisecond as the one it replaces — the dropped clause becomes a live
 * fail-open with nothing to catch it. This pins the declared contract at the
 * unit it belongs to, which is the honest place for it: it does not pretend to
 * be evidence about a reachable product state.
 */
import { describe, it, expect } from 'vitest'
import { verdictLicenceSuperseded, type ReadinessVerdictLicence } from '../canRunAnalysis'

const AT = 1_000_000

function licence(verdictAtMs: number | null, stale: boolean): ReadinessVerdictLicence {
  return { verdictAtMs, stale }
}

describe('verdictLicenceSuperseded — identity is (verdictAtMs, stale)', () => {
  it('is not superseded when both components are unchanged', () => {
    expect(verdictLicenceSuperseded(licence(AT, false), licence(AT, false))).toBe(false)
    expect(verdictLicenceSuperseded(licence(AT, true), licence(AT, true))).toBe(false)
  })

  it('is superseded when the timestamp moves', () => {
    expect(verdictLicenceSuperseded(licence(AT, false), licence(AT + 1, false))).toBe(true)
  })

  // The clause M12 deleted. Without it this case reads "not superseded".
  it('is superseded when only the staleness mark moves', () => {
    expect(verdictLicenceSuperseded(licence(AT, false), licence(AT, true))).toBe(true)
    expect(verdictLicenceSuperseded(licence(AT, true), licence(AT, false))).toBe(true)
  })

  it('is superseded when both move', () => {
    expect(verdictLicenceSuperseded(licence(AT, false), licence(AT + 1, true))).toBe(true)
  })

  // `verdictAtMs: null` is "no answer has ever been received", which is a
  // licence state in its own right — a run permitted because readiness is
  // unknown. Moving out of it must count as a supersession.
  it('treats the never-answered state as a licence like any other', () => {
    expect(verdictLicenceSuperseded(licence(null, false), licence(null, false))).toBe(false)
    expect(verdictLicenceSuperseded(licence(null, false), licence(AT, false))).toBe(true)
    expect(verdictLicenceSuperseded(licence(AT, false), licence(null, false))).toBe(true)
    expect(verdictLicenceSuperseded(licence(null, false), licence(null, true))).toBe(true)
  })
})
