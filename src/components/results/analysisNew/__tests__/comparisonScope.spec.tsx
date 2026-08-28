/**
 * THE WIN SHARE AND ITS SCOPE CANNOT BE READ INDEPENDENTLY (ROADMAP 2.1340).
 *
 * ## The defect, measured — not imagined
 *
 * At a controlled old-vs-new capture on deployed staging (28 Aug 2026), on ONE
 * run (`v5:5e1163417a07db81`), at the same dock width and viewport:
 *
 *   existing Analysis  "Comparing 2 of your 3 options — Hybrid: In-house core
 *                       with 3PL overflow was left out. Ranks and comparative
 *                       percentages describe those 2 only."
 *   Analysis (New)     "Ahead in 60% of simulated futures."   ← and nothing else
 *
 * Verified by full-text extraction of both panels, not by eye: the string
 * `Comparing 2 of your 3 options` had ZERO occurrences in the new surface.
 *
 * The percentage was not wrong. It was a true statement about a candidate set
 * the reader never learns, and the reader supplies the wrong one. ISL defines
 * `win_probability`, `rank`, `expected_regret` and the flip thresholds OVER THE
 * CANDIDATE SET — so a 60% among two is not a 60% among three.
 *
 * ## Why the states below are the ones that matter
 *
 * `deriveComparisonScope` returns `null` for THREE documented reasons, and they
 * do not license the same thing:
 *
 *   nothing excluded  → the share describes every option → render it BARE
 *   nothing analysed  → no establishable candidate set    → WITHHOLD the share
 *   empty input       → no establishable candidate set    → WITHHOLD the share
 *
 * Reading that one `null` as "no note needed" is trap 21 — two questions under
 * one name, where the fail-open answer is right for one and a falsehood for the
 * other. The three cases below are exactly that discrimination, and case 2 is
 * the one a blind implementation cannot fake: an implementation that rendered
 * the note everywhere would pass cases 1 and 3 and fail 2.
 *
 * ## What this corpus does and does not establish (trap 22)
 *
 * The option records are typed as `OptionResult`, so their SHAPE is the
 * producer's, enforced by the compiler rather than by my memory of it. The
 * scope sentence, the excluded-option sentence and the not-analysed reason are
 * all produced by the estate's OWN sanctioned functions
 * (`deriveComparisonScope`, `COMPARISON_SCOPE_COPY`, `notAnalysedReasonCopy`) —
 * asserted by calling them, never by re-typing their strings, so a copy change
 * in the owning module cannot leave this file green against stale wording.
 *
 * It does NOT establish that the producer emits these combinations; that is
 * bounded by `useResultsSectionData.notAnalysed.spec.ts`, which drives the real
 * V2 mapper, and by the live capture above.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { COMPARISON_SCOPE_COPY, deriveComparisonScope } from '../../utils/goalAnchorCopy'
import { notAnalysedReasonCopy } from '../../utils/notAnalysedCopy'
import type { OptionResult } from '../../types'
import { genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

afterEach(() => cleanup())

/** Typed as the producer's own record, so the compiler owns the shape. */
const option = (over: Partial<OptionResult> & { id: string; label: string }): OptionResult =>
  ({ winProbability: 0.5, ...over }) as OptionResult

/**
 * A run over `allOptions`, otherwise the entitled-leader fixture. Only the
 * option set varies between cases — everything else is held constant, so a
 * difference in output is attributable to scope and to nothing else.
 */
function withOptions(allOptions: OptionResult[]): ResultsSectionDataReturn {
  const base = genuineDecision()
  const leader = allOptions.find((o) => o.notAnalysed !== true) ?? allOptions[0]
  return {
    ...base,
    recommendation: {
      ...base.recommendation,
      allOptions,
      recommendedOption: leader,
      winProbability: 0.6,
      verdict: { leaderId: leader?.id, hasLeadingOption: true },
    },
  } as ResultsSectionDataReturn
}

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    recommendationCandidateCount: 0,
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

// The live-captured shape: three options, one of which the engine never scored.
const THREE_OPTIONS_TWO_ANALYSED = [
  option({ id: 'o_3pl', label: 'Moving to a 3PL', winProbability: 0.6 }),
  option({ id: 'o_inhouse', label: 'Keeping it in-house', winProbability: 0.4 }),
  option({
    id: 'o_hybrid',
    label: 'Hybrid: In-house core plus 3PL overflow',
    notAnalysed: true,
    notAnalysedReason: 'not_returned',
  }),
]

