/**
 * userFriendlyErrors — an error panel may not claim RECEIPT it cannot support,
 * nor assert a VALIDITY nothing assessed (ROADMAP 2.1127).
 *
 * The witnessed staging banner composed both falsehoods out of this module:
 *
 *   "We received the analysis results but had trouble displaying them.
 *    Please try again. Your core results are still valid."
 *
 * — the first sentence from the `PROCESSING_ERROR` entry, the second appended
 * by the `hasPartialResults` limb of `getUserFriendlyError`.
 *
 * ⚠ Why this file exists ALONGSIDE `OutputsDock.failedRunHonesty.spec.tsx`.
 * The fix has two independent halves: the dock stopped passing a retained
 * PREVIOUS report as this run's partial results, and this module stopped
 * asserting validity when told there are partial results. Either half alone
 * removes the witnessed sentence, so a mutant reverting only one survives a
 * suite that tests only the composed surface. This spec pins the module's half
 * directly, so both halves are load-bearing and both mutants bite.
 */

import { describe, expect, it } from 'vitest'
import { getUserFriendlyError } from '../userFriendlyErrors'

describe('getUserFriendlyError — partial results are not a validity verdict (2.1127)', () => {
  // Control (CLAUDE.md trap 13b): pin the PRECONDITION in-test. These
  // assertions only mean something if the `hasPartialResults` limb is the one
  // being taken — `secondaryActionText` is that limb's own signature, and it is
  // NOT part of the NETWORK_ERROR base entry.
  it('control — hasPartialResults takes the partial limb and keeps its affordances', () => {
    const base = getUserFriendlyError({ code: 'NETWORK_ERROR' })
    expect(base.secondaryActionText).toBeUndefined()

    const partial = getUserFriendlyError({ code: 'NETWORK_ERROR', hasPartialResults: true })
    expect(partial.secondaryActionText).toBe('Continue Without')
    expect(partial.canRetry).toBe(true)
    // The base explanation is still the one being spoken — so the absence
    // assertion below is about a real, non-empty sentence.
    expect(partial.explanation).toBe(base.explanation)
    expect(partial.explanation.length).toBeGreaterThan(0)
  })

  it('does not append a validity claim when told there are partial results', () => {
    const partial = getUserFriendlyError({ code: 'NETWORK_ERROR', hasPartialResults: true })
    expect(partial.explanation).not.toMatch(/still valid/i)
  })

  // The limb is code-agnostic: it wrapped EVERY base entry. Pinning one code
  // would let a code-specific carve-out pass.
  it.each(['NETWORK_ERROR', 'TIMEOUT', 'PROCESSING_ERROR', 'ANALYSIS_FAILED', 'UNEXPECTED_CODE'])(
    'does not append a validity claim for %s',
    (code) => {
      const partial = getUserFriendlyError({ code, hasPartialResults: true })
      expect(partial.explanation.length).toBeGreaterThan(0)
      expect(partial.explanation).not.toMatch(/still valid/i)
    },
  )
})

describe('getUserFriendlyError — PROCESSING_ERROR claims no receipt (2.1127)', () => {
  // Control: prove the code resolves to its OWN entry rather than falling
  // through to DEFAULT_ERROR, so the absence assertions below are about the
  // entry under test and not about a generic fallback (trap 19 — bind by
  // identity, not by "some error object").
  it('control — PROCESSING_ERROR resolves to its own entry, not the default', () => {
    const processing = getUserFriendlyError({ code: 'PROCESSING_ERROR' })
    const fallback = getUserFriendlyError({ code: 'NO_SUCH_CODE_EXISTS' })
    expect(processing.headline).not.toBe(fallback.headline)
    expect(processing.explanation).not.toBe(fallback.explanation)
    expect(processing.explanation.length).toBeGreaterThan(0)
  })

  it('does not claim the analysis results were received', () => {
    const processing = getUserFriendlyError({ code: 'PROCESSING_ERROR' })
    // `PROCESSING_ERROR` is `ProcessingError.wrap(err)`'s residual bucket in
    // `useV2Run` — the catch-all for an unclassified throw, which fires before
    // any response arrives just as readily as after one.
    expect(processing.explanation).not.toMatch(/we received/i)
    expect(processing.explanation).not.toMatch(/received the analysis results/i)
    expect(processing.headline).not.toMatch(/received/i)
  })
})
