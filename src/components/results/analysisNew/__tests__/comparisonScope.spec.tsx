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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance, EXCLUDED_OPTION_VISIBLE_CAP } from '../sections/AtAGlance'
import { COMPARISON_SCOPE_COPY, deriveComparisonScope } from '../../utils/goalAnchorCopy'
import { notAnalysedReasonCopy } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
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

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)

    // Asserted by CALLING the owner, never by re-typing its wording.
    const scope = deriveComparisonScope(THREE_OPTIONS_TWO_ANALYSED)!
    const note = screen.getByTestId('comparison-scope-note-analysisNew')
    expect(note).toHaveTextContent(COMPARISON_SCOPE_COPY.sentence(scope))
    // A win share is a set-dependent VALUE, so the consequence line rides too.
    expect(note).toHaveTextContent(COMPARISON_SCOPE_COPY.detail(scope))
  })

  it('the excluded option says it has no rank and no probability', () => {
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(THREE_OPTIONS_TWO_ANALYSED))} />)
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
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(THREE_OPTIONS_TWO_ANALYSED))} />)
    const glanceEl = screen.getByTestId('analysis-new-glance')
    const share = screen.getByTestId('analysis-new-glance-win-share')
    const scopeEl = screen.getByTestId('analysis-new-glance-scope')

    expect(glanceEl.contains(share)).toBe(true)
    expect(glanceEl.contains(scopeEl)).toBe(true)
    expect(
      share.compareDocumentPosition(scopeEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // ⚠ A DEAD ASSERTION WAS REMOVED HERE, and the removal is the point.
    // It read `container.querySelector('[data-testid$="-scope"] details')` and
    // asserted null — but this component renders ZERO `details` elements, so it
    // could not fail for ANY implementation, and it was blind to a collapsible
    // ancestor or a CSS/state-based collapse. It read as coverage of "not
    // behind disclosure" while proving nothing (trap 13b — a guard agreeing
    // with itself). The adjacency property is carried by the
    // compareDocumentPosition pair above, which a mutant does bite. Found by
    // independent review.
  })
})