describe('1 · a subset run shows the share WITH its scope, and names who was left out', () => {
  it('states the scope beside the number, from the sanctioned register', () => {
    const glance = glanceOf(withOptions(THREE_OPTIONS_TWO_ANALYSED))
    expect(glance.winShare).toBe('Ahead in 60% of simulated futures')
    expect(glance.comparisonScope.kind).toBe('partial')

    render(<AtAGlance glance={glance} />)

    // Asserted by CALLING the owner, never by re-typing its wording.
    const scope = deriveComparisonScope(THREE_OPTIONS_TWO_ANALYSED)!
    const note = screen.getByTestId('comparison-scope-note-analysisNew')
    expect(note).toHaveTextContent(COMPARISON_SCOPE_COPY.sentence(scope))
    // A win share is a set-dependent VALUE, so the consequence line rides too.
    expect(note).toHaveTextContent(COMPARISON_SCOPE_COPY.detail(scope))
  })

  it('the excluded option says it has no rank and no probability', () => {
    render(<AtAGlance glance={glanceOf(withOptions(THREE_OPTIONS_TWO_ANALYSED))} />)
    const rows = screen.getAllByTestId('analysis-new-glance-excluded-option')
    expect(rows).toHaveLength(1)
    // Bound by IDENTITY (the option's id), never by matching a copy string.
    expect(rows[0].dataset.optionId).toBe('o_hybrid')
    expect(rows[0]).toHaveTextContent('Hybrid: In-house core plus 3PL overflow')
    expect(rows[0]).toHaveTextContent('Not analysed')
    expect(rows[0]).toHaveTextContent(notAnalysedReasonCopy('not_returned'))
  })

  it('scope and number are in ONE region, so neither can be read alone', () => {
    // The defect was not "the scope is missing from the panel" — it was that a
    // reader of the number never reaches the scope. Adjacency IS the fix, so it
    // is what gets pinned: both inside the glance, scope after the share.
    const { container } = render(<AtAGlance glance={glanceOf(withOptions(THREE_OPTIONS_TWO_ANALYSED))} />)
    const glanceEl = screen.getByTestId('analysis-new-glance')
    const share = screen.getByTestId('analysis-new-glance-win-share')
    const scopeEl = screen.getByTestId('analysis-new-glance-scope')

    expect(glanceEl.contains(share)).toBe(true)
    expect(glanceEl.contains(scopeEl)).toBe(true)
    expect(
      share.compareDocumentPosition(scopeEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // And nothing collapsible sits between them.
    expect(container.querySelector('[data-testid$="-scope"] details')).toBeNull()
  })
})

describe('2 · a whole-set run carries NO partial-scope qualification', () => {
  it('renders the share bare when every option was analysed', () => {
    const all = [
      option({ id: 'o_3pl', label: 'Moving to a 3PL', winProbability: 0.6 }),
      option({ id: 'o_inhouse', label: 'Keeping it in-house', winProbability: 0.4 }),
    ]
    const glance = glanceOf(withOptions(all))

    expect(glance.winShare).toBe('Ahead in 60% of simulated futures')
    expect(glance.comparisonScope.kind).toBe('whole_set')

    render(<AtAGlance glance={glance} />)
    // ⭐ THE DISCRIMINATING CASE. An implementation that rendered the note
    // unconditionally would pass cases 1 and 3 and fail only here.
    expect(screen.queryByTestId('comparison-scope-note-analysisNew')).toBeNull()
    expect(screen.queryByTestId('analysis-new-glance-excluded-option')).toBeNull()
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeInTheDocument()
  })
})

describe('3 · an unresolvable candidate set WITHHOLDS the share', () => {
  it('renders no share when no option was analysed', () => {
    const glance = glanceOf(
      withOptions([
        option({ id: 'o_a', label: 'A', notAnalysed: true, notAnalysedReason: 'not_returned' }),
        option({ id: 'o_b', label: 'B', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      ]),
    )
    expect(glance.comparisonScope.kind).toBe('unresolved')
    expect(glance.winShare).toBeNull()

    render(<AtAGlance glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-win-share')).toBeNull()
  })

  it('renders no share when the option set is empty', () => {
    const glance = glanceOf(withOptions([]))
    expect(glance.comparisonScope.kind).toBe('unresolved')
    expect(glance.winShare).toBeNull()
    render(<AtAGlance glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-win-share')).toBeNull()
  })

  it('withholding the share does not withhold the rest of the read', () => {
    // Suppression must be surgical. If it silently took the headline or the
    // verdict with it, this rule would be trading one loss for another.
    const glance = glanceOf(
      withOptions([option({ id: 'o_a', label: 'A', notAnalysed: true, notAnalysedReason: 'not_returned' })]),
    )
    render(<AtAGlance glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-win-share')).toBeNull()
    expect(screen.getByTestId('analysis-new-glance-verdict')).toBeInTheDocument()
  })
})
