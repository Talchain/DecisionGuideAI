/**
 * ROADMAP 2.800 (a) + (b) — UNDISCLOSED SUBSTITUTION ON THE OPTION-COMPARISON
 * SURFACE.
 *
 * THE INVARIANT: a displayed statistic must be the statistic it is labelled as,
 * or it must be disclosed, or it must be absent. Those are the only three
 * honest outcomes. Two substitutions reached a reader, and this file pins the
 * third outcome for both:
 *
 *   (b) `computeOptionScale` folded `?? 0` across every option, so ONE option
 *       the engine never scored dragged EVERY other option's bar geometry
 *       toward zero. Not a printed number — a distorted picture across the
 *       whole comparison, and the most severe limb because it corrupts the
 *       display of data that IS present.
 *
 *   (a) An absent MEDIAN was filled with the MEAN at the render site
 *       (`p50 ?? mean`). At the time this was not a subtle mislabel: the V7
 *       lens printed a standing caption reading "Dots show the median." — so a
 *       substituted dot made the surface state, in words, that a number was the
 *       median when it was the mean. ⚠ THAT CAPTION DIED WITH THE V7 DECK and
 *       nothing on the surviving surface restates it, so the case pinning it is
 *       removed below. The rule itself is UNCHANGED and still pinned: an absent
 *       p50 draws no dot and prints no middle label. A dot is a positional
 *       claim about the median whether or not a sentence says so.
 *
 * ORACLE — the producer's own declared semantics, not this lane's reading
 * (trap 13c: a mutant kit validates sensitivity, never correctness). The type
 * that declares these fields says it itself, `results/types.ts`:
 *   "p10/p50/p90 are percentiles; mean is the arithmetic average. Note: mean
 *    (expected) and p50 (median) are semantically different for skewed
 *    distributions."
 * A robustness Monte-Carlo distribution is exactly where they diverge.
 *
 * ⚠⚠ RE-POINTED BY THE V7 RETIREMENT, AND THE SCOPE CHANGE IS STATED RATHER
 * THAN SLIPPED IN. Two components rendered the same shared `OptionRangeBar`.
 * These pins used to render the V7 one (`v7-range-bar`, mounted through
 * `V7TopMatter` on the temporary "Alt view" comparison tab), because a DOM
 * census over `PHASE0-EVIDENCE-2026-07-28/` put `v7-range-bar` in 53 capture
 * files against `option-range-bar` in 1. That component, its host and that tab
 * are DELETED, so the ONLY surviving consumer of `OptionRangeBar` is
 * `OptionCards`' bar (`option-range-bar`) on the Analysis tab — and every arm
 * below now renders THAT.
 *
 * ⚠ THE HONEST COST OF THE MOVE, named: `OptionCards`' bar sits inside
 * `{expertMode && ...}`, so the surviving surface is EXPERT-GATED where the V7
 * one was flagless. These pins therefore cover a surface fewer readers reach.
 * They are re-pointed rather than deleted because the substitution they guard
 * lives in `OptionRangeBar` and `computeOptionScale` — SHARED code, still live,
 * and the unit-level arm below exercises it with no host at all.
 *
 * Every rendered arm still renders the MOUNT PATH (`<ResultsBody expertMode>`)
 * rather than a component in isolation, and the first arm asserts the mount
 * itself — rows 2.466 and 2.491 shipped the same feature dark TWICE past a full
 * mutant kit, a RED-first discipline and a positive control, because every
 * instrument was pointed at a component the deployed flags do not mount. A
 * green suite is not evidence about a surface the deployment does not render.
 *
 * BINDING: every assertion addresses a row by `data-option-id="<exact id>"` and
 * re-asserts that row's own label, so no assertion can be satisfied by a
 * sibling (trap 19).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

import { ResultsBody } from '../ResultsBody'
import { computeOptionScale } from '../shared/OptionRangeBar'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

type Stats = {
  mean?: number | null
  p10?: number | null
  p50?: number | null
  p90?: number | null
  win?: number
}

/**
 * An option in exactly the shape the hook emits: `outcome` is ALWAYS present
 * and its four members are `number | null`.
 *
 * ⚠ THE UNSCORED OPTION IS NOT AN EXOTIC PRODUCER STATE. `useResultsSectionData`
 * builds its option list from `nodes.filter(kind === 'option')` — EVERY option
 * node on the canvas — and looks each one up in `report.option_probabilities`,
 * which only holds the ones the engine scored (`optionProbs[nodeId] || {}`). An
 * option added after the last run, or simply not returned, therefore arrives
 * here as four nulls. That is a mundane, high-frequency state, and it is what
 * fed the `?? 0` fold.
 */
