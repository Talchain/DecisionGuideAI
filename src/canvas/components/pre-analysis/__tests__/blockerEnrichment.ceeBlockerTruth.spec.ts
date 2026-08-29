/**
 * CEE blocker card truth — the rendered card must not assert a false cause.
 *
 * The card a user actually reads is `display.title` + `display.description`.
 * For a `missing_value` blocker the static CEE_BLOCKER copy said the factor
 * "is not connected" and "no option directly affects it" — both FALSE: the
 * option→factor edge exists, only the effect magnitude is absent. The card
 * also offered the destructive "Retry Draft" button (gated on
 * `display.supportsRetry`), which discards options the user added in chat and
 * cannot supply the missing number.
 *
 * TWO WRITERS produce this sentence — `enrichBlocker` and, running afterwards,
 * `hydrateBlockerLabels`. A fix to only one ships dark, so both are pinned here.
 *
 * Message wording is wire-derived (deployed CEE `f18d941`, 2026-08-29) — see
 * `usePreRunValidation.ceeBlockerTruth.spec.ts` for the capture provenance.
 */
import { describe, it, expect } from 'vitest'
import { enrichBlocker, hydrateBlockerLabels } from '../blockerEnrichment'
import type { ValidationBlocker } from '@talchain/schemas'

const CEE_QUESTION =
  'Factor "Agency delivery speed" is currently Moderate (0.5). What should option "Outsource to an Agency" set it to?'

/** What usePreRunValidation emits for a wire `missing_value` blocker. */
const VALUE_BLOCKER: ValidationBlocker = {
  code: 'CEE_BLOCKER',
  message: CEE_QUESTION,
  affectedIds: ['a2af4a80'],
  action: { type: 'configure_option', label: 'Agency delivery speed', optionId: '5fdf255f' },
}

/** The discriminating twin: a genuine connection blocker. */
const CONNECTION_BLOCKER: ValidationBlocker = {
  code: 'CEE_BLOCKER',
  message: 'Factor "Regulatory pressure" has no option affecting it.',
  affectedIds: ['c0ffee01'],
  action: { type: 'retry_draft', label: 'Regulatory pressure' },
}

const NODES = new Map([
  ['a2af4a80', { label: 'Agency delivery speed' }],
  ['c0ffee01', { label: 'Regulatory pressure' }],
])

describe('CEE blocker card truth', () => {
  it("shows CEE's own question as the card description", () => {
    const { display } = enrichBlocker(VALUE_BLOCKER)
    expect(display.description).toBe(CEE_QUESTION)
  })

  it('does not claim the factor is unconnected when only its value is missing', () => {
    const { display } = enrichBlocker(VALUE_BLOCKER)
    expect(display.title).not.toContain('is not connected')
    expect(display.description).not.toContain('no option directly affects it')
  })

  it('does not offer the destructive Retry Draft button for a missing value', () => {
    const { display } = enrichBlocker(VALUE_BLOCKER)
    // BlockersSection gates the Retry Draft button on THIS flag, keyed by code —
    // changing the blocker's action alone would leave the button rendering.
    expect(display.supportsRetry).toBe(false)
  })

  it('survives label hydration — the second writer must not restore the false title', () => {
    const enriched = enrichBlocker(VALUE_BLOCKER)
    const [hydrated] = hydrateBlockerLabels([enriched], NODES)
    expect(hydrated.display.title).not.toContain('is not connected')
    expect(hydrated.display.description).toBe(CEE_QUESTION)
  })

  it('keeps the true "not connected" wording for a connection blocker (discriminating twin)', () => {
    const enriched = enrichBlocker(CONNECTION_BLOCKER)
    const [hydrated] = hydrateBlockerLabels([enriched], NODES)
    expect(hydrated.display.title).toContain('is not connected')
    expect(hydrated.display.supportsRetry).toBe(true)
  })
})
