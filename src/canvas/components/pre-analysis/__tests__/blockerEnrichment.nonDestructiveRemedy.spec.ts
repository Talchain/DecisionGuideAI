/**
 * ROADMAP 2.924 — a blocker that names a NON-DESTRUCTIVE remedy must not also
 * render the destructive one.
 *
 * Why this file exists at all: `BlockersSection` gates its "Retry Draft" button
 * on `display.supportsRetry`, which `enrichBlocker` keys off the blocker CODE —
 * NOT off the blocker's own `action`. So changing the producer's action from
 * `retry_draft` to `configure_option` (see
 * `usePreRunValidation.unencodedOptionCopy.spec.ts`) would have left the
 * destructive button rendering unchanged. Both halves are needed; this pins the
 * second half.
 *
 * The suppression is deliberately narrow — ANALYSIS_NOT_READY *and* a
 * `configure_option` action — so the paths where re-drafting genuinely is the
 * remedy keep their button. The tests below are a DISCRIMINATING PAIR: the
 * suppression must fire for the targeted shape and must NOT fire for its
 * neighbours (verification trap 19).
 */

import { describe, it, expect } from 'vitest'
import type { ValidationBlocker } from '@talchain/schemas'
import { enrichBlocker } from '../blockerEnrichment'

const CONFIGURE_LABEL = 'Configure "Grow via partnerships"'

/** The 2.924 shape: soft status, un-encoded option, non-destructive remedy. */
const configureBlocker: ValidationBlocker = {
  code: 'ANALYSIS_NOT_READY',
  message: '"Grow via partnerships" needs its values set as numbers before analysis can run.',
  action: { type: 'configure_option', label: CONFIGURE_LABEL, optionId: 'opt_partnerships' },
}

/** Its twin: the unrecognised-status / needs_user_input shape, still retryable. */
const retryBlocker: ValidationBlocker = {
  code: 'ANALYSIS_NOT_READY',
  message: 'Analysis not ready',
  action: { type: 'retry_draft', label: 'Retry Draft' },
}

describe('ROADMAP 2.924 — enrichBlocker suppresses the destructive remedy', () => {
  it('turns supportsRetry OFF when the blocker names configure_option', () => {
    const enriched = enrichBlocker(configureBlocker)

    // supportsRetry === false is what stops BlockersSection rendering the
    // "Retry Draft" button that would discard the user's chat-added option.
    expect(enriched.display.supportsRetry).toBe(false)
  })

  it('replaces the re-draft prescriptions with the non-destructive action', () => {
    const enriched = enrichBlocker(configureBlocker)

    expect(enriched.display.suggestedActions).toEqual([CONFIGURE_LABEL])
    // The static BLOCKER_DISPLAY bullets for this code are ['Retry draft',
    // 'Edit brief'] — both prescribe replacing the model.
    expect(enriched.display.suggestedActions).not.toContain('Retry draft')
    expect(enriched.display.suggestedActions).not.toContain('Edit brief')
  })

  it('still passes the producer message through as the description', () => {
    const enriched = enrichBlocker(configureBlocker)

    expect(enriched.display.description).toBe(configureBlocker.message)
    expect(enriched.display.description.toLowerCase()).not.toContain('categorical')
  })

  // ---- the discriminating half: the suppression must NOT leak ----

  it('leaves supportsRetry ON for an ANALYSIS_NOT_READY blocker that asks for a re-draft', () => {
    const enriched = enrichBlocker(retryBlocker)

    expect(enriched.display.supportsRetry).toBe(true)
    expect(enriched.display.suggestedActions).toEqual(['Retry draft', 'Edit brief'])
  })

  it('leaves other codes untouched even when they carry configure_option', () => {
    // OPTIONS_NEED_MAPPING and EMPTY_INTERVENTIONS already emit configure_option.
    // 2.924 must not silently change their retry affordance.
    const needsMapping: ValidationBlocker = {
      code: 'OPTIONS_NEED_MAPPING',
      message: '1 option(s) need intervention values',
      affectedIds: ['opt_partnerships'],
      action: { type: 'configure_option', label: 'Configure options', optionId: 'opt_partnerships' },
    }
    const emptyInterventions: ValidationBlocker = {
      code: 'EMPTY_INTERVENTIONS',
      message: '1 option(s) have no interventions',
      affectedIds: ['opt_partnerships'],
      action: { type: 'configure_option', label: 'Add interventions', optionId: 'opt_partnerships' },
    }

    expect(enrichBlocker(needsMapping).display.supportsRetry).toBe(true)
    expect(enrichBlocker(emptyInterventions).display.supportsRetry).toBe(true)
  })
})
