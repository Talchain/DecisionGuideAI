/**
 * 2.491 — the grounding badge's NEGATIVE TWIN: the MAPPER layer.
 *
 * ## Scope of this file, and where the render proof lives
 *
 * This file covers `mapDecisionQualityPrompts` / `isGeneralGuidance` only —
 * the wire→view rule. **The render proof is deliberately NOT here**, because
 * this lane's first attempt put it against `HeroKeyQuestion`, which does not
 * mount on staging (`netlify.toml:78` sets `VITE_FEATURE_ANALYSIS_HERO_PANEL
 * = "1"`, and `ResultsBody` hosts `KeyQuestionCard` in that flag-ON arm while
 * the V17 hero lives in the `!flag` arm). Deleting the deployed marker left
 * those tests green — the same dark-ship row 2.466 was opened for.
 *
 * The render tests now live at
 * `analysis-hero/__tests__/KeyQuestionCard.generalGuidance.spec.tsx` (the
 * mounted host) and the mount-path guard at
 * `__tests__/ResultsBody.keyQuestionLiveMount.spec.tsx` (the real ResultsBody
 * under the real flag seam).
 *
 * ## RED-first signature at pristine (UI e01dbd4a)
 *
 * `TypeError: isGeneralGuidance is not a function`, and
 * `expected [undefined, …] to deeply equal ['general', 'attested', …]`.
 *
 * The product statement of that failure: a prompt with no `dsk_claim_id`
 * rendered its question and NOTHING else. Absence-of-badge is silent, and no
 * user reads silence as "this one is improvised" — so an unattested
 * science-flavoured question was indistinguishable from an attested one.
 * Measured live 2026-08-05: **52% of decision-quality prompts (16 of 31)**.
 */

import { describe, it, expect } from 'vitest'
import {
  mapDecisionQualityPrompts,
  isGeneralGuidance,
  deriveDskGrounding,
} from '../utils/decisionQualityPrompts'

// ============================================================================
// The mapper — wire verdict → view flag
// ============================================================================

describe('mapDecisionQualityPrompts carries the 2.491 verdict', () => {
  it('carries general, attested and resolved; ignores an unknown value', () => {
    const mapped = mapDecisionQualityPrompts([
      { question: 'q-general', principle: 'Consider-the-opposite', dsk_grounding: 'general' },
      {
        question: 'q-attested',
        principle: 'Outside view and reference class forecasting',
        dsk_claim_id: 'DSK-T-002',
        evidence_strength: 'strong',
        dsk_grounding: 'attested',
      },
      {
        question: 'q-resolved',
        principle: 'Pre-mortem and prospective hindsight',
        dsk_claim_id: 'DSK-T-001',
        evidence_strength: 'medium',
        dsk_grounding: 'resolved',
      },
      { question: 'q-bogus', principle: 'x', dsk_grounding: 'definitely-grounded-trust-me' },
      { question: 'q-absent', principle: 'x' },
    ])

    expect(mapped.map(m => m.groundingState)).toEqual([
      'general',
      'attested',
      'resolved',
      undefined, // outside the closed vocabulary ⇒ fails closed
      undefined, // no verdict on the wire ⇒ no verdict in the view
    ])

    // Identity-bound (trap 19): assert per named question, not "some entry".
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-general')!)).toBe(true)
    // POSITIVE CONTROL — the harness sees the other three states as NOT general.
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-attested')!)).toBe(false)
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-resolved')!)).toBe(false)
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-absent')!)).toBe(false)
  })

  it('a RESOLVED prompt gets the ordinary grounding badge — it is genuinely cited', () => {
    // The whole point of `resolved`: CEE recovered the id from the bundle, so
    // this is attested science and must NOT be disclaimed.
    const [m] = mapDecisionQualityPrompts([
      {
        question: 'q',
        principle: 'Pre-mortem and prospective hindsight',
        dsk_claim_id: 'DSK-T-001',
        dsk_protocol_id: 'DSK-P-001',
        evidence_strength: 'medium',
        dsk_grounding: 'resolved',
      },
    ])
    expect(deriveDskGrounding(m)?.claimId).toBe('DSK-T-001')
    expect(isGeneralGuidance(m)).toBe(false)
  })

  it('ABSENCE of the verdict is not general — a payload with no verdict is not disclaimed', () => {
    // Fail-closed the other way. A pre-2.491 CEE, DSK disabled, or a bundle
    // load failure must render NOTHING, not a disclaimer we cannot support.
    const [m] = mapDecisionQualityPrompts([{ question: 'q', principle: 'Consider-the-opposite' }])
    // Precondition (trap 13b): the fixture must genuinely lack the key, or this
    // test rots silently the day someone tidies it.
    expect(m.groundingState).toBeUndefined()
    expect(isGeneralGuidance(m)).toBe(false)
  })
})

