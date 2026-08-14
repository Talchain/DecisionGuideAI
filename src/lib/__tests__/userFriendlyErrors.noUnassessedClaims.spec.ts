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
import {
  ALL_ERROR_CODES,
  ALL_STATUS_CODES,
  USER_RERUN_BLOCKED_CODES,
  getUserFriendlyError,
} from '../userFriendlyErrors'

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

  // The first fix replaced a false claim of receipt with a false claim of
  // ABSENCE. `useV2Run` stores this run's report at `:991` and then runs ~120
  // unguarded lines before returning, so a throw in that window settles
  // PROCESSING_ERROR with results already on screen. The copy must assert
  // nothing about output in EITHER direction.
  it('does not claim the run produced no results either', () => {
    const processing = getUserFriendlyError({ code: 'PROCESSING_ERROR' })
    const whole = `${processing.headline} ${processing.explanation}`
    expect(whole).not.toMatch(/produced no results/i)
    expect(whole).not.toMatch(/no results were/i)
    expect(whole).not.toMatch(/nothing was returned/i)
  })
})

describe('getUserFriendlyError — copy and affordance must agree (2.1127)', () => {
  // ⚠ TWO QUESTIONS, ONE NAME (CLAUDE.md trap 21). `ApiError.retryable` answers
  // "would an AUTOMATIC retry help?" and defaults false; `ProcessingError` and
  // `MalformedApiResponseError` hardcode it false. The banner's `canRetry`
  // answers "may the USER re-run?". Feeding the first into the second removed
  // "Try Again" from exactly the classes whose copy says to try again.
  //
  // The corpus is DERIVED from the map (trap 12), so a code added later cannot
  // slip past this invariant.
  const INSTRUCTS_RETRY = /try again|wait and retry|retry/i

  it('control — the corpus is non-empty and includes the classes at issue', () => {
    expect(ALL_ERROR_CODES.length).toBeGreaterThan(5)
    expect(ALL_ERROR_CODES).toContain('PROCESSING_ERROR')
    expect(ALL_STATUS_CODES.length).toBeGreaterThan(3)
  })

  it.each([...ALL_ERROR_CODES])(
    '%s — if the copy instructs a retry, the retry is offered',
    (code) => {
      const e = getUserFriendlyError({ code })
      const instructs = INSTRUCTS_RETRY.test(`${e.explanation} ${e.actionText}`)
      if (instructs) expect(e.canRetry).toBe(true)
    },
  )

  it.each([...ALL_STATUS_CODES])(
    'status %s — if the copy instructs a retry, the retry is offered',
    (status) => {
      const e = getUserFriendlyError({ status })
      const instructs = INSTRUCTS_RETRY.test(`${e.explanation} ${e.actionText}`)
      if (instructs) expect(e.canRetry).toBe(true)
    },
  )

  it('the unknown-code fallback instructs a retry AND offers it', () => {
    const fallback = getUserFriendlyError({ code: 'MALFORMED_RESPONSE' })
    // MALFORMED_RESPONSE has no entry of its own, so it lands on DEFAULT_ERROR
    // — whose copy says "Please try again". That is the exact cell where the
    // producer's `retryable: false` used to delete the button.
    expect(fallback.explanation).toMatch(/try again/i)
    expect(fallback.canRetry).toBe(true)
  })

  it('PROCESSING_ERROR permits a user re-run despite ProcessingError.retryable === false', () => {
    expect(getUserFriendlyError({ code: 'PROCESSING_ERROR' }).canRetry).toBe(true)
  })

  // ⚠ A HAND-WRITTEN CORPUS, DELIBERATELY NOT DERIVED FROM THE LIST (CLAUDE.md
  // trap 12d). A derived guard proves the consumers AGREE with the list; it can
  // never prove the LIST IS RIGHT. Measured: emptying
  // `USER_RERUN_BLOCKED_CODES` made the derived `it.each` below simply VANISH —
  // the run went 60 tests to 55 and stayed green, because a table parameterised
  // over the mutated list deletes its own cases instead of failing them. Only
  // these literals notice. The collected-count drop was the only tell.
  const MUST_BLOCK_RERUN = [
    'UNAUTHORIZED', // re-running cannot fix an expired session
    'FORBIDDEN', // nor a permission the user does not have
    'INVALID_INPUT', // the model must change first
    'EMPTY_GRAPH', // there is nothing to analyse yet
    'VALIDATION_BLOCKED', // options need intervention values first
  ] as const

  it('the blocked set still contains every code a re-run cannot fix', () => {
    for (const code of MUST_BLOCK_RERUN) {
      expect(USER_RERUN_BLOCKED_CODES).toContain(code)
    }
  })

  it.each([...MUST_BLOCK_RERUN])(
    '%s withholds the re-run AND does not instruct one (hand-written corpus)',
    (code) => {
      const e = getUserFriendlyError({ code })
      expect(e.canRetry).toBe(false)
      expect(`${e.explanation} ${e.actionText}`).not.toMatch(INSTRUCTS_RETRY)
    },
  )

  // Kept alongside the corpus, not instead of it: this one notices a code ADDED
  // to the list whose copy still tells the user to retry.
  it.each([...USER_RERUN_BLOCKED_CODES])(
    '%s (derived from the list) withholds the re-run AND does not instruct one',
    (code) => {
      const e = getUserFriendlyError({ code })
      expect(e.canRetry).toBe(false)
      expect(`${e.explanation} ${e.actionText}`).not.toMatch(INSTRUCTS_RETRY)
    },
  )

  it('an explicit caller-supplied canRetry still wins', () => {
    expect(getUserFriendlyError({ code: 'NETWORK_ERROR', canRetry: false }).canRetry).toBe(false)
  })
})