function opt(id: string, label: string, s: Stats = {}): OptionResult {
  return {
    id,
    label,
    expected: s.mean ?? null,
    outcome: {
      mean: s.mean ?? null,
      p10: s.p10 ?? null,
      p50: s.p50 ?? null,
      p90: s.p90 ?? null,
    },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    winProbability: s.win,
    goalProbability: undefined,
    nValidSamples: 10000,
  } as unknown as OptionResult
}

function makeData(options: OptionResult[]): ResultsSectionDataReturn {
  const recommendation = {
    recommendedOption: options[0],
    allOptions: options,
    goalLabel: 'Grow revenue',
    goalThreshold: null,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.9,
    robustnessLevel: 'medium',
    isNormalised: true,
    verdict: { hasLeadingOption: true },
  } as unknown as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }
  const confidence = {
    tier: { tier: 'fair', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
    challengeFragileEdges: [],
    conditionalWinners: [],
  } as unknown as ConfidenceSectionData
  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData
  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Grow revenue',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

/** THE ANALYSIS-TAB host — `OptionCards`' bar is the only surviving consumer of
 *  the shared `OptionRangeBar`, and it is expert-gated (see the header). */
function renderAnalysisTab(options: OptionResult[], expertMode = false) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(options)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode={expertMode}
    />,
  )
}

/** THE MOUNT PATH, with the gate the surviving bar actually sits behind. */
function renderBody(options: OptionResult[]) {
  return renderAnalysisTab(options, true)
}

/**
 * Select an option card by IDENTITY — the option id addresses it and the
 * option's own label is re-asserted, so a card carrying the right geometry under
 * the wrong identity satisfies nothing.
 */
function rowByIdentity(optionId: string, label: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(
    `[data-testid="option-card-${optionId}"][data-option-id="${optionId}"]`,
  )
  expect(row, `no option card rendered for option id "${optionId}"`).not.toBeNull()
  expect(row!.textContent, `identity: card ${optionId} must show "${label}"`).toContain(label)
  return row!
}

function rangeBar(optionId: string, label: string): HTMLElement {
  const bar = within(rowByIdentity(optionId, label)).queryByTestId('option-range-bar')
  expect(bar, `option "${optionId}" rendered no option-range-bar`).not.toBeNull()
  return bar as HTMLElement
}

/** The bar's fill geometry, as percentages of the shared scale. */
function barGeometry(optionId: string, label: string): { left: string; width: string } {
  const fill = rangeBar(optionId, label).querySelector<HTMLElement>('.absolute.top-0')
  expect(fill, `option "${optionId}" range bar rendered no fill element`).not.toBeNull()
  return { left: fill!.style.left, width: fill!.style.width }
}

/** The bar's printed labels, in DOM order: [p10, (median), p90]. */
function barLabels(optionId: string, label: string): string[] {
  return Array.from(rangeBar(optionId, label).querySelectorAll('span')).map(
    (s) => s.textContent ?? '',
  )
}

afterEach(() => {
  cleanup()
})

// ───────────────────────────────────────────────────────────────────────────
// MOUNT PATH — the binding every other arm in this file depends on
// ───────────────────────────────────────────────────────────────────────────

