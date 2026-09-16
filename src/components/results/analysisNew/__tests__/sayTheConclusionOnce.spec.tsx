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

type Alt = { id: string; label: string; reprints?: boolean }

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
})
