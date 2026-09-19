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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AtAGlance } from '../sections/AtAGlance'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { genuineDecision } from './analysisNewFixtures'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

afterEach(() => cleanup())

/**
 * ⛔⛔ THE REAL BUILDER, NOT A HAND-ROLLED CAST — AND MY FIRST VERSION WAS THE CAST.
 *
 * It asserted an object literal `as unknown as AtAGlance` with five fields, and
 * every arm died on `Cannot read properties of undefined (reading 'kind')`:
 * the component reads more of the model than I had imagined. **A fixture written
 * from the author's head is not evidence about the component** — the third time
 * that class bit me in one day, and the cast is what silenced the type checker
 * that would otherwise have said so.
 *
 * `buildAnalysisNewViewModel` is the one authority for this shape, so the
 * fixture cannot drift from what the panel actually renders.
 */
const glanceOf = () =>
  buildAnalysisNewViewModel({
    data: genuineDecision(),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

/**
 * ⚠ `isStale` + `staleKind` are the RIBBON'S OWN precondition, inherited from
 * `ribbonReanalyseHonoursTheGate`: the strip these acts live on does not mount
 * without them, so without this every arm below would assert over an absent
 * ribbon and pass for the wrong reason.
 */
const draw = (over: Record<string, unknown>) =>
  render(
    <AtAGlance
      glance={glanceOf()}
      isStale
      staleKind="unconfirmed"
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      isRunning={false}
      missingResults={['win_probability']}
      isProvisional={true}
      onReanalyse={vi.fn()}
      onReviewEstimates={vi.fn()}
      {...over}
    />,
  )

const RERUN = 'analysis-new-glance-ribbon-reanalyse'
const ESTIMATE = 'analysis-new-glance-ribbon-review-estimates'

describe('a re-run is offered only where it helps', () => {
  it('CONTROL: this fixture renders the ribbon at all', () => {
    // ⭐ WITHOUT THIS, EVERY ARM BELOW PASSES OVER AN ABSENT RIBBON. My first
    // version had no such control and died on a fixture too thin to render one;
    // a thinner fixture that merely rendered NOTHING would have gone GREEN.
    draw({ leaderWithheld: false })
    expect(screen.getByTestId(RERUN), 'the strip must mount before any arm asserts about it')
      .toBeInTheDocument()
  })

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
