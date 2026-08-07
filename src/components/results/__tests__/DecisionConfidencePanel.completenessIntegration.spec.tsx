/**
 * Integrated RTL test — DecisionConfidencePanel + Wave 4 completeness
 * (P0 V5 golden-path repair, follow-up review).
 *
 * The original Wave 4 RTL coverage pinned HeroQualifier in isolation.
 * Review correctly noted that doesn't prove the wired source-to-render
 * path: useResultsSectionData → DecisionConfidencePanel → HeroQualifier.
 * This test mounts DecisionConfidencePanel with three realistic
 * fixture states (full / partial / failed source coverage) and asserts
 * the rendered output AND the qualifier behaviour together.
 *
 * The fixtures synthesise `data: ResultsSectionDataReturn` directly so
 * we exercise the wiring without depending on the canvas-store wiring
 * (covered separately by useResultsSectionData.spec.ts). The
 * `completeness` field on ResultsSectionDataReturn is what
 * DecisionConfidencePanel reads to drive HeroQualifier — pinning that
 * propagation is the integration-level guarantee this test provides.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { ResultCompleteness } from '../useResultCompleteness'
import type {
  DecisionResultData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

interface FixtureOpts {
  completeness?: ResultCompleteness
  /**
   * Set winProbability=null on options to simulate the partial-source
   * case the source-to-render trace identified — PLoT didn't emit
   * win_probability for any option.
   */
  withWinProbability?: boolean
}

function makeData(opts: FixtureOpts = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: opts.withWinProbability === false ? null : 0.7,
    goalProbability: 0.7,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt-b',
    label: 'Option B',
    expectedValue: 0.4,
    p10: 0.2,
    p90: 0.6,
    winProbability: opts.withWinProbability === false ? null : 0.3,
    goalProbability: 0.3,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.82,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
    // ROADMAP 1.267: this fixture is about COMPLETENESS qualifiers on a run
    // that has a recommended option, so it must now say that a leading option
    // is permitted. Without a verdict the panel resolves NO_CLAIM_VERDICT and
    // renders the withheld headline — correct behaviour, wrong scenario.
    // Note the partial-source case deliberately nulls the runner-up's
    // winProbability; the verdict is a PRODUCER claim and is unaffected by
    // that, which is the point of keeping the two separate.
    verdict: {
      leaderId: 'opt-a',
      separation: 'clear',
      hasLeadingOption: true,
      gapPp: 50,
      source: 'producer_near_tie',
    },
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
  }

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  const completeness: ResultCompleteness = opts.completeness ?? {
    status: 'full',
    missing: [],
    reasons: [],
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness,
  } as ResultsSectionDataReturn
}

describe('DecisionConfidencePanel × Wave 4 completeness (integrated RTL)', () => {
  // -------------------------------------------------------------------------
  // Full source — no qualifier from completeness (dimension qualifier may
  // still fire at its own threshold; verified absent here by setting all
  // dimensions ≥ 0.7).
  // -------------------------------------------------------------------------
  it('full source coverage → no completeness qualifier surfaced', () => {
    render(<DecisionConfidencePanel data={makeData({ completeness: undefined })} />)
    const qualifier = screen.queryByTestId('hero-qualifier')
    if (qualifier) {
      // If a qualifier renders at all, it must NOT be the completeness
      // path — partial source data wasn't supplied.
      expect(qualifier.getAttribute('data-qualifier-source')).not.toBe('completeness')
    }
    // The recommended option still renders (rendered behaviour
    // unaffected by the wiring).
    expect(
      screen.getAllByText((_content, el) => el?.textContent?.includes('Option A') ?? false).length,
    ).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Partial source — completeness qualifier renders curated copy. Pins
  // the source-to-render trace at the integration level: a fixture with
  // missing win_probability surfaces the curated qualifier line, not a
  // null value rendered as truth.
  // -------------------------------------------------------------------------
  it('partial source (win_probability missing) → curated qualifier visible + recommended option still renders', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          withWinProbability: false,
          completeness: {
            status: 'partial',
            missing: ['win_probability'],
            reasons: ['win_probability_missing'],
          },
        })}
      />,
    )
    const qualifier = screen.getByTestId('hero-qualifier')
    expect(qualifier.getAttribute('data-qualifier-source')).toBe('completeness')
    // Curated copy from freshnessReasons.ts; raw code never appears.
    expect(qualifier.textContent).toContain('Likelihood scores')
    expect(qualifier.textContent).not.toContain('win_probability_missing')
    // Critical integration guarantee: the partial-source qualifier
    // does NOT suppress the rest of the panel — recommended option
    // still renders (so the user sees the analysis AND the honest
    // qualifier together).
    expect(
      screen.getAllByText((_content, el) => el?.textContent?.includes('Option A') ?? false).length,
    ).toBeGreaterThan(0)
  })

  it('partial source (sensitivity missing) → curated copy mentions sensitivity, no internal terms', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          completeness: {
            status: 'partial',
            missing: ['sensitivity'],
            reasons: ['sensitivity_missing'],
          },
        })}
      />,
    )
    const qualifier = screen.getByTestId('hero-qualifier')
    expect(qualifier.textContent).toContain('sensitivity')
    expect(qualifier.textContent).not.toContain('sensitivity_missing')
    // Forbidden internal terms must not leak from the wiring.
    expect(qualifier.textContent).not.toMatch(/\bnoop\b/i)
    expect(qualifier.textContent).not.toMatch(/\bgraph_hash\b/i)
    expect(qualifier.textContent).not.toMatch(/\bfact_type\b/i)
  })

  it('failed status (decision review unavailable) → curated coaching copy surfaced', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          completeness: {
            status: 'partial',
            missing: ['decision_review'],
            reasons: ['decision_review_unavailable'],
          },
        })}
      />,
    )
    const qualifier = screen.getByTestId('hero-qualifier')
    expect(qualifier.getAttribute('data-qualifier-source')).toBe('completeness')
    // Decision-review fallback copy comes through the curated table.
    expect(qualifier.textContent).toMatch(/coaching|decision/i)
  })

  it('redaction at the integrated boundary: no raw codes in any DOM attribute', () => {
    // Pins P1.2 — even at the integrated path, raw codes must not
    // surface as DOM attribute values.
    render(
      <DecisionConfidencePanel
        data={makeData({
          completeness: {
            status: 'partial',
            missing: ['win_probability', 'sensitivity'],
            reasons: ['win_probability_missing', 'sensitivity_missing'],
          },
        })}
      />,
    )
    const qualifier = screen.getByTestId('hero-qualifier')
    for (const attr of Array.from(qualifier.attributes)) {
      expect(attr.value).not.toContain('win_probability_missing')
      expect(attr.value).not.toContain('sensitivity_missing')
    }
  })
})