describe('1b · the gate is A SET-DEPENDENT CLAIM, not the percentage', () => {
  /**
   * ⚠⚠ THIS BLOCK REPLACES A TEST THAT PINNED A DEFECT.
   *
   * Its first version asserted that withholding the leader entitlement removed
   * the scope note. Independent review showed that was the WRONG property and
   * that pinning it had introduced a regression against the previous head: a
   * leader determined by EXPECTED OUTCOME carries a null win probability, so the
   * surface named a leader among 2 of 3 options and asserted the ordering held
   * while disclosing NOTHING about the third.
   *
   * The surface makes three set-dependent claims — the headline superlative, the
   * win share, and the robustness ordering verdict. Any one of them needs the
   * scope. Only a glance carrying NONE of them may say nothing.
   */
  const partialWith = (over: Partial<Record<string, unknown>>): ResultsSectionDataReturn => {
    const base = genuineDecision()
    return {
      ...base,
      recommendation: {
        ...base.recommendation,
        allOptions: [
          option({ id: 'o_a', label: 'Alpha', winProbability: 0.55 }),
          option({ id: 'o_b', label: 'Beta', notAnalysed: true, notAnalysedReason: 'not_returned' }),
        ],
        ...over,
      },
    } as ResultsSectionDataReturn
  }

  it('DISCLOSES on an ordering verdict with no percentage (regression: expected-outcome leader)', () => {
    // Row E. `determinedBy: 'expected_outcome'` yields an entitled leader with a
    // NULL win probability — reachable by construction from useResultsSectionData.
    const glance = glanceOf(
      partialWith({
        winProbability: undefined,
        allOptions: [
          option({ id: 'o_a', label: 'Alpha', winProbability: undefined }),
          option({ id: 'o_b', label: 'Beta', notAnalysed: true, notAnalysedReason: 'not_returned' }),
        ],
        recommendedOption: option({ id: 'o_a', label: 'Alpha', winProbability: undefined }),
        verdict: { leaderId: 'o_a', hasLeadingOption: true },
        determinedBy: 'expected_outcome',
      }),
    )
    expect(glance.winShare, 'precondition: no percentage on this run').toBeNull()
    expect(glance.headline, 'precondition: a superlative IS made').toBeTruthy()
    expect(glance.comparativeClaim).toBe('order')

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.getByTestId('comparison-scope-note-analysisNew')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-glance-excluded-option')).toBeInTheDocument()
  })

  it('DISCLOSES on a robustness verdict alone, with no leader named', () => {
    // Row B. No headline, no share — but "the ordering held" is a claim about
    // an ordering over the analysed subset.
    const glance = glanceOf(partialWith({ verdict: { hasLeadingOption: false } }))
    expect(glance.headline).toBeNull()
    expect(glance.winShare).toBeNull()
    expect(glance.verdict, 'precondition: an ordering verdict IS rendered').toBeTruthy()
    expect(glance.comparativeClaim).toBe('order')

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.getByTestId('comparison-scope-note-analysisNew')).toBeInTheDocument()
  })

  it('an ORDER claim takes the sentence alone — no "comparative percentages" line', () => {
    // `ComparisonScopeNote`'s own rule. `detail` would describe a magnitude that
    // is not on screen — an untruth in the opposite direction.
    const glance = glanceOf(partialWith({ verdict: { hasLeadingOption: false } }))
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    const note = screen.getByTestId('comparison-scope-note-analysisNew')
    const scope = deriveComparisonScope([
      option({ id: 'o_a', label: 'Alpha', winProbability: 0.55 }),
      option({ id: 'o_b', label: 'Beta', notAnalysed: true, notAnalysedReason: 'not_returned' }),
    ])!
    // Positive control: the sentence IS there, so the absence below is a real
    // discrimination and not a query that matched nothing.
    expect(note).toHaveTextContent(COMPARISON_SCOPE_COPY.sentence(scope))
    expect(note.textContent).not.toContain(COMPARISON_SCOPE_COPY.detail(scope))
  })

  it('a share that never RENDERS does not license the percentages line', () => {
    // ⚠ FOUND BY A SURVIVING MUTANT, not by inspection. Dropping the
    // `verdictBlock &&` conjunct from `shareOnScreen` changed nothing in the
    // suite — so the suite could not tell "the model holds a share" from "a
    // share is on screen", which are different facts here: AtAGlance renders
    // the share INSIDE the verdict block, so a run with no robustness verdict
    // shows no percentage even though `winShare` is populated.
    //
    // Treating that as a 'value' claim would print "ranks and comparative
    // percentages describe those N only" with no percentage anywhere — the
    // round-1 defect in miniature, and the reason the gate reads what RENDERS.
    const glance = glanceOf(
      partialWith({ robustnessVerdict: undefined, robustnessVerdictReason: undefined }),
    )
    expect(glance.winShare, 'precondition: the model DOES hold a share').toBeTruthy()
    expect(glance.verdict, 'precondition: nothing renders it').toBeNull()
    expect(glance.comparativeClaim).toBe('order')

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-win-share')).toBeNull()
    const note = screen.getByTestId('comparison-scope-note-analysisNew')
    expect(note.textContent).not.toContain('comparative percentages')
  })

  it('says NOTHING only when no set-dependent claim is made at all', () => {
    const glance = glanceOf(
      partialWith({ verdict: { hasLeadingOption: false }, robustnessVerdict: undefined, robustnessVerdictReason: undefined }),
    )
    expect(glance.headline).toBeNull()
    expect(glance.winShare).toBeNull()
    expect(glance.verdict).toBeNull()
    expect(glance.comparativeClaim).toBe('none')

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.queryByTestId('comparison-scope-note-analysisNew')).toBeNull()
    // The scope is still classified partial — suppression is not reclassification.
    expect(glance.comparisonScope.kind).toBe('partial')
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

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
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

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-win-share')).toBeNull()
  })

  it('classifies an empty option set as unresolved', () => {
    // ⚠ SCOPE OF THIS CASE, STATED HONESTLY. It previously also asserted the
    // share was withheld — but with no options there is no `recommendedOption`,
    // so the PRE-EXISTING `headline &&` gate already nulls the share and that
    // half passed without the scope gate existing at all (proven: the mutant
    // that deletes the scope conjunct REDs the other two case-3 tests and
    // leaves this one green). The CLASSIFICATION is what this case establishes
    // and it does bite; the withholding is established by the cases above and
    // below. Found by independent review.
    const glance = glanceOf(withOptions([]))
    expect(glance.comparisonScope.kind).toBe('unresolved')
  })

  it('never names an excluded option by its raw node id', () => {
    // ⚠ THIS GUARD EXISTED AND WAS UNPINNED — a mutant removing the
    // `label !== id` conjunct left all seven tests green (independent review).
    // `useResultsSectionData` sets `label: node.data?.label || nodeId`, so an
    // unlabelled option arrives carrying its OWN ID as a well-formed string.
    // Without the guard the glance renders "79b5d7c0 — Not analysed…" directly
    // under the win share: a raw internal identifier presented as the name of
    // the user's option. Falling back to the scope sentence's COUNT ("1 was
    // left out") is honest; inventing a name is not.
    const glance = glanceOf(
      withOptions([
        option({ id: 'o_real', label: 'Moving to a 3PL', winProbability: 0.6 }),
        option({ id: '79b5d7c0', label: '79b5d7c0', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      ]),
    )
    expect(glance.comparisonScope.kind).toBe('partial')

    const { container } = render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-excluded-option')).toBeNull()
    expect(container.textContent).not.toContain('79b5d7c0')
    // The exclusion is still disclosed — by count, via the sanctioned register.
    expect(screen.getByTestId('comparison-scope-note-analysisNew')).toBeInTheDocument()
  })

  it('withholding the share does not withhold the rest of the read', () => {
    // Suppression must be surgical. If it silently took the headline or the
    // verdict with it, this rule would be trading one loss for another.
    const glance = glanceOf(
      withOptions([option({ id: 'o_a', label: 'A', notAnalysed: true, notAnalysedReason: 'not_returned' })]),
    )
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glance} />)
    expect(screen.queryByTestId('analysis-new-glance-win-share')).toBeNull()
    expect(screen.getByTestId('analysis-new-glance-verdict')).toBeInTheDocument()
  })
})

