/**
 * A RE-RUN IS OFFERED ONLY WHERE A RE-RUN COULD HELP.
 *
 * ## Witnessed on Paul's run, 19 Sep 2026 14:32Z, staging `fd65f971`
 *
 * The ribbon read *"This analysis is partial. The win share and the overall
 * robustness rating did not come back"* with **Re-run to be sure** beside it.
 *
 * **Both sentences were true. The act was not.** CEE had suppressed the result
 * on `v5.ui_directive.suppressed / fact_type=run_analysis /
 * reason=leading_option_claim_withheld`, downstream of
 * `CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED` — a property of the MODEL, not of
 * the run. Pressing it reaches the same gate, spends the same compute, and
 * returns the same partial answer.
 *
 * ## ⭐ The gate answered the wrong question
 *
 * `onReanalyse && (!reanalyseBlocked || reason !== null)` asks **"may I
 * re-run?"**. The reader needed **"would re-running change this?"** — two
 * questions under one control, the same shape as the CEE suppression that
 * caused it.
 *
 * ## ⚠ The re-run is NOT deleted
 *
 * Where results are missing by FAILURE a re-run is exactly right, and removing
 * it would trade one wrong act for another. It is withheld only where a
 * DESIGNATION was withheld, and the remedy that works takes its place.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtAGlance } from '../sections/AtAGlance'
import type { AtAGlance as AtAGlanceModel } from '../analysisNewTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

const glance = (): AtAGlanceModel =>
  ({
    headline: null,
    showAnswer: false,
    options: { totalCount: 0, rows: [] },
    condition: null,
    ribbon: [],
  }) as unknown as AtAGlanceModel

const draw = (over: Record<string, unknown>) =>
  render(
    <AtAGlance
      glance={glance()}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      isRunning={false}
      missingResults={['win_probability']}
      isProvisional={true}
      onReanalyse={() => {}}
      onReviewEstimates={() => {}}
      {...over}
    />,
  )

const RERUN = 'analysis-new-glance-ribbon-reanalyse'
const ESTIMATE = 'analysis-new-glance-ribbon-review-estimates'

describe('a re-run is offered only where it helps', () => {
  it('PRECONDITION: with nothing withheld, the re-run IS offered — the case that must survive', () => {
    draw({ leaderWithheld: false })
    expect(
      screen.queryByTestId(RERUN),
      'results missing by FAILURE are exactly what a re-run is for',
    ).toBeInTheDocument()
    expect(screen.queryByTestId(ESTIMATE)).toBeNull()
  })

  it('⛔ where a DESIGNATION was withheld, the re-run is not offered', () => {
    draw({ leaderWithheld: true })
    expect(
      screen.queryByTestId(RERUN),
      'pressing it reaches the same gate and returns the same partial answer',
    ).toBeNull()
  })

  it('⛔ and the remedy that WOULD work takes its place', () => {
    draw({ leaderWithheld: true })
    const act = screen.getByTestId(ESTIMATE)
    expect(act, 'a limitation with no route is the defect one level down').toBeInTheDocument()
    expect(act).toHaveTextContent(/estimate/i)
  })

  /**
   * ⚠ FAIL-CLOSED, the convention this component already states for
   * `onReanalyse` and `onReviewEstimates`: a host that cannot route anywhere
   * renders NO control rather than a dead one.
   */
  it('⛔ with no estimate route, it renders no act at all — never a dead one', () => {
    draw({ leaderWithheld: true, onReviewEstimates: undefined })
    expect(screen.queryByTestId(ESTIMATE)).toBeNull()
    expect(
      screen.queryByTestId(RERUN),
      'and it does not fall back to the act that cannot help',
    ).toBeNull()
  })

  /**
   * ⛔ THE DISCRIMINATOR. Without it, an implementation that never offered the
   * re-run would satisfy every case above — trading one wrong act for another.
   */
  it('⛔ the re-run still disappears when the gate refuses AND gives no reason', () => {
    draw({ leaderWithheld: false, reanalyseBlocked: true, reanalyseBlockedReason: null })
    expect(screen.queryByTestId(RERUN), 'the existing gate is unchanged').toBeNull()
  })
})
