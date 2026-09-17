/**
 * ⭐⭐ SAID ONCE ABOVE THE ROWS MEANS NOT AGAIN INSIDE EVERY ONE OF THEM.
 *
 * `theConvergenceLine` established that rows which all point one way should
 * say so once, and added the line. It did not take the sentence OUT of the
 * rows — so the deployed panel now names the option FOUR times on one screen:
 * once in the convergence line, then again at the end of each of three
 * near-identical row sentences. The reader still has to diff three paragraphs
 * to find the only part that differs, which was the original complaint.
 *
 * ⛔ THE PAIR IS THE WHOLE TEST. Suppression on its own is indistinguishable
 * from a builder that lost the sentence altogether, so the DISAGREE arm is not
 * a nicety — it is the only thing proving the rows still carry their
 * implication when nothing above has spoken for them. Same fixture, same
 * rows, one variable: whether the alternatives share an id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'
import { openAllSections } from './openNamedGroups'

type Alt = { id: string; label: string; reprints?: boolean; authored?: string }

/**
 * Two sensitivity rows. `reprints` reproduces the DEPLOYED shape, where the
 * producer's sentence ends by naming the alternative; without it the rows keep
 * the fixture's own wording, which names no option at all — the arm that
 * caught the first version of this change.
 */
const withAlternatives = (alts: readonly Alt[]): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  const rows = data.confidence.uncertainties.filter((u) => u.code === 'SENSITIVE_ASSUMPTION')
  expect(rows.length, 'precondition: the fixture emits fragile-edge rows').toBeGreaterThanOrEqual(alts.length)
  let i = 0
  return {
    ...data,
    confidence: {
      ...data.confidence,
      uncertainties: data.confidence.uncertainties.flatMap((u) => {
        if (u.code !== 'SENSITIVE_ASSUMPTION') return [u]
        if (i >= alts.length) return []
        const a = alts[i++]
        /**
         * ⚠ THE LONG FORM MUST EXCEED THE 80-CHARACTER LABEL BUDGET, because
         * `sectionTitleRung` only considers rows whose humanised text does NOT
         * fit the slot. A short message makes the row a non-candidate, no rung
         * fires, the sentence becomes the HEADLINE, and `implication` is
         * already '' — a different shape with nothing to suppress.
         */
        const long = `If the assumed strength of this relationship changes significantly in either direction, "${a.label}" could become the better choice`
        const named = `If this changes significantly, "${a.label}" could become the better choice`
        return [
          {
            ...u,
            alternativeWinnerId: a.id,
            alternativeWinnerLabel: a.label,
            /**
             * ⚠ SHORT EDGE LABELS ARE PART OF THE SHAPE, NOT DECORATION. This
             * fixture ships 95-character labels deliberately, so no row is
             * titled and the sentence becomes the HEADLINE — a shape where
             * `implication` is already '' and there is nothing to suppress.
             * The deployed defect needs rows that ARE titled, which needs
             * labels that fit the slot.
             */
            /**
             * ⭐ AUTHORED PROSE: the producer wrote the sentence, so
             * `useResultsSectionData` offers NO short form for it
             * (`messageWithSubjectNamedAbove` is populated only when
             * `!fe.description`). It may name the converged option and still
             * carry a condition the header never states.
             */
            /**
             * ⛔ THE SHORT FORM MUST BE REMOVED, NOT JUST OVERRIDDEN, and my
             * first version of this arm forgot to. `manyFragileEdges` ships
             * `messageWithSubjectNamedAbove`, so overriding only `message` left
             * the template marker in place and the row was correctly classified
             * generic — the arm failed while the product was right.
             *
             * The real composition cannot produce that combination:
             * `useResultsSectionData.ts:3671` populates the short form ONLY
             * when `!fe.description`, so a producer-authored sentence and a
             * template short form never coexist. Modelling it here is what
             * makes the fixture capable of expressing the failure at all.
             */
            ...(a.authored
              ? {
                  message: a.authored,
                  displayText: a.authored,
                  edgeFromLabel: `Lead gap ${i}`,
                  edgeToLabel: `Team output ${i}`,
                  messageWithSubjectNamedAbove: undefined,
                }
              : {}),
            ...(a.reprints
              ? {
                  message: long,
                  displayText: long,
                  edgeFromLabel: `Lead gap ${i}`,
                  edgeToLabel: `Team output ${i}`,
                  messageWithSubjectNamedAbove: named,
                }
              : {}),
          },
        ]
      }),
    },
  } as unknown as ResultsSectionDataReturn
}

