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
  analysisMetricContextSentence,
  analysisMetricPredicate,
  analysisMetricTitle,
  analysisMetricVisibleLabel,
  ZERO_REASON_BADGE_LABELS,
  INFLUENCE_QUANTITY_BY_BASIS,
} from '../influenceScaleCopy'
import {
  resolveAnalysisMetric,
  type ResolvedAnalysisMetric,
} from '../driverDisplayModel'

const BANNED_TERMS = /\b(node|edge|coefficient|elasticity|normalised value|graph hash|winner|validate)\b/i
const AMERICAN = /\b(analyze|optimize|color|behavior|center|favorite)\w*/i

const PROVENANCES = ['normalised_elasticity', 'influence_score', null] as const

function allStrings(): string[] {
  const metrics = [
    resolveAnalysisMetric({ value: 0.62, basis: 'influence_score' }),
    resolveAnalysisMetric({ value: 0.62, basis: 'normalised_elasticity' }),
    resolveAnalysisMetric({ value: 0.62, basis: 'pre_analysis_influence' }),
    resolveAnalysisMetric({ value: 0.62, basis: 'value_of_information' }),
  ].filter((metric): metric is ResolvedAnalysisMetric => metric != null)
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
    ...metrics.flatMap((metric) => [
      analysisMetricVisibleLabel(metric),
      analysisMetricTitle(metric),
      analysisMetricPredicate(metric),
      analysisMetricContextSentence(metric),
    ]),
    /* ⚠ ADDED WHEN THE MAP MOVED HERE FROM `DriversSection.tsx`. This list is a
       HAND-MAINTAINED MIRROR (CLAUDE.md trap 12) — a string not named here is
       silently unpoliced by all three cases below — so an export arriving in
       this module has to arrive in this array in the same commit.

       `Object.values` rather than three literals: the map is TOTAL over
       `NonNullable<ZeroReasonCode>`, so a fourth code added to the union is
       policed here without anyone remembering to extend this line. */
    ...Object.values(ZERO_REASON_BADGE_LABELS),
    /* The quantity vocabulary, DERIVED rather than listed. The record is TOTAL
       over `DriverDisplayProvenance`, so a third basis is policed here without
       anyone remembering to extend this array — same mechanism as
       `ZERO_REASON_BADGE_LABELS` above, and for the same reason the comment
       there gives. All three fields are user-facing: `noun` and `gloss` reach a
       reader through the vocabulary's consumers, and `runDisclosure` is
       rendered as visible caption copy by `DriversSection`. */
    ...Object.values(INFLUENCE_QUANTITY_BY_BASIS).flatMap((q) => [
      q.noun,
      q.gloss,
      q.runDisclosure,
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