/**
 * 5 · THE EXCLUDED-OPTION BLOCK IS BOUNDED.
 *
 * ⭐ WHY THESE EXIST, AND WHY NO EXISTING SPEC COULD SEE THE DEFECT. No prior
 * fixture in this file ever rendered more than ONE excluded ROW, so the block's
 * growth with the option count was not expressible by the corpus — textbook
 * CLAUDE.md trap 22.
 *
 * ⚠ Stated that way deliberately, after a review refuted the looser sentence
 * this once carried ("every fixture carries exactly one excluded option"). One
 * fixture does carry TWO — the unresolved-candidate-set case — but the block
 * never renders at all there, so it could not observe the growth either.
 * (⚠ Mechanism named precisely after a review corrected it: the operative guard
 * is the builder's own `analysedCount === 0 -> unresolved` short-circuit at
 * `buildAnalysisNewViewModel.ts:891`, which fires FIRST — `deriveComparisonScope`
 * is never reached on that path, so citing it was the wrong reason for a right
 * outcome.) The claim that matters is about ROWS
 * RENDERED, not options present, and the loose version invited a check that
 * disproves it. It was found by MEASURING the assembled surface in a real
 * browser: at 280px with six excluded options the first section row sat at
 * 850px against a ~769px dock, i.e. a reader could reach NO navigation at all
 * without scrolling.
 *
 * ⚠ SCOPE, STATED PRECISELY. These pin what THIS file owns: the number of
 * consequence rows rendered at rest. They pin NOTHING about
 * `ComparisonScopeNote`, which names every excluded option in one sentence and
 * is genuinely unbounded — that component is shared with the existing Analysis
 * tab and is reported, not changed here.
 */
