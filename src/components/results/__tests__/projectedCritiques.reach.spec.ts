/**
 * LANE 3 (P1/P4) — the CEE-projected critique row's Paul-approved copy
 * survives the UI display chain verbatim.
 *
 * RED-FIRST RECORD (run captured at pristine UI `6d5db185`):
 * - "GREEN control" passed at pristine (adoption guarantee — binds the exact
 *   CEE copy string through the existing userMessage fallback).
 * - "SAMPLES_REDUCED_FOR_COMPLEXITY must render the Paul-approved CEE copy"
 *   FAILED at pristine (the UI's CODE_TEMPLATES entry rendered its own
 *   'Analysis ran at reduced precision' instead — a surface restating an
 *   approved disclosure in its own words, pass-condition 2 class).
 * - The internal-token positive control passed at pristine.
 *
 * MECHANISM (chosen against the measured blast radius, not the first idea):
 * blanket userMessage-first broke 4 deliberate pins (V14.3 template-first
 * keeps label-resolved titles + CTA suggestions for UI-owned codes, and the
 * banner-count pins in golden-payload.spec.ts). The landed rule is NARROW:
 * `CEE_OWNED_CRITIQUE_CODES` (the 13 S+U bucket codes whose display copy CEE
 * owns — provenance in humaniseCritique.ts) take clean `userMessage` over any
 * template; every other code keeps the V14.3 contract; owned-code rows
 * WITHOUT user_message still get the template safety net.
 *
 * Named signatures:
 *   humaniseCritique(item: UncertaintyItem, nodeLabels?: Map<string,string>):
 *     HumanisedCritique                     — humaniseCritique.ts
 *   CEE_OWNED_CRITIQUE_CODES: ReadonlySet<string> — humaniseCritique.ts
 */

import { describe, it, expect } from 'vitest'
import { humaniseCritique, CEE_OWNED_CRITIQUE_CODES } from '../utils/humaniseCritique'
import type { UncertaintyItem } from '../types'

/** Verbatim CEE S-bucket copy (S_BUCKET_REPLACEMENTS @ CEE d2cdd99b). */
const EMPTY_INTERVENTIONS_COPY =
  "Option 'Bravo' does not change anything yet. Specify what makes this option different."
const SAMPLES_REDUCED_COPY =
  'Because this model is complex, the analysis ran fewer simulations than usual, so results may be less precise.'

/**
 * HAND-WRITTEN CORPUS (trap 12d: a derived guard proves agreement, only a
 * corpus can catch a short list). The 13 codes CEE ships display copy for,
 * transcribed from `sanitise-enrichment.ts` CRITIQUE_BUCKETS (S+U rows) in a
 * fresh blobless CEE clone at `d2cdd99b`, 2026-08-04. If CEE promotes a new
 * code to S/U, add it HERE and to CEE_OWNED_CRITIQUE_CODES — this corpus is
 * what notices the production set went short.
 */
const CEE_OWNED_CODES_CORPUS = [
  'EMPTY_INTERVENTIONS',
  'INVALID_INTERVENTION_TARGET',
  'NO_EFFECTIVE_PATH_TO_GOAL',
  'IDENTICAL_OPTIONS',
  'GRAPH_DISCONNECTED',
  'OPTION_NO_INTERVENTIONS',
  'LOW_EFFECTIVE_SAMPLES',
  'DEGENERATE_OPTION_ZERO_VARIANCE',
  'HIGH_TIE_RATE',
  'SAMPLES_REDUCED_FOR_COMPLEXITY',
  'NO_OPTIONS',
  'INSUFFICIENT_OPTIONS',
  'DEGENERATE_OUTCOMES',
] as const

describe('projected critique copy survives the display chain', () => {
  it('GREEN control — a code with no UI template renders CEE user_message verbatim as title AND displayText', () => {
    const item: UncertaintyItem = {
      code: 'EMPTY_INTERVENTIONS', // not in CODE_TEMPLATES
      message: EMPTY_INTERVENTIONS_COPY, // mapper populates message from user_message
      userMessage: EMPTY_INTERVENTIONS_COPY,
      severity: 'warning',
    }
    const out = humaniseCritique(item, new Map([['opt_b', 'Bravo']]))
    expect(out.title).toBe(EMPTY_INTERVENTIONS_COPY)
    expect(out.displayText).toBe(EMPTY_INTERVENTIONS_COPY)
  })

  it('RED at pristine — SAMPLES_REDUCED_FOR_COMPLEXITY must render the Paul-approved CEE copy, not the UI template', () => {
    const item: UncertaintyItem = {
      code: 'SAMPLES_REDUCED_FOR_COMPLEXITY', // in CODE_TEMPLATES; CEE-owned wins
      message: SAMPLES_REDUCED_COPY,
      userMessage: SAMPLES_REDUCED_COPY,
      severity: 'warning',
    }
    const out = humaniseCritique(item)
    // Identity-bound to the approved sentence; a template rewrite of this
    // disclosure is exactly the "surface states its own version of an
    // approved claim" class pass-condition 2 exists to catch.
    expect(out.displayText).toBe(SAMPLES_REDUCED_COPY)
  })

  it('safety net preserved — an owned code arriving WITHOUT user_message still gets the UI template, never silence', () => {
    const item: UncertaintyItem = {
      code: 'SAMPLES_REDUCED_FOR_COMPLEXITY',
      message: 'engine-internal wording',
      severity: 'warning',
    }
    const out = humaniseCritique(item)
    // The V14.3 template ("Analysis ran at reduced precision") remains the
    // fallback disclosure — removing it would have made a userMessage-less
    // reduced-samples run banner-invisible, a claim-integrity regression.
    expect(out.title).toBe('Analysis ran at reduced precision')
  })

  it('CORPUS GUARD — no UI template may hijack ANY CEE-owned code: approved copy renders for all 13', () => {
    // Also pins set-corpus parity in both directions, so neither list can
    // silently go short against the other.
    expect([...CEE_OWNED_CRITIQUE_CODES].sort()).toEqual([...CEE_OWNED_CODES_CORPUS].sort())
    for (const code of CEE_OWNED_CODES_CORPUS) {
      const sentinel = `Approved copy sentinel for ${code}.`
      const out = humaniseCritique({ code, message: 'x', userMessage: sentinel })
      expect(out.title, code).toBe(sentinel)
      expect(out.displayText, code).toBe(sentinel)
    }
  })

  it('POSITIVE CONTROL for the internal-token gate — contaminated userMessage is never used as display text', () => {
    const item: UncertaintyItem = {
      code: 'EMPTY_INTERVENTIONS',
      message: 'x',
      userMessage: 'observed_state.value missing on fac_customer_churn',
      severity: 'warning',
    }
    const out = humaniseCritique(item)
    // Either excluded from display entirely (null) or clean — never the
    // contaminated string. `?? ''` because .not.toContain rejects null.
    expect(out.displayText ?? '').not.toContain('observed_state')
    expect(out.title).not.toContain('observed_state')
  })
})
