/**
 * Copy hygiene for the influence-scale disclosure strings (lane C4, review
 * fix 3 — house pattern: per-surface spec over centralised copy; no repo-wide
 * guard exists; same rules as decision-overview/__tests__/copyHygiene.spec.ts,
 * brief §13.4): no em dashes in prose (DS ban, U+2014), sentence case (no
 * shouting caps), en-GB, no internal analytical terms in user-facing strings.
 *
 * Every surface (DriversSection tooltip/explainer/caption, MetricPills pill
 * title/aria, FactorNode detailed Influence row) imports these strings from
 * influenceScaleCopy.ts, so policing the module polices every surface.
 */
import { describe, it, expect } from 'vitest'

import {
  INFLUENCE_EXPLANATION_GENERIC,
  INFLUENCE_EXPLANATION_RELATIVE,
  INFLUENCE_EXPLANATION_ABSOLUTE,
  INFLUENCE_RANKING_EXPLAINER_GENERIC,
  INFLUENCE_RANKING_EXPLAINER_RELATIVE,
  INFLUENCE_SCALE_CAPTION,
  influenceExplanation,
  influencePillAriaLabel,
  influenceBarAriaLabel,
} from '../influenceScaleCopy'

const BANNED_TERMS = /\b(node|edge|coefficient|elasticity|normalised value|graph hash|winner|validate)\b/i
const AMERICAN = /\b(analyze|optimize|color|behavior|center|favorite)\w*/i

const PROVENANCES = ['normalised_elasticity', 'influence_score', null] as const

function allStrings(): string[] {
  return [
    INFLUENCE_EXPLANATION_GENERIC,
    INFLUENCE_EXPLANATION_RELATIVE,
    INFLUENCE_EXPLANATION_ABSOLUTE,
    INFLUENCE_RANKING_EXPLAINER_GENERIC,
    INFLUENCE_RANKING_EXPLAINER_RELATIVE,
    INFLUENCE_SCALE_CAPTION,
    // Exercise the builders across every basis so template output is policed
    // too (aria-labels are user-facing copy for screen-reader users).
    ...PROVENANCES.flatMap((p) => [
      influenceExplanation(p),
      influencePillAriaLabel(62, p),
      influenceBarAriaLabel(p),
    ]),
  ]
}

describe('influence-scale disclosure copy hygiene (C4 fix 3)', () => {
  it('contains no em dashes (U+2014) in any user-facing string', () => {
    for (const s of allStrings()) expect(s, s).not.toContain('—')
  })

  it('contains no shouting caps', () => {
    for (const s of allStrings()) {
      const shouting = s.match(/\b[A-Z]{2,}\b/g) ?? []
      expect(shouting, s).toEqual([])
    }
  })

  it('avoids internal analytical vocabulary and American spellings', () => {
    for (const s of allStrings()) {
      expect(s, s).not.toMatch(BANNED_TERMS)
      expect(s, s).not.toMatch(AMERICAN)
    }
  })
})