describe('2.800 — MOUNT PATH: the pinned surface is the one the deployed build renders', () => {
  const TWO_SCORED = () => [
    opt('scored', 'Scored option', { p10: 50, p50: 75, p90: 100, win: 0.6 }),
    opt('other', 'Other option', { p10: 60, p50: 70, p90: 80, win: 0.4 }),
  ]

  it('the Analysis tab mounts the option card and its range bar under expert mode', () => {
    renderBody(TWO_SCORED())

    // If the bar is ever re-hosted on a component the deployed flags leave
    // unmounted, THIS reds — which is the alarm 2.466 and 2.491 did not have.
    expect(screen.queryByTestId('outputs-results-redesign')).not.toBeNull()
    expect(rangeBar('scored', 'Scored option')).not.toBeNull()
  })

  it('GATE CONTROL — without expert mode the bar is NOT rendered', () => {
    // The honest scope of every rendered arm below, asserted rather than
    // described: this surface is expert-gated, so a reader on the default
    // posture sees no bar at all. Stating it here stops a later change reading
    // these pins as covering the default Analysis tab.
    renderAnalysisTab(TWO_SCORED(), false)
    expect(screen.queryByTestId('outputs-results-redesign')).not.toBeNull()
    expect(
      within(rowByIdentity('scored', 'Scored option')).queryByTestId('option-range-bar'),
      'the surviving range bar is expert-gated — this control pins that scope',
    ).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// (b) An absent value must not participate in the shared scale
// ───────────────────────────────────────────────────────────────────────────

describe('2.800b — computeOptionScale: an ABSENT value must not participate', () => {
  it('does not drag globalMin toward zero when one option was never scored', () => {
    expect(
      computeOptionScale([
        opt('scored', 'Scored', { p10: 50, p50: 75, p90: 100 }),
        opt('unscored', 'Unscored'),
      ]),
    ).toEqual({ globalMin: 50, globalMax: 100 })
  })

  it('does not drag globalMax UP to zero when every scored option is negative', () => {
    expect(
      computeOptionScale([
        opt('scored', 'Scored', { p10: -100, p50: -75, p90: -50 }),
        opt('unscored', 'Unscored'),
      ]),
    ).toEqual({ globalMin: -100, globalMax: -50 })
  })

  it('spans exactly the options that render a bar, across several scored options', () => {
    expect(
      computeOptionScale([
        opt('a', 'A', { p10: 10, p90: 40 }),
        opt('b', 'B', { p10: 30, p90: 90 }),
        opt('unscored', 'Unscored'),
      ]),
    ).toEqual({ globalMin: 10, globalMax: 90 })
  })

  it('a lone MEAN is not a range bound — it is never drawn on this axis', () => {
    // An option carrying `mean` but no percentiles renders no bar (the bar needs
    // p10 AND p90), so stretching the shared axis to cover it would move every
    // OTHER option's geometry to make room for a value nobody can see.
    expect(
      computeOptionScale([
        opt('scored', 'Scored', { p10: 50, p90: 100 }),
        opt('meanOnly', 'Mean only', { mean: 5 }),
      ]),
    ).toEqual({ globalMin: 50, globalMax: 100 })
  })

  it('returns null — EXPLICITLY degenerate — when no option carries a full range', () => {
    expect(computeOptionScale([opt('a', 'A'), opt('b', 'B', { mean: 42 })])).toBeNull()
  })

  it('returns null for an empty option set', () => {
    expect(computeOptionScale([])).toBeNull()
  })
})

describe('2.800b — the rendered comparison is unmoved by an option with no stats', () => {
  it("an unscored option does not move the SCORED option's bar", () => {
    renderBody([
      opt('scored', 'Scored option', { p10: 50, p50: 75, p90: 100, win: 0.6 }),
      opt('unscored', 'Unscored option'),
    ])

    // The only option with a range defines the whole scale, so its bar fills it.
    // Under the `?? 0` fold the unscored option pinned globalMin at 0 and this
    // bar started halfway across: { left: '50%', width: '50%' }.
    expect(barGeometry('scored', 'Scored option')).toEqual({ left: '0%', width: '100%' })

    // The unscored option itself still renders its row and still shows NO bar —
    // absence stays absence, it is not backfilled with a zero-width artefact.
    expect(
      within(rowByIdentity('unscored', 'Unscored option')).queryByTestId('option-range-bar'),
    ).toBeNull()
  })

  it('POSITIVE CONTROL — geometry really does vary between two scored options', () => {
    // Without this, the assertion above could pass on a helper that always reads
    // 0%/100%: an absence pin is worthless until it has been shown to see a
    // presence.
    renderBody([
      opt('low', 'Low option', { p10: 0, p50: 25, p90: 50, win: 0.5 }),
      opt('high', 'High option', { p10: 50, p50: 75, p90: 100, win: 0.5 }),
    ])

    expect(barGeometry('low', 'Low option')).toEqual({ left: '0%', width: '50%' })
    expect(barGeometry('high', 'High option')).toEqual({ left: '50%', width: '50%' })
  })
})

// ───────────────────────────────────────────────────────────────────────────
// (a) An absent median must not be filled with the mean
// ───────────────────────────────────────────────────────────────────────────

describe('2.800a — median honesty: an absent p50 is NEVER the mean', () => {
  it('renders no median dot and no median label when the producer sent no p50', () => {
    renderBody([
      opt('a', 'Skewed option', { mean: 90, p10: 10, p50: null, p90: 100, win: 0.6 }),
      opt('b', 'Other option', { mean: 50, p10: 20, p50: 50, p90: 80, win: 0.4 }),
    ])

    // Only the two range ends are printed for the option with no median. Under
    // the substitution the MEAN rendered in the median's slot: ['10','90','100'].
    expect(barLabels('a', 'Skewed option')).toEqual(['10', '100'])
    // ...and the dot — the glyph that positions the claim on the axis — is
    // absent rather than sitting at the mean's position.
    expect(rangeBar('a', 'Skewed option').querySelector('.rounded-full')).toBeNull()

    // POSITIVE CONTROL in the same tree: the sibling that DID get a median still
    // shows its dot, so the absence above is a fact about that option and not
    // about the harness (trap 13 — prove the instrument can see a presence).
    expect(barLabels('b', 'Other option')).toEqual(['20', '50', '80'])
    expect(rangeBar('b', 'Other option').querySelector('.rounded-full')).not.toBeNull()
  })

  it('the median dot is the MEDIAN — a present p50 is never displaced by the mean', () => {
    // Discriminating partner: proves the render reads p50 specifically, not
    // "whichever central value happens to be around". mean and p50 are far
    // apart and on opposite sides of the range.
    //
    // ⚠ TWO OPTIONS, not one: this surviving host renders an option COMPARISON,
    // so a one-option fixture paints no card at all and the assertion below
    // would fail for a reason unrelated to the median. The labels asserted are
    // that option's OWN raw values, so the sibling cannot satisfy them.
    renderBody([
      opt('a', 'Skewed option', { mean: 20, p10: 0, p50: 80, p90: 100, win: 0.6 }),
      opt('b', 'Other option', { mean: 50, p10: 20, p50: 50, p90: 80, win: 0.4 }),
    ])

    expect(barLabels('a', 'Skewed option')).toEqual(['0', '80', '100'])
  })

  // ⚠⚠ THE CAPTION CASE IS REMOVED, AND ITS ABSENCE IS A FINDING. It pinned
  // `V7_LENS_COPY.outcome.caption` — "Dots show the median. Bars show the
  // realistic range (10th to 90th percentile)." — the sentence that made a
  // substituted dot a false STATEMENT rather than a mislabelled glyph. That
  // deck is deleted with the V7 group and NOTHING on the surviving surface
  // restates it: `OptionCards` draws the dot with no caption at all. So after
  // this retirement the product draws a median dot it never names. That is a
  // disclosure gap to row, not something to reconstruct here against copy that
  // does not exist — and the substitution rule the caption justified is
  // unaffected and still pinned by the two cases above.
})

// ───────────────────────────────────────────────────────────────────────────
// The expert-gated twin shares the same shared helper — pinned so the two
// surfaces cannot drift back apart
// ───────────────────────────────────────────────────────────────────────────

describe('2.800a — the expert OptionCards bar holds the same median rule', () => {
  it('shows no median label when the producer sent no p50, and one when it did', () => {
    renderAnalysisTab(
      [
        opt('a', 'Skewed option', { mean: 90, p10: 10, p50: null, p90: 100, win: 0.6 }),
        opt('b', 'Other option', { mean: 50, p10: 20, p50: 50, p90: 80, win: 0.4 }),
      ],
      true,
    )

    const cardA = screen.getByTestId('option-card-a')
    const barA = within(cardA).getByTestId('option-range-bar')
    expect(Array.from(barA.querySelectorAll('span')).map((s) => s.textContent)).toEqual(['10', '100'])

    const cardB = screen.getByTestId('option-card-b')
    const barB = within(cardB).getByTestId('option-range-bar')
    expect(Array.from(barB.querySelectorAll('span')).map((s) => s.textContent)).toEqual([
      '20',
      '50',
      '80',
    ])
  })
})