describe('5 · the excluded-option consequence rows are bounded, and nothing is lost', () => {
  it('the cap is 2, and moving it requires re-measuring rather than re-running this suite', () => {
    // ⭐⭐ THE ONE ASSERTION IN THIS BLOCK THAT IS *NOT* DERIVED, AND THAT IS THE
    // POINT. Every other pin here reads `EXCLUDED_OPTION_VISIBLE_CAP`, so the
    // constant and its guards move together: an independent review measured
    // that changing the cap 2 -> 3 or 2 -> 1 left 13 files / 237 tests GREEN.
    // A derived guard proves the copies AGREE; it can never prove the value is
    // RIGHT (CLAUDE.md trap 12d).
    //
    // The value's justification is a BROWSER MEASUREMENT recorded on the
    // constant itself: two rows plus the scope note is what fits above the
    // first section row at 280px. jsdom cannot check that (trap 3), so this
    // pin cannot verify the reason — what it does is make the cap unable to
    // drift SILENTLY. If you are changing it, re-measure at 280px on a
    // partial-scope run and update the constant's header with the new figures.
    expect(EXCLUDED_OPTION_VISIBLE_CAP).toBe(2)
  })

  const manyExcluded = (n: number) => [
    option({ id: 'o_kept', label: 'The one that was analysed', winProbability: 0.6 }),
    ...Array.from({ length: n }, (_, i) =>
      option({
        id: `o_out_${i}`,
        label: `Excluded option ${i}`,
        notAnalysed: true,
        notAnalysedReason: 'not_returned',
      }),
    ),
  ]

  it('renders at most the cap at rest, however many options were excluded', () => {
    for (const n of [3, 12, 30]) {
      cleanup()
      render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(manyExcluded(n)))} />)
      const rows = screen.getAllByTestId('analysis-new-glance-excluded-option')
      // ⚠ `Math.min`, not the bare cap. Asserting the cap exactly makes the
      // constant unmovable: at a cap of 4 the n=3 case would RED for having
      // three rows, which is correct behaviour. A false red is cheaper than a
      // false green and still wrong — the expectation is DERIVED from both the
      // cap and the input, so the pin survives the cap moving in either
      // direction.
      expect(rows, `n=${n}: the block grows with the option count`).toHaveLength(
        Math.min(n, EXCLUDED_OPTION_VISIBLE_CAP),
      )
    }
  })

  it('the control names how many more there are, and opening it reveals ALL of them', () => {
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(manyExcluded(9)))} />)
    const more = screen.getByTestId('analysis-new-glance-excluded-more')
    // Derived from the cap, never a typed-in number that drifts when it moves.
    expect(more).toHaveTextContent(
      ANALYSIS_NEW_COPY.disclosure.moreExcluded(9 - EXCLUDED_OPTION_VISIBLE_CAP),
    )
    expect(more).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(more)

    // NOTHING IS DROPPED — the whole point of a disclosure over a truncation.
    expect(screen.getAllByTestId('analysis-new-glance-excluded-option')).toHaveLength(9)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    // Bound by IDENTITY, not by count: the LAST option is the one a truncation
    // would lose, so it is the one asserted present by its own id.
    expect(
      screen.getAllByTestId('analysis-new-glance-excluded-option').at(-1)!.dataset.optionId,
    ).toBe('o_out_8')

    // ⭐ AND IT MUST CLOSE AGAIN. Two mutants lived here undetected until an
    // independent review found them, because nothing ever clicked twice:
    //   - a label that never switches leaves the control reading "Show 7 more"
    //     with all nine rows on screen — it would LIE to a sighted reader while
    //     `aria-expanded` told a screen-reader user the truth;
    //   - a one-way toggle reinstates the unbounded block permanently for the
    //     session, i.e. exactly the defect this cap exists to fix.
    // The EXPANDED label. This is the assertion that kills "the label never
    // switches" — the mutant that leaves the control reading "Show 7 more" with
    // all nine rows on screen, lying to a sighted reader while `aria-expanded`
    // tells a screen-reader user the truth.
    expect(more).toHaveTextContent(ANALYSIS_NEW_COPY.disclosure.collapse)

    fireEvent.click(more)

    // …and back. Collapsed, the label returns to naming the remainder.
    expect(more).toHaveTextContent(
      ANALYSIS_NEW_COPY.disclosure.moreExcluded(9 - EXCLUDED_OPTION_VISIBLE_CAP),
    )
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByTestId('analysis-new-glance-excluded-option')).toHaveLength(
      EXCLUDED_OPTION_VISIBLE_CAP,
    )
  })

  it('shows no control at all when everything already fits', () => {
    // The discriminating twin: a control that always renders would pass the
    // case above while advertising a disclosure over nothing.
    // PRECONDITION FIRST — an absence assertion on a testid nobody else in this
    // test uses would also pass if the testid were simply renamed. Proving the
    // control DOES appear one option later makes the absence discriminating
    // rather than merely true (CLAUDE.md trap 13).
    const { unmount } = render(
      <AtAGlance
        isRunning={false} reanalyseBlocked={false}
        reanalyseBlockedReason={null} glance={glanceOf(withOptions(manyExcluded(EXCLUDED_OPTION_VISIBLE_CAP + 1)))} />,
    )
    expect(
      screen.getByTestId('analysis-new-glance-excluded-more'),
      'the control never renders at all — the absence below would be vacuous',
    ).toBeInTheDocument()
    unmount()

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(manyExcluded(EXCLUDED_OPTION_VISIBLE_CAP)))} />)
    expect(screen.getAllByTestId('analysis-new-glance-excluded-option')).toHaveLength(
      EXCLUDED_OPTION_VISIBLE_CAP,
    )
    expect(screen.queryByTestId('analysis-new-glance-excluded-more')).toBeNull()
  })

  it('an option the NOTE cannot name renders no row either — the two filters agree', () => {
    // ⭐ THE PREMISE THE CAP RESTS ON, PINNED. The safety argument for capping
    // these rows is "the note above names every option these rows name". That
    // holds only because `deriveComparisonScope` and the builder apply the SAME
    // nameable-label predicate — one predicate spelled twice, i.e. a mirror
    // (CLAUDE.md trap 12). An independent review found HALF that agreement had
    // no red anywhere: dropping `o.label.length > 0` from the builder left the
    // whole suite green. This is that red.
    //
    // Both unnameable shapes are covered, because they fail DIFFERENT clauses:
    // a whitespace-only label fails the length check, and a label equal to the
    // option's own id fails the bare-id check.
    const options = [
      option({ id: 'o_kept', label: 'The one that was analysed', winProbability: 0.6 }),
      option({ id: 'o_named', label: 'Named and excluded', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      option({ id: 'o_blank', label: '   ', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      option({ id: 'o_bareid', label: 'o_bareid', notAnalysed: true, notAnalysedReason: 'not_returned' }),
    ]
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(options))} />)

    // PRECONDITION, pinned in-test: the owner really does drop both, so this
    // case is discriminating rather than passing because nothing was excluded.
    const scope = deriveComparisonScope(options)!
    expect(scope.excludedLabels, 'the owner named an unnameable option — this pin is vacuous').toEqual([
      'Named and excluded',
    ])

    // Bound by IDENTITY: exactly the nameable one, and neither unnameable one.
    const ids = screen
      .getAllByTestId('analysis-new-glance-excluded-option')
      .map((r) => r.dataset.optionId)
    expect(ids).toEqual(['o_named'])
  })

  it('an expanded disclosure does NOT survive into a different option set', () => {
    // ⚠ `AtAGlance` stays mounted across runs, so without a reset an expanded
    // disclosure carries into the next run's excluded options — the unbounded
    // block returns on a set the user never opened. Rerender rather than a
    // fresh render, because a fresh render cannot observe persistence at all:
    // the whole defect is that the component was NOT remounted.
    const { rerender } = render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(manyExcluded(9)))} />)
    fireEvent.click(screen.getByTestId('analysis-new-glance-excluded-more'))
    expect(screen.getAllByTestId('analysis-new-glance-excluded-option')).toHaveLength(9)

    // A DIFFERENT set: same size, different option identities.
    const nextOptions = [
      option({ id: 'o_kept2', label: 'A different analysed option', winProbability: 0.6 }),
      ...Array.from({ length: 9 }, (_, i) =>
        option({
          id: `o_next_${i}`,
          label: `Different excluded option ${i}`,
          notAnalysed: true,
          notAnalysedReason: 'not_returned',
        }),
      ),
    ]
    rerender(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(nextOptions))} />)

    expect(
      screen.getAllByTestId('analysis-new-glance-excluded-option'),
      'the disclosure stayed open across a change of option set',
    ).toHaveLength(EXCLUDED_OPTION_VISIBLE_CAP)
    // Bound by IDENTITY: it is the NEW set that is collapsed, not a stale render.
    expect(
      screen.getAllByTestId('analysis-new-glance-excluded-option')[0].dataset.optionId,
    ).toBe('o_next_0')
  })

  it('the reset survives ids that contain the separator — no key collision', () => {
    // ⚠ THE CASE A REVIEW DEMONSTRATED AGAINST THE FIRST IMPLEMENTATION, which
    // joined ids with '|': `[a, b, 'c|d']` and `[a, 'b|c', d]` both flatten to
    // `a|b|c|d`, so the reset silently did not fire across a genuine change of
    // option set. The failure direction was a MISSED reset, never a crash — the
    // worst kind, because the surface looks fine and the guard is simply absent.
    const setOne = [
      option({ id: 'o_kept', label: 'Analysed', winProbability: 0.6 }),
      option({ id: 'a', label: 'Option A', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      option({ id: 'b', label: 'Option B', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      option({ id: 'c|d', label: 'Option C-D', notAnalysed: true, notAnalysedReason: 'not_returned' }),
    ]
    const setTwo = [
      option({ id: 'o_kept', label: 'Analysed', winProbability: 0.6 }),
      option({ id: 'a', label: 'Option A', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      option({ id: 'b|c', label: 'Option B-C', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      option({ id: 'd', label: 'Option D', notAnalysed: true, notAnalysedReason: 'not_returned' }),
    ]

    const { rerender } = render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(setOne))} />)
    fireEvent.click(screen.getByTestId('analysis-new-glance-excluded-more'))
    expect(screen.getAllByTestId('analysis-new-glance-excluded-option')).toHaveLength(3)

    rerender(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(setTwo))} />)

    expect(
      screen.getAllByTestId('analysis-new-glance-excluded-option'),
      'the key collided, so the reset did not fire on a different option set',
    ).toHaveLength(EXCLUDED_OPTION_VISIBLE_CAP)
  })

  it('the COUNT is never behind the control — the note states it whatever the cap does', () => {
    // ⚠ THE 2.1340 GUARANTEE, pinned against this cap. Capping the consequence
    // rows must not put "how many were left out" behind a click.
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(withOptions(manyExcluded(30)))} />)
    const scope = deriveComparisonScope(manyExcluded(30))!
    expect(screen.getByTestId('comparison-scope-note-analysisNew')).toHaveTextContent(
      COMPARISON_SCOPE_COPY.sentence(scope),
    )
  })
})
