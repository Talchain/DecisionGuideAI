/**
 * DRIFT SIMULATION — the mutation-check for RETRY_INSTRUCTION_SENTENCE.
 *
 * `resolveFailureBaseCopy` strips a trailing "please retry" sentence from
 * FAILURE_USER_TEXT when the retry affordance is withheld, so the copy never
 * instructs an action the UI gives the user no way to take.
 *
 * That strip used to be three exact-suffix literals (' Please retry.',
 * ' Please try again.', ' Please retry shortly.') — a hand-kept mirror of
 * sentence endings inside the vendored @talchain/schemas copy. Today's
 * vendored table happens to match those literals exactly, which is precisely
 * why the mirror was invisible: a derived test over the REAL table passes
 * either way. Only a table that has DRIFTED can tell the two implementations
 * apart.
 *
 * This file supplies that table. Reverting the regex to the three literals
 * turns these tests RED.
 *
 * Lives in its own file because `vi.mock` is hoisted file-wide — mocking the
 * table inside failureTypeRetryability.test.ts would corrupt that file's
 * verbatim-copy expectations.
 *
 * The mock spreads `importOriginal` rather than replacing the module: a bare
 * factory REPLACES it, silently dropping every other export (the failure mode
 * that once killed 51 tests at collection).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@talchain/schemas/boundary', async importOriginal => {
  const actual = await importOriginal<typeof import('@talchain/schemas/boundary')>()
  return {
    ...actual,
    FAILURE_USER_TEXT: {
      ...actual.FAILURE_USER_TEXT,
      // Phrasings that none of the three old literals ended with. Each is a
      // plausible re-vendor of the same intent.
      INTERNAL_ERROR: 'Something went wrong on our side. Please try again in a moment.',
      UPSTREAM_TIMEOUT: 'An upstream service did not respond in time. Please retry in a few seconds.',
      LLM_UNAVAILABLE: 'The model is temporarily unavailable. Please try again later.',
    },
  }
})

const { FAILURE_USER_TEXT } = await import('@talchain/schemas/boundary')
const { resolveFailureBaseCopy } = await import('../failureTypeRetryability')
type FailureTypeLiteral = keyof typeof FAILURE_USER_TEXT

describe('resolveFailureBaseCopy — survives a re-vendor that rephrases the retry instruction', () => {
  it('the drifted table really is drifted (positive control)', () => {
    // If the mock silently failed to apply, every assertion below would be
    // testing the ORIGINAL copy — which the old literals match — and would
    // pass while proving nothing.
    expect(FAILURE_USER_TEXT.INTERNAL_ERROR).toBe(
      'Something went wrong on our side. Please try again in a moment.',
    )
    const OLD_LITERALS = [' Please retry.', ' Please try again.', ' Please retry shortly.']
    for (const code of ['INTERNAL_ERROR', 'UPSTREAM_TIMEOUT', 'LLM_UNAVAILABLE'] as const) {
      expect(OLD_LITERALS.some(s => FAILURE_USER_TEXT[code].endsWith(s))).toBe(false)
    }
  })

  it('strips drifted retry sentences the old exact-suffix list would have missed', () => {
    expect(resolveFailureBaseCopy('INTERNAL_ERROR', false)).toBe(
      'Something went wrong on our side.',
    )
    expect(resolveFailureBaseCopy('UPSTREAM_TIMEOUT', false)).toBe(
      'An upstream service did not respond in time.',
    )
    expect(resolveFailureBaseCopy('LLM_UNAVAILABLE', false)).toBe(
      'The model is temporarily unavailable.',
    )
  })

  it('leaves no retry language anywhere in the drifted table', () => {
    const codes = Object.keys(FAILURE_USER_TEXT) as FailureTypeLiteral[]
    const survivors = codes.filter(code =>
      /retry|try\s+again/i.test(resolveFailureBaseCopy(code, false)),
    )
    expect(survivors).toEqual([])
  })

  it('still returns the drifted copy verbatim when retry IS offered', () => {
    const codes = Object.keys(FAILURE_USER_TEXT) as FailureTypeLiteral[]
    for (const code of codes) {
      expect(resolveFailureBaseCopy(code, true)).toBe(FAILURE_USER_TEXT[code])
    }
  })
})