/** The deployed shape: both rows agree AND both reprint the conclusion. */
const AGREE: readonly Alt[] = [
  { id: 'opt_two', label: 'Two Developers', reprints: true },
  { id: 'opt_two', label: 'Two Developers', reprints: true },
]
/** Agreeing rows whose sentences name NO option — nothing to de-duplicate. */
const AGREE_BUT_SILENT: readonly Alt[] = [
  { id: 'opt_two', label: 'Two Developers' },
  { id: 'opt_two', label: 'Two Developers' },
]
const DISAGREE: readonly Alt[] = [
  { id: 'opt_two', label: 'Two Developers', reprints: true },
  { id: 'opt_lead', label: 'Hire a Tech Lead', reprints: true },
]

const renderBody = (data: ResultsSectionDataReturn) => {
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="say_once"
    />,
  )
  openAllSections()
}

/** The clause every row reprinted. Counted, never merely looked for. */
const REPRINTS = () => screen.queryAllByText(/could become the better choice/i)
const CONVERGENCE = () => screen.queryByTestId('analysis-new-sensitivity-convergence')

afterEach(cleanup)

describe('the conclusion is said once', () => {
  it('⛔ PRECONDITION — the two arms really do differ on convergence', () => {
    // Without this the "pair" below could be one case written twice.
    renderBody(withAlternatives(AGREE))
    expect(CONVERGENCE(), 'agreeing rows must produce the line').not.toBeNull()
    cleanup()
    renderBody(withAlternatives(DISAGREE))
    expect(CONVERGENCE(), 'disagreeing rows must NOT produce it').toBeNull()
  })

  it('WITH the line above, no row reprints the conclusion', () => {
    renderBody(withAlternatives(AGREE))
    expect(REPRINTS(), 'the rows must stop repeating what the header just said').toHaveLength(0)
    // Contrast, same run: the conclusion is still ON SCREEN, once. This is a
    // de-duplication, and without this assertion it could be a deletion.
    expect(CONVERGENCE()).not.toBeNull()
    expect(CONVERGENCE()!.textContent).toContain('Two Developers')
  })

  it('⭐ WITHOUT it, every row keeps its sentence — the half that proves nothing was lost', () => {
    renderBody(withAlternatives(DISAGREE))
    expect(CONVERGENCE()).toBeNull()
    expect(
      REPRINTS().length,
      'rows nothing above speaks for must still say where they point',
    ).toBeGreaterThanOrEqual(2)
  })

  /**
   * ⛔⛔ THE ARM THAT CAUGHT THE FIRST VERSION OF THIS CHANGE, AND THE REASON
   * IT IS PINNED RATHER THAN REMEMBERED.
   *
   * The first implementation dropped the implication on convergence ALONE.
   * Convergence says the rows point one way; it does not say each row's
   * sentence NAMES that option. These rows agree and read "the comparison
   * could land differently" — a sentence the header never made — so dropping
   * them would have been a deletion wearing a de-duplication's clothes.
   */
  it('⛔ agreeing rows that name NO option keep their sentence — there is nothing to de-duplicate', () => {
    renderBody(withAlternatives(AGREE_BUT_SILENT))
    expect(CONVERGENCE(), 'precondition: these rows DO converge').not.toBeNull()
    const kept = screen.queryAllByText(/the comparison could land differently/i)
    expect(kept.length, 'a sentence the header never made must survive').toBeGreaterThanOrEqual(2)
  })

  /**
   * ⛔⛔ THE COUNTEREXAMPLE THAT REFUTED THE PREVIOUS IMPLEMENTATION, from an
   * independent reviewer, and it is the case neither the author nor a second
   * reviewer could construct.
   *
   * These rows CONVERGE and their sentences NAME the converged option — and
   * they also carry a condition and a consequence the convergence header never
   * states. A substring test on the label deletes that analysis outright.
   *
   * The rule is now identity with `messageWithSubjectNamedAbove`, a field the
   * producer's own composition populates ONLY when it authored nothing. So
   * authored prose is not merely unlikely to be caught — it is structurally
   * incapable of being caught.
   */
  it('⛔ AUTHORED prose that names the same option KEEPS its sentence — the header never said this', () => {
    const AUTHORED = [
      {
        id: 'opt_two',
        label: 'Two Developers',
        authored:
          'If team throughput falls below the required capacity, Two Developers needs an additional onboarding month before the delivery commitment is credible',
      },
      {
        id: 'opt_two',
        label: 'Two Developers',
        authored:
          'If onboarding slips past the first sprint, Two Developers loses the cost advantage that made it competitive here',
      },
    ] as const
    renderBody(withAlternatives(AUTHORED))
    // Precondition: these rows DO converge, so the suppression path is live.
    expect(CONVERGENCE(), 'precondition: the rows converge').not.toBeNull()
    /**
     * ⚠ READ FROM `textContent`, NOT `queryAllByText`. The row truncates at a
     * word boundary and discloses the remainder, so the sentence is split
     * across elements and an element-scoped matcher misses text that is
     * plainly on screen. My first version of this assertion failed for that
     * reason and the PRODUCT was correct — worth keeping, because a test that
     * fails for its own reasons is indistinguishable from a real defect until
     * you look.
     */
    const onScreen = (document.body.textContent ?? '').replace(/\s+/g, ' ')
    expect(onScreen).toMatch(/needs an additional onboarding month/i)
    expect(onScreen).toMatch(/loses the cost advantage/i)
    // Contrast in the same run: the probe can also report an absence, so the
    // two matches above are not a matcher that says yes to everything.
    expect(onScreen).not.toMatch(/a sentence this fixture never contained/i)
  })

  /**
   * ⛔⛔ THE DEFECT MY OWN ADVERSARIAL PASS FOUND, AFTER TWO REVIEWERS.
   *
   * `sectionTitleRung` is a property of the SET; whether a row's edge names
   * RESOLVE is a property of the ROW. So `rowTitle` returns '' at rung 'full'
   * for a row whose names do not resolve, the implication falls through to the
   * FULL sentence, and a collection condition missing `headlineText !== ''`
   * empties a row that has no title either — nothing left on screen to say
   * what it is about.
   *
   * The two rows below differ ONLY in whether their edge labels resolve.
   */
  /**
   * ⭐⭐ THE INVARIANT THAT MAKES THE DEFENSIVE CLAUSE UNNECESSARY — pinned
   * because it is the thing that would silently stop being true.
   *
   * ⛔ THIS REPLACES A TEST THAT COULD NOT FAIL. I believed I had found a
   * reachable defect in my own collection condition: a row at rung 'full'
   * whose edge names do not resolve gets no title, so the implication falls
   * through to the full sentence and a set including it would empty a row that
   * has nothing else on screen. I wrote a control for it. A mutant deleting
   * the clause left that control GREEN — so rather than assert equivalence I
   * proved the state is unreachable, and replaced the tautology.
   *
   * WHY IT IS UNREACHABLE: `sectionTitleRung` is ALL-OR-NOTHING. It returns
   * null the moment ANY candidate row fails to resolve, and candidates are
   * only rows too long to label themselves. So a mixed set does not produce a
   * titled row beside an untitled one — it produces NO titles at all.
   *
   * That is the property to guard. If it ever became per-row, the defensive
   * clause in the collection condition would become load-bearing overnight and
   * nothing else would notice.
   */
  it('⭐ the title rung is all-or-nothing — one unresolvable row untitles the whole set', () => {
    const data = manyFragileEdges()
    let i = 0
    const long =
      'If the assumed strength of this relationship changes significantly in either direction, "Two Developers" could become the better choice'
    const mixed = {
      ...data,
      confidence: {
        ...data.confidence,
        uncertainties: data.confidence.uncertainties.flatMap((u) => {
          if (u.code !== 'SENSITIVE_ASSUMPTION') return [u]
          if (i >= 2) return []
          const base = { ...u, message: long, displayText: long } as Record<string, unknown>
          const row =
            i === 0
              ? { ...base, edgeFromLabel: 'Lead gap', edgeToLabel: 'Team output', edgeLabelsResolved: true }
              : { ...base, edgeFromLabel: undefined, edgeToLabel: undefined, edgeLabelsResolved: false }
          i++
          return [row as unknown as (typeof data.confidence.uncertainties)[number]]
        }),
      },
    } as unknown as ResultsSectionDataReturn

    renderBody(mixed)
    const onScreen = (document.body.textContent ?? '').replace(/\s+/g, ' ')
    // Neither row is titled: the resolvable row does NOT get a title of its own
    // while its sibling goes without. That is the all-or-nothing guarantee.
    expect(onScreen).not.toMatch(/Lead gap → Team output/i)
    // Contrast in the same run: the rows ARE rendered, so this is an absent
    // TITLE rather than an absent section.
    expect(onScreen).toMatch(/changes significantly/i)
  })
})
